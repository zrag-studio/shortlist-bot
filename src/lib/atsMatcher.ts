import { AtsCoverageResult, KeywordItem, ResumeContent } from '../types/resume';

/**
 * Deterministically evaluates how many active target ATS keywords appear
 * inside the user's actual resume text (never fabricated or hardcoded).
 */
export function calculateAtsCoverage(
  content: ResumeContent,
  keywords: KeywordItem[]
): AtsCoverageResult {
  const activeKeywords = keywords.filter((k) => k.selected);
  if (activeKeywords.length === 0) {
    return {
      totalTracked: 0,
      matchedCount: 0,
      percentage: 0,
      matchedTerms: [],
      missingTerms: [],
    };
  }

  const corpusParts: string[] = [
    content.header.targetTitle,
    content.summary,
    ...content.coreExpertise,
    ...content.tools,
    ...content.education.flatMap((e) => [e.degree, e.institution, e.gpaOrScore, ...e.highlights]),
    ...content.experience.flatMap((e) => [e.roleTitle, e.organization, ...e.bullets]),
    ...content.projects.flatMap((p) => [p.title, p.subtitle, ...p.bullets]),
    ...content.certifications.flatMap((c) => [c.title, ...c.bullets]),
    ...content.virtualExperience.flatMap((v) => [v.title, ...v.bullets]),
  ];

  const normalizedCorpus = corpusParts
    .join(' ')
    .replace(/\*\*/g, '')
    .toLowerCase();

  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  for (const kw of activeKeywords) {
    const cleanTerm = kw.term.trim().toLowerCase();
    if (!cleanTerm) continue;

    // Direct substring match OR parenthetical-stripped match (e.g., "Google Analytics (GA4)")
    const stripped = cleanTerm.replace(/\([^)]*\)/g, '').trim();
    const parts = stripped
      .split(/[&/,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);

    const isDirectMatch =
      normalizedCorpus.includes(cleanTerm) ||
      (stripped.length > 2 && normalizedCorpus.includes(stripped));

    const isCompoundMatch =
      parts.length > 1 && parts.every((part) => normalizedCorpus.includes(part));

    if (isDirectMatch || isCompoundMatch) {
      matchedTerms.push(kw.term);
    } else {
      missingTerms.push(kw.term);
    }
  }

  const totalTracked = matchedTerms.length + missingTerms.length;
  const percentage =
    totalTracked > 0 ? Math.round((matchedTerms.length / totalTracked) * 100) : 0;

  return {
    totalTracked,
    matchedCount: matchedTerms.length,
    percentage,
    matchedTerms,
    missingTerms,
  };
}

/**
 * Safely splits text containing **bold** markers into styled segments
 * without using raw HTML injection.
 */
export function parseBoldSegments(text: string): Array<{ text: string; bold: boolean }> {
  const segments: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}
