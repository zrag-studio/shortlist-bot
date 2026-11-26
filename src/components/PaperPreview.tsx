import { Download, Loader2 } from 'lucide-react';
import { parseBoldSegments } from '../lib/atsMatcher';
import {
  AtsCoverageResult,
  AtsFontFamily,
  LayoutMode,
  ResumeContent,
} from '../types/resume';

interface PaperPreviewProps {
  content: ResumeContent;
  layoutMode: LayoutMode;
  fontFamily: AtsFontFamily;
  fontSizePt: number;
  coverage: AtsCoverageResult;
  onChangeLayoutMode: (mode: LayoutMode) => void;
  onChangeFontFamily: (font: AtsFontFamily) => void;
  onChangeFontSize: (pt: number) => void;
  onExportPdf: () => void;
  isExporting: boolean;
  adRequiredForPdf: boolean;
}

function RichText({ text }: { text: string }) {
  const segments = parseBoldSegments(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-bold text-[#0F0F0F]">
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

export function PaperPreview({
  content,
  layoutMode,
  fontFamily,
  fontSizePt,
  coverage,
  onChangeLayoutMode,
  onChangeFontFamily,
  onChangeFontSize,
  onExportPdf,
  isExporting,
  adRequiredForPdf,
}: PaperPreviewProps) {
  const fontClass = fontFamily === 'times' ? 'ats-font-times' : 'ats-font-arial';
  const basePx = Math.max(8.5, Math.min(11.5, fontSizePt)) * 1.18;

  const contactItems = [
    content.header.phone ? `M: ${content.header.phone}` : '',
    content.header.email ? `Email: ${content.header.email}` : '',
    content.header.location ? `Location: ${content.header.location}` : '',
    content.header.linkedinUrl ? content.header.linkedinUrl : '',
  ].filter(Boolean);

  const filledEdu = content.education.filter((e) => e.institution.trim() || e.degree.trim());
  const filledExp = content.experience.filter(
    (e) => e.organization.trim() || e.roleTitle.trim() || e.bullets.some((b) => b.trim())
  );
  const filledProjects = content.projects.filter((p) => p.title.trim());
  const filledCerts = content.certifications.filter((c) => c.title.trim());
  const filledVirtual = content.virtualExperience.filter((v) => v.title.trim());

  const isBlankResume =
    !content.header.fullName.trim() &&
    !content.summary.trim() &&
    filledEdu.length === 0 &&
    filledExp.length === 0 &&
    filledProjects.length === 0 &&
    content.coreExpertise.length === 0 &&
    content.tools.length === 0;

  const renderExperience = () =>
    filledExp.length > 0 && (
      <section className="mt-3">
        <h2
          className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
          style={{ fontSize: `${basePx + 1.2}px` }}
        >
          {layoutMode === 'fresher' ? 'Internship Experience' : 'Work Experience'}
        </h2>
        <div className="space-y-2">
          {filledExp.map((exp) => (
            <div key={exp.id}>
              <div className="flex items-baseline justify-between gap-2 font-bold text-[#111111]">
                <span>
                  {[exp.organization, exp.location].filter(Boolean).join(' | ') || exp.roleTitle}
                </span>
                <span className="shrink-0">{exp.duration}</span>
              </div>
              {exp.roleTitle && exp.organization && (
                <div className="font-bold text-[#333333]">{exp.roleTitle}</div>
              )}
              {exp.bullets.filter((b) => b.trim()).length > 0 && (
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  {exp.bullets
                    .filter((b) => b.trim())
                    .map((b, i) => (
                      <li key={i}>
                        <RichText text={b} />
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );

  const renderEducation = () =>
    filledEdu.length > 0 && (
      <section className="mt-3">
        <h2
          className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
          style={{ fontSize: `${basePx + 1.2}px` }}
        >
          Education
        </h2>
        <div className="space-y-1.5">
          {filledEdu.map((edu) => (
            <div key={edu.id}>
              <div className="flex items-baseline justify-between gap-2 font-bold text-[#111111]">
                <span>{[edu.institution, edu.location].filter(Boolean).join(', ')}</span>
                <span className="shrink-0">{edu.graduationYear}</span>
              </div>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                {(edu.degree || edu.gpaOrScore) && (
                  <li>{[edu.degree, edu.gpaOrScore].filter(Boolean).join('; ')}</li>
                )}
                {edu.highlights
                  .filter((h) => h.trim())
                  .map((h, i) => (
                    <li key={i}>
                      <RichText text={h} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );

  const renderCertifications = () =>
    filledCerts.length > 0 && (
      <section className="mt-3">
        <h2
          className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
          style={{ fontSize: `${basePx + 1.2}px` }}
        >
          Bootcamps &amp; Certifications
        </h2>
        <div className="space-y-1.5">
          {filledCerts.map((cert) => (
            <div key={cert.id}>
              <div className="flex items-baseline justify-between gap-2 font-bold text-[#111111]">
                <span>{cert.title}</span>
                <span className="shrink-0">{cert.issuerOrYear}</span>
              </div>
              {cert.bullets.filter((b) => b.trim()).length > 0 && (
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  {cert.bullets
                    .filter((b) => b.trim())
                    .map((b, i) => (
                      <li key={i}>
                        <RichText text={b} />
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );

  const renderProjects = () =>
    filledProjects.length > 0 && (
      <section className="mt-3">
        <h2
          className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
          style={{ fontSize: `${basePx + 1.2}px` }}
        >
          Projects
        </h2>
        <div className="space-y-1.5">
          {filledProjects.map((proj) => (
            <div key={proj.id}>
              <div className="font-bold text-[#111111]">
                {[proj.title, proj.subtitle].filter(Boolean).join(' — ')}
              </div>
              {proj.bullets.filter((b) => b.trim()).length > 0 && (
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  {proj.bullets
                    .filter((b) => b.trim())
                    .map((b, i) => (
                      <li key={i}>
                        <RichText text={b} />
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );

  const renderVirtual = () =>
    filledVirtual.length > 0 && (
      <section className="mt-3">
        <h2
          className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
          style={{ fontSize: `${basePx + 1.2}px` }}
        >
          Virtual Experience
        </h2>
        <div className="space-y-1.5">
          {filledVirtual.map((v) => (
            <div key={v.id}>
              <div className="font-bold text-[#111111]">{v.title}</div>
              {v.bullets.filter((b) => b.trim()).length > 0 && (
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  {v.bullets
                    .filter((b) => b.trim())
                    .map((b, i) => (
                      <li key={i}>
                        <RichText text={b} />
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    );

  return (
    <div className="flex flex-col h-full">
      {/* Formatting Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#232C3B]">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Resume Font"
            value={fontFamily}
            onChange={(e) => onChangeFontFamily(e.target.value as AtsFontFamily)}
            className="bg-[#121720] border border-[#232C3B] text-xs text-[#F1F5F9] rounded-lg px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
          >
            <option value="times">Times New Roman</option>
            <option value="arial">Arial / Modern Sans</option>
          </select>

          <div className="inline-flex items-center bg-[#121720] border border-[#232C3B] rounded-lg">
            <button
              type="button"
              onClick={() => onChangeFontSize(Math.max(8.5, Number((fontSizePt - 0.5).toFixed(1))))}
              aria-label="Smaller text"
              className="px-2 py-1 text-xs text-[#94A3B8] hover:text-white"
            >
              A-
            </button>
            <span className="px-1.5 text-xs font-mono tabular-nums text-[#F1F5F9]">
              {fontSizePt.toFixed(1)}pt
            </span>
            <button
              type="button"
              onClick={() => onChangeFontSize(Math.min(11.5, Number((fontSizePt + 0.5).toFixed(1))))}
              aria-label="Larger text"
              className="px-2 py-1 text-xs text-[#94A3B8] hover:text-white"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={() => onChangeLayoutMode(layoutMode === 'fresher' ? 'switcher' : 'fresher')}
            className="px-2.5 py-1.5 text-xs text-[#94A3B8] hover:text-[#F1F5F9] bg-[#121720] border border-[#232C3B] rounded-lg whitespace-nowrap"
          >
            {layoutMode === 'fresher' ? 'Fresher Order' : 'Experienced Order'}
          </button>
        </div>

        <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
          {coverage.matchedCount}/{coverage.totalTracked} keywords matched
        </span>
      </div>

      {/* Crisp Pure-White A4 ATS Paper Preview */}
      <div className="flex-1 overflow-y-auto pr-0.5 pb-6">
        <article
          aria-label="Live ATS Resume Preview"
          className={`bg-white text-[#111111] shadow-2xl shadow-black/50 rounded-sm w-full max-w-[700px] mx-auto px-6 py-7 md:px-9 md:py-8 leading-[1.35] ${fontClass}`}
          style={{ fontSize: `${basePx}px`, minHeight: '760px' }}
        >
          {isBlankResume ? (
            <div className="h-[680px] flex flex-col items-center justify-center text-center px-6 text-[#555555]">
              <p className="text-base font-bold text-[#111111]">Your ATS Resume Preview</p>
              <p className="text-xs mt-2 max-w-sm leading-relaxed">
                Start filling your details in the Build tab, or answer 8 quick questions in AI Chat
                to watch your crisp ATS resume appear here live.
              </p>
            </div>
          ) : (
            <>
              <header className="text-center pb-2">
                <h1
                  className="font-bold tracking-wide uppercase text-[#0A0A0A]"
                  style={{ fontSize: `${basePx + 10}px`, lineHeight: 1.15 }}
                >
                  {content.header.fullName.trim() || 'YOUR FULL NAME'}
                </h1>
                {content.header.targetTitle.trim() && (
                  <p
                    className="font-semibold uppercase tracking-[0.06em] text-[#1A1A1A] mt-0.5"
                    style={{ fontSize: `${basePx + 1.8}px` }}
                  >
                    {content.header.targetTitle}
                  </p>
                )}
                {contactItems.length > 0 && (
                  <p
                    className="text-[#333333] mt-1"
                    style={{ fontSize: `${Math.max(9.5, basePx - 0.6)}px` }}
                  >
                    {contactItems.join(' | ')}
                  </p>
                )}
              </header>

              {content.summary.trim() && (
                <section className="mt-2.5">
                  <h2
                    className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
                    style={{ fontSize: `${basePx + 1.2}px` }}
                  >
                    Summary
                  </h2>
                  <p className="text-[#141414]">
                    <RichText text={content.summary} />
                  </p>
                </section>
              )}

              {(content.coreExpertise.length > 0 || content.tools.length > 0) && (
                <section className="mt-3">
                  <h2
                    className="font-bold uppercase tracking-wide border-b border-[#BDBDBD] pb-0.5 mb-1.5 text-[#111111]"
                    style={{ fontSize: `${basePx + 1.2}px` }}
                  >
                    Skills
                  </h2>
                  <div className="space-y-1">
                    {content.coreExpertise.length > 0 && (
                      <p>
                        <strong className="font-bold">Core Expertise: </strong>
                        {content.coreExpertise.join(', ')}.
                      </p>
                    )}
                    {content.tools.length > 0 && (
                      <p>
                        <strong className="font-bold">Platforms &amp; Tools: </strong>
                        {content.tools.join(', ')}.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {layoutMode === 'switcher' ? (
                <>
                  {renderExperience()}
                  {renderEducation()}
                  {renderProjects()}
                  {renderCertifications()}
                  {renderVirtual()}
                </>
              ) : (
                <>
                  {renderEducation()}
                  {renderCertifications()}
                  {renderProjects()}
                  {renderVirtual()}
                  {renderExperience()}
                </>
              )}
            </>
          )}
        </article>

        {/* Single Clear Download PDF CTA at Bottom */}
        <div className="max-w-[700px] mx-auto mt-5 flex justify-center">
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExporting || isBlankResume}
            className="w-full sm:w-auto min-w-[240px] inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50 rounded-xl transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{adRequiredForPdf ? 'Unlocking & Exporting PDF...' : 'Creating PDF...'}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{adRequiredForPdf ? 'Watch Ad & Download PDF' : 'Download PDF'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
