import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { AtsFontFamily, LayoutMode, ResumeContent } from '../types/resume';
import { parseBoldSegments } from './atsMatcher';

interface PdfRenderOptions {
  content: ResumeContent;
  layoutMode: LayoutMode;
  fontFamily: AtsFontFamily;
  fontSizePt: number;
}

// Sanitize characters outside WinAnsi encoding so pdf-lib standard fonts never throw
function sanitizeWinAnsi(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u20B9/g, 'INR ')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '');
}

/**
 * Generates a 100% ATS-parsable, real vector text-selectable PDF directly in the browser.
 * Enforces single-column flow, zero tables/images, standard recruiter fonts, and >= 8.5pt body size.
 */
export async function generateAtsPdfBytes(options: PdfRenderOptions): Promise<Uint8Array> {
  const { content, layoutMode, fontFamily } = options;
  const bodySize = Math.max(8.5, Math.min(11.5, options.fontSizePt));

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${content.header.fullName || 'Resume'} - ATS Resume`);
  pdfDoc.setSubject(content.header.targetTitle || 'ATS Resume');
  pdfDoc.setCreator('Shortlist Studio');

  const isSerif = fontFamily === 'times';
  const regularFont = await pdfDoc.embedFont(
    isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica
  );
  const boldFont = await pdfDoc.embedFont(
    isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold
  );

  // A4 dimensions (595.28 x 841.89 pt)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 40;
  const marginTop = 36;
  const marginBottom = 34;
  const maxWidth = pageWidth - marginX * 2;
  const lineHeight = bodySize * 1.32;
  const black = rgb(0.06, 0.06, 0.06);
  const subtleGray = rgb(0.28, 0.28, 0.28);
  const ruleColor = rgb(0.75, 0.75, 0.75);

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < marginBottom) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - marginTop;
    }
  };

  // Word-wraps rich text (**bold** segments) and draws vector text cleanly
  const drawRichParagraph = (
    rawText: string,
    xStart: number,
    widthLimit: number,
    size: number,
    customLineHeight = size * 1.32
  ) => {
    const clean = sanitizeWinAnsi(rawText).trim();
    if (!clean) return;

    const segments = parseBoldSegments(clean);
    const tokens: Array<{ word: string; bold: boolean }> = [];
    for (const seg of segments) {
      const words = seg.text.split(/(\s+)/);
      for (const w of words) {
        if (w.length > 0) {
          tokens.push({ word: w, bold: seg.bold });
        }
      }
    }

    const lines: Array<Array<{ word: string; bold: boolean }>> = [];
    let currentLine: Array<{ word: string; bold: boolean }> = [];
    let currentWidth = 0;

    for (const token of tokens) {
      const font = token.bold ? boldFont : regularFont;
      const wWidth = font.widthOfTextAtSize(token.word, size);

      if (currentLine.length === 0 && token.word.trim() === '') {
        continue;
      }

      if (currentWidth + wWidth > widthLimit && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = token.word.trim() === '' ? [] : [token];
        currentWidth = token.word.trim() === '' ? 0 : wWidth;
      } else {
        currentLine.push(token);
        currentWidth += wWidth;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    for (const line of lines) {
      ensureSpace(customLineHeight);
      let drawX = xStart;
      for (const token of line) {
        const font: PDFFont = token.bold ? boldFont : regularFont;
        page.drawText(token.word, {
          x: drawX,
          y: cursorY,
          size,
          font,
          color: black,
        });
        drawX += font.widthOfTextAtSize(token.word, size);
      }
      cursorY -= customLineHeight;
    }
  };

  const drawBullet = (text: string) => {
    const clean = sanitizeWinAnsi(text).trim();
    if (!clean) return;
    ensureSpace(lineHeight);
    const bulletX = marginX + 6;
    const textX = marginX + 16;
    page.drawText('-', {
      x: bulletX,
      y: cursorY,
      size: bodySize,
      font: boldFont,
      color: black,
    });
    drawRichParagraph(clean, textX, maxWidth - 16, bodySize, lineHeight);
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(bodySize * 2.6);
    cursorY -= 5;
    const headerSize = bodySize + 1.2;
    page.drawText(sanitizeWinAnsi(title.toUpperCase()), {
      x: marginX,
      y: cursorY,
      size: headerSize,
      font: boldFont,
      color: black,
    });
    cursorY -= 3.5;
    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: pageWidth - marginX, y: cursorY },
      thickness: 0.65,
      color: ruleColor,
    });
    cursorY -= bodySize * 1.15;
  };

  const drawLeftRightRow = (leftText: string, rightText: string, bold = true, size = bodySize) => {
    ensureSpace(lineHeight);
    const safeLeft = sanitizeWinAnsi(leftText);
    const safeRight = sanitizeWinAnsi(rightText);
    const font = bold ? boldFont : regularFont;
    const rightWidth = font.widthOfTextAtSize(safeRight, size);
    const leftMaxWidth = maxWidth - rightWidth - 10;

    let displayLeft = safeLeft;
    while (font.widthOfTextAtSize(displayLeft, size) > leftMaxWidth && displayLeft.length > 10) {
      displayLeft = displayLeft.slice(0, -1);
    }

    page.drawText(displayLeft, {
      x: marginX,
      y: cursorY,
      size,
      font,
      color: black,
    });

    if (safeRight) {
      page.drawText(safeRight, {
        x: pageWidth - marginX - rightWidth,
        y: cursorY,
        size,
        font,
        color: black,
      });
    }
    cursorY -= lineHeight;
  };

  // --- 1. INTRODUCTION HEADER (Centered classic serif/sans matching user PDFs) ---
  const nameText = sanitizeWinAnsi((content.header.fullName || 'YOUR NAME').toUpperCase());
  const nameSize = bodySize + 10;
  const nameWidth = boldFont.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, {
    x: Math.max(marginX, (pageWidth - nameWidth) / 2),
    y: cursorY,
    size: nameSize,
    font: boldFont,
    color: black,
  });
  cursorY -= nameSize * 0.88;

  if (content.header.targetTitle.trim()) {
    const titleText = sanitizeWinAnsi(content.header.targetTitle.toUpperCase());
    const titleSize = bodySize + 1.8;
    const titleWidth = boldFont.widthOfTextAtSize(titleText, titleSize);
    page.drawText(titleText, {
      x: Math.max(marginX, (pageWidth - titleWidth) / 2),
      y: cursorY,
      size: titleSize,
      font: boldFont,
      color: black,
    });
    cursorY -= titleSize * 1.2;
  }

  const contactParts = [
    content.header.phone ? `M: ${content.header.phone}` : '',
    content.header.email ? `Email: ${content.header.email}` : '',
    content.header.location ? `Location: ${content.header.location}` : '',
    content.header.linkedinUrl ? content.header.linkedinUrl : '',
  ].filter(Boolean);

  if (contactParts.length > 0) {
    const contactLine = sanitizeWinAnsi(contactParts.join(' | '));
    const contactSize = Math.max(8.5, bodySize - 0.5);
    const contactWidth = regularFont.widthOfTextAtSize(contactLine, contactSize);
    page.drawText(contactLine, {
      x: Math.max(marginX, (pageWidth - contactWidth) / 2),
      y: cursorY,
      size: contactSize,
      font: regularFont,
      color: subtleGray,
    });
    cursorY -= contactSize * 1.45;
  }

  // --- 2. SUMMARY ---
  if (content.summary.trim()) {
    drawSectionHeader('Summary');
    drawRichParagraph(content.summary, marginX, maxWidth, bodySize);
  }

  // --- 3. SKILLS / CORE EXPERTISE & TOOLS ---
  if (content.coreExpertise.length > 0 || content.tools.length > 0) {
    drawSectionHeader('Skills');
    if (content.coreExpertise.length > 0) {
      drawRichParagraph(
        `**Core Expertise:** ${content.coreExpertise.join(', ')}.`,
        marginX,
        maxWidth,
        bodySize
      );
    }
    if (content.tools.length > 0) {
      drawRichParagraph(
        `**Platforms & Tools:** ${content.tools.join(', ')}.`,
        marginX,
        maxWidth,
        bodySize
      );
    }
  }

  const renderExperienceSection = () => {
    const filledExp = content.experience.filter(
      (e) => e.organization.trim() || e.roleTitle.trim() || e.bullets.some((b) => b.trim())
    );
    if (filledExp.length === 0) return;

    drawSectionHeader(layoutMode === 'fresher' ? 'Internship Experience' : 'Work Experience');
    for (const exp of filledExp) {
      const orgLine = [exp.organization, exp.location].filter(Boolean).join(' | ');
      drawLeftRightRow(orgLine || exp.roleTitle, exp.duration, true, bodySize + 0.3);
      if (exp.roleTitle && orgLine) {
        ensureSpace(lineHeight);
        page.drawText(sanitizeWinAnsi(exp.roleTitle), {
          x: marginX,
          y: cursorY,
          size: bodySize,
          font: boldFont,
          color: subtleGray,
        });
        cursorY -= lineHeight;
      }
      for (const bullet of exp.bullets) {
        drawBullet(bullet);
      }
      cursorY -= 3;
    }
  };

  const renderEducationSection = () => {
    const filledEdu = content.education.filter((e) => e.institution.trim() || e.degree.trim());
    if (filledEdu.length === 0) return;

    drawSectionHeader('Education');
    for (const edu of filledEdu) {
      const instLine = [edu.institution, edu.location].filter(Boolean).join(', ');
      drawLeftRightRow(instLine, edu.graduationYear, true, bodySize + 0.3);
      const degreeDetail = [edu.degree, edu.gpaOrScore].filter(Boolean).join('; ');
      if (degreeDetail) {
        drawBullet(degreeDetail);
      }
      for (const h of edu.highlights) {
        drawBullet(h);
      }
      cursorY -= 2.5;
    }
  };

  const renderCertificationsSection = () => {
    const filledCerts = content.certifications.filter((c) => c.title.trim());
    if (filledCerts.length === 0) return;

    drawSectionHeader('Bootcamps & Certifications');
    for (const cert of filledCerts) {
      drawLeftRightRow(cert.title, cert.issuerOrYear, true, bodySize + 0.2);
      for (const b of cert.bullets) {
        drawBullet(b);
      }
      cursorY -= 2;
    }
  };

  const renderProjectsSection = () => {
    const filledProjects = content.projects.filter((p) => p.title.trim());
    if (filledProjects.length === 0) return;

    drawSectionHeader('Projects');
    for (const proj of filledProjects) {
      const titleLine = [proj.title, proj.subtitle].filter(Boolean).join(' — ');
      drawLeftRightRow(titleLine, '', true, bodySize + 0.2);
      for (const b of proj.bullets) {
        drawBullet(b);
      }
      cursorY -= 2;
    }
  };

  const renderVirtualSection = () => {
    const filledVirtual = content.virtualExperience.filter((v) => v.title.trim());
    if (filledVirtual.length === 0) return;

    drawSectionHeader('Virtual Experience');
    for (const v of filledVirtual) {
      drawLeftRightRow(v.title, '', true, bodySize + 0.2);
      for (const b of v.bullets) {
        drawBullet(b);
      }
      cursorY -= 2;
    }
  };

  // Layout ordering mirrors the user's Fresher vs Career Switcher templates
  if (layoutMode === 'switcher') {
    renderExperienceSection();
    renderEducationSection();
    renderProjectsSection();
    renderCertificationsSection();
    renderVirtualSection();
  } else {
    renderEducationSection();
    renderCertificationsSection();
    renderProjectsSection();
    renderVirtualSection();
    renderExperienceSection();
  }

  return await pdfDoc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'ATS_Resume';
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
