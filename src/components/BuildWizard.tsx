import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { EMPTY_RESUME_CONTENT, PRESET_LIST, getPresetById } from '../data/presets';
import { matchJdApi, writeSummaryApi } from '../lib/api';
import { TelegramContext, triggerHaptic } from '../lib/telegram';
import {
  AtsCoverageResult,
  KeywordItem,
  LayoutMode,
  ResumeContent,
  ResumeRecord,
  TrackPresetId,
} from '../types/resume';
import { BulletCoachModal } from './BulletCoachModal';

interface BuildWizardProps {
  resume: ResumeRecord;
  starterKeywords: KeywordItem[];
  coverage: AtsCoverageResult;
  telegramCtx: TelegramContext;
  onUpdateResume: (updater: (prev: ResumeRecord) => ResumeRecord) => void;
  onSelectTrack: (trackId: TrackPresetId) => void;
  onOpenAiChat: () => void;
  onOpenPreview: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
  adRequiredForPdf: boolean;
}

const TOTAL_STEPS = 6;

const STEP_META = [
  {
    num: 1,
    question: 'What role are you applying for?',
    helper: 'Pick your specialization and experience level to unlock matching ATS keywords.',
  },
  {
    num: 2,
    question: 'What are your name and contact details?',
    helper: 'Recruiters look for your name, target headline, phone, email, city, and optional LinkedIn.',
  },
  {
    num: 3,
    question: 'Tell us about your college and education',
    helper: 'Add your latest degree, graduation year, CGPA or percentage, and clubs or entrance scores.',
  },
  {
    num: 4,
    question: 'Add internships, work, and projects',
    helper: 'Use short action-result bullet points. Tap "Polish Bullet with AI" to strengthen any line.',
  },
  {
    num: 5,
    question: 'Pick your skills, tools & certifications',
    helper: 'Tap recruiter keywords that fit you, or paste a Job Description below to spot missing ATS skills.',
  },
  {
    num: 6,
    question: 'Write your summary & download PDF',
    helper: 'Generate a crisp 3–4 line summary with AI, review your checklist, and download your ATS PDF.',
  },
];

export function BuildWizard({
  resume,
  starterKeywords,
  coverage,
  telegramCtx,
  onUpdateResume,
  onSelectTrack,
  onOpenAiChat,
  onOpenPreview,
  onExportPdf,
  isExporting,
  adRequiredForPdf,
}: BuildWizardProps) {
  const step = Math.max(1, Math.min(TOTAL_STEPS, resume.currentStep || 1));
  const preset = getPresetById(resume.trackId);
  const roleLabel =
    resume.trackId === 'custom' && resume.customRoleName.trim()
      ? resume.customRoleName.trim()
      : preset.name;

  // Step 4: Bullet Coach Modal
  const [coachTarget, setCoachTarget] = useState<{
    sectionType: 'experience' | 'project';
    entryId: string;
  } | null>(null);

  // Step 5: Skills & Collapsible Match JD
  const [newSkillInput, setNewSkillInput] = useState('');
  const [newToolInput, setNewToolInput] = useState('');
  const [showCertSection, setShowCertSection] = useState(
    resume.content.certifications.length > 0 || resume.content.virtualExperience.length > 0
  );
  const [jdOpen, setJdOpen] = useState(false);
  const [jdText, setJdText] = useState('');
  const [isMatchingJd, setIsMatchingJd] = useState(false);
  const [jdError, setJdError] = useState<string | null>(null);
  const [jdResult, setJdResult] = useState<{
    matchedKeywords: string[];
    missingSkills: string[];
    missingTools: string[];
    quickTip: string;
  } | null>(null);

  // Step 6: Summary
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const setStep = (next: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_STEPS, next));
    onUpdateResume((prev) => ({ ...prev, currentStep: clamped }));
  };

  const updateContent = (fn: (prev: ResumeContent) => ResumeContent) => {
    onUpdateResume((prev) => ({ ...prev, content: fn(prev.content) }));
  };

  const activeKeywords = starterKeywords.filter((k) => k.selected).map((k) => k.term);
  const coreSuggestions = starterKeywords.filter((k) => k.category !== 'tool');
  const toolSuggestions = starterKeywords.filter((k) => k.category === 'tool');

  const toggleSkillChip = (term: string, bucket: 'coreExpertise' | 'tools') => {
    updateContent((c) => {
      const list = c[bucket];
      const exists = list.some((x) => x.toLowerCase() === term.toLowerCase());
      return {
        ...c,
        [bucket]: exists
          ? list.filter((x) => x.toLowerCase() !== term.toLowerCase())
          : [...list, term],
      };
    });
  };

  const addSkillIfMissing = (term: string, bucket: 'coreExpertise' | 'tools') => {
    updateContent((c) => {
      const list = c[bucket];
      if (list.some((x) => x.toLowerCase() === term.toLowerCase())) return c;
      return { ...c, [bucket]: [...list, term] };
    });
    triggerHaptic('light');
  };

  const handleMatchJd = async () => {
    if (jdText.trim().length < 25) {
      setJdError('Paste a Job Description (at least 25 characters) to compare keywords.');
      return;
    }
    setJdError(null);
    setIsMatchingJd(true);
    try {
      const res = await matchJdApi(telegramCtx, {
        roleLabel,
        jdText: jdText.trim(),
        resumeContent: resume.content,
      });
      setJdResult({
        matchedKeywords: res.matchedKeywords || [],
        missingSkills: res.missingSkills || [],
        missingTools: res.missingTools || [],
        quickTip: res.quickTip || '',
      });
      triggerHaptic('success');
    } catch (err) {
      setJdError(err instanceof Error ? err.message : 'Could not analyze job description.');
    } finally {
      setIsMatchingJd(false);
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryError(null);
    setIsGeneratingSummary(true);
    try {
      const result = await writeSummaryApi(telegramCtx, {
        roleLabel,
        layoutMode: resume.layoutMode,
        content: resume.content,
        targetKeywords: activeKeywords,
      });
      if (result.summary) {
        updateContent((c) => ({ ...c, summary: result.summary }));
        triggerHaptic('success');
      }
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Unable to write summary right now.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleInsertCoachedBullet = (bulletText: string) => {
    if (!coachTarget) return;
    if (coachTarget.sectionType === 'experience') {
      updateContent((c) => ({
        ...c,
        experience: c.experience.map((exp) =>
          exp.id === coachTarget.entryId
            ? {
                ...exp,
                bullets: [...exp.bullets.filter((b) => b.trim() !== ''), bulletText],
              }
            : exp
        ),
      }));
    } else {
      updateContent((c) => ({
        ...c,
        projects: c.projects.map((proj) =>
          proj.id === coachTarget.entryId
            ? {
                ...proj,
                bullets: [...proj.bullets.filter((b) => b.trim() !== ''), bulletText],
              }
            : proj
        ),
      }));
    }
  };

  const meta = STEP_META[step - 1] ?? STEP_META[0];
  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  const hasContact = Boolean(
    resume.content.header.fullName.trim() &&
      (resume.content.header.email.trim() || resume.content.header.phone.trim())
  );
  const hasEducation = resume.content.education.some(
    (e) => e.institution.trim() || e.degree.trim()
  );
  const hasWorkOrProject =
    resume.content.experience.some((e) => e.organization.trim() || e.roleTitle.trim()) ||
    resume.content.projects.some((p) => p.title.trim());
  const hasAnyContent =
    Boolean(resume.content.header.fullName.trim()) ||
    Boolean(resume.content.summary.trim()) ||
    hasEducation ||
    hasWorkOrProject ||
    resume.content.coreExpertise.length > 0 ||
    resume.content.tools.length > 0;

  const pdfCtaLabel = isExporting
    ? 'Preparing PDF...'
    : adRequiredForPdf
      ? 'Watch Ad & Download PDF'
      : 'Download PDF';

  return (
    <div className="flex flex-col h-full">
      {/* Calm Progress Header */}
      <div className="pb-5 mb-5 border-b border-[#232C3B] space-y-3">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-mono tabular-nums">
            Step {step} of {TOTAL_STEPS}
          </span>
          <div className="flex items-center gap-1.5">
            {STEP_META.map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                aria-label={`Go to step ${s.num}`}
                className={`h-2 rounded-full transition-all ${
                  s.num === step
                    ? 'w-7 bg-[#38BDF8]'
                    : s.num < step
                      ? 'w-2.5 bg-[#2563EB]'
                      : 'w-2.5 bg-[#232C3B] hover:bg-[#334155]'
                }`}
              />
            ))}
          </div>
          <span className="font-mono tabular-nums text-[#F1F5F9]">{progressPct}%</span>
        </div>

        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#F1F5F9] leading-snug">
            {meta.question}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1 leading-relaxed">{meta.helper}</p>
        </div>
      </div>

      {/* Single-Step Body */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-8 pr-0.5">
        {/* STEP 1: TARGET ROLE & LEVEL */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Star Feature Banner: Guided 1-by-1 AI Chat */}
            <button
              type="button"
              onClick={onOpenAiChat}
              className="w-full p-4 bg-[#121720] hover:bg-[#181F2B] border border-[#38BDF8]/40 rounded-xl flex items-center justify-between gap-3 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#2563EB]/20 border border-[#38BDF8]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F1F5F9]">
                    Build Faster with AI Chat
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">
                    Answer 8 quick questions one-by-one and AI writes your entire ATS resume automatically.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#38BDF8] shrink-0" />
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'fresher' as LayoutMode,
                    title: 'Fresher / Student',
                    sub: 'College or MBA graduate',
                  },
                  {
                    id: 'switcher' as LayoutMode,
                    title: 'Experienced / Switcher',
                    sub: '1+ yrs or career switch',
                  },
                ] as const
              ).map((opt) => {
                const active = resume.layoutMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateResume((prev) => ({ ...prev, layoutMode: opt.id }))}
                    className={`p-3.5 text-left rounded-xl border transition-colors min-h-[64px] ${
                      active
                        ? 'bg-[#181F2B] border-[#38BDF8]'
                        : 'bg-[#121720] border-[#232C3B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#F1F5F9]">{opt.title}</span>
                      {active && <Check className="w-4 h-4 text-[#38BDF8] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{opt.sub}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_LIST.map((p) => {
                const active = resume.trackId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectTrack(p.id)}
                    className={`p-4 text-left rounded-xl border transition-colors ${
                      active
                        ? 'bg-[#181F2B] border-[#38BDF8]'
                        : 'bg-[#121720] border-[#232C3B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#F1F5F9]">{p.shortName}</span>
                      {active && <Check className="w-4 h-4 text-[#38BDF8] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{p.tagline}</p>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => onSelectTrack('custom')}
                className={`p-4 text-left rounded-xl border transition-colors sm:col-span-2 ${
                  resume.trackId === 'custom'
                    ? 'bg-[#181F2B] border-[#38BDF8]'
                    : 'bg-[#121720] border-[#232C3B] hover:border-[#334155]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#F1F5F9]">Custom Role</span>
                  {resume.trackId === 'custom' && <Check className="w-4 h-4 text-[#38BDF8]" />}
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Operations, Consulting, Sales, Supply Chain, or any custom job title.
                </p>
              </button>
            </div>

            {resume.trackId === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Target Job Role
                </label>
                <input
                  type="text"
                  value={resume.customRoleName}
                  onChange={(e) =>
                    onUpdateResume((prev) => ({
                      ...prev,
                      customRoleName: e.target.value,
                      content: {
                        ...prev.content,
                        header: {
                          ...prev.content.header,
                          targetTitle: e.target.value.toUpperCase(),
                        },
                      },
                    }))
                  }
                  placeholder="e.g., Business Analyst, Operations Trainee"
                  className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            )}

            {hasAnyContent && (
              <div className="pt-2 border-t border-[#232C3B] flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateResume((prev) => ({
                      ...prev,
                      content: structuredClone(EMPTY_RESUME_CONTENT),
                      currentStep: 1,
                    }));
                    triggerHaptic('light');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F1F5F9]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Blank Resume</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CONTACT INFO */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Full Name</label>
              <input
                type="text"
                value={resume.content.header.fullName}
                onChange={(e) =>
                  updateContent((c) => ({
                    ...c,
                    header: { ...c.header, fullName: e.target.value },
                  }))
                }
                placeholder="e.g., Aarav Mehta"
                className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-4 py-3 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Target Role Headline
              </label>
              <input
                type="text"
                value={resume.content.header.targetTitle}
                onChange={(e) =>
                  updateContent((c) => ({
                    ...c,
                    header: { ...c.header, targetTitle: e.target.value },
                  }))
                }
                placeholder={preset.defaultTargetTitle}
                className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-4 py-3 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={resume.content.header.phone}
                  onChange={(e) =>
                    updateContent((c) => ({
                      ...c,
                      header: { ...c.header, phone: e.target.value },
                    }))
                  }
                  placeholder="+91 98765 43210"
                  className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-4 py-3 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Email</label>
                <input
                  type="email"
                  value={resume.content.header.email}
                  onChange={(e) =>
                    updateContent((c) => ({
                      ...c,
                      header: { ...c.header, email: e.target.value },
                    }))
                  }
                  placeholder="your.name@gmail.com"
                  className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-4 py-3 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">City</label>
                <input
                  type="text"
                  value={resume.content.header.location}
                  onChange={(e) =>
                    updateContent((c) => ({
                      ...c,
                      header: { ...c.header, location: e.target.value },
                    }))
                  }
                  placeholder="Mumbai, India"
                  className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-4 py-3 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  LinkedIn / Portfolio URL (Optional)
                </label>
                <input
                  type="text"
                  value={resume.content.header.linkedinUrl}
                  onChange={(e) =>
                    updateContent((c) => ({
                      ...c,
                      header: { ...c.header, linkedinUrl: e.target.value },
                    }))
                  }
                  placeholder="linkedin.com/in/yourname"
                  className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-4 py-3 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: EDUCATION */}
        {step === 3 && (
          <div className="space-y-4">
            {resume.content.education.map((edu, idx) => (
              <div
                key={edu.id}
                className="p-4 bg-[#121720] border border-[#232C3B] rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#94A3B8]">
                    {idx === 0 ? 'Latest Degree' : `Earlier Degree #${idx + 1}`}
                  </span>
                  {resume.content.education.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateContent((c) => ({
                          ...c,
                          education: c.education.filter((e) => e.id !== edu.id),
                        }))
                      }
                      aria-label="Remove degree"
                      className="text-[#94A3B8] hover:text-[#DC2626] p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={(e) =>
                      updateContent((c) => ({
                        ...c,
                        education: c.education.map((item) =>
                          item.id === edu.id ? { ...item, institution: e.target.value } : item
                        ),
                      }))
                    }
                    placeholder="College / University Name"
                    className="sm:col-span-2 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) =>
                      updateContent((c) => ({
                        ...c,
                        education: c.education.map((item) =>
                          item.id === edu.id ? { ...item, degree: e.target.value } : item
                        ),
                      }))
                    }
                    placeholder="Degree & Specialization (e.g., MBA Finance)"
                    className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={edu.graduationYear}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          education: c.education.map((item) =>
                            item.id === edu.id
                              ? { ...item, graduationYear: e.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder="Grad Year"
                      className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                    <input
                      type="text"
                      value={edu.gpaOrScore}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          education: c.education.map((item) =>
                            item.id === edu.id ? { ...item, gpaOrScore: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="CGPA / %"
                      className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-[#94A3B8]">
                      Key Achievements / Entrance Scores / Clubs (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateContent((c) => ({
                          ...c,
                          education: c.education.map((item) =>
                            item.id === edu.id
                              ? { ...item, highlights: [...item.highlights, ''] }
                              : item
                          ),
                        }))
                      }
                      className="text-xs text-[#38BDF8] hover:underline"
                    >
                      + Add line
                    </button>
                  </div>
                  {(edu.highlights.length > 0 ? edu.highlights : ['']).map((hl, hi) => (
                    <div key={hi} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={hl}
                        onChange={(e) =>
                          updateContent((c) => ({
                            ...c,
                            education: c.education.map((item) => {
                              if (item.id !== edu.id) return item;
                              const next =
                                item.highlights.length > 0 ? [...item.highlights] : [''];
                              next[hi] = e.target.value;
                              return { ...item, highlights: next };
                            }),
                          }))
                        }
                        placeholder="e.g., Finance Club Member, CAT 95%tile, or Case Winner"
                        className="flex-1 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                      />
                      {edu.highlights.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateContent((c) => ({
                              ...c,
                              education: c.education.map((item) =>
                                item.id === edu.id
                                  ? {
                                      ...item,
                                      highlights: item.highlights.filter((_, i) => i !== hi),
                                    }
                                  : item
                              ),
                            }))
                          }
                          aria-label="Remove achievement"
                          className="text-[#64748B] hover:text-[#DC2626] p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                updateContent((c) => ({
                  ...c,
                  education: [
                    ...c.education,
                    {
                      id: `edu-${Date.now()}`,
                      institution: '',
                      location: '',
                      degree: '',
                      graduationYear: '',
                      gpaOrScore: '',
                      highlights: [],
                    },
                  ],
                }))
              }
              className="w-full py-2.5 text-xs font-medium text-[#38BDF8] bg-[#121720] hover:bg-[#181F2B] border border-dashed border-[#232C3B] rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Degree</span>
            </button>
          </div>
        )}

        {/* STEP 4: INTERNSHIPS, WORK & PROJECTS */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#F1F5F9]">
                  {resume.layoutMode === 'fresher' ? 'Internship Experience' : 'Work Experience'}
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    updateContent((c) => ({
                      ...c,
                      experience: [
                        ...c.experience,
                        {
                          id: `exp-${Date.now()}`,
                          organization: '',
                          location: '',
                          roleTitle: '',
                          duration: '',
                          bullets: [''],
                        },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#F1F5F9] border border-[#232C3B] rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add {resume.layoutMode === 'fresher' ? 'Internship' : 'Experience'}</span>
                </button>
              </div>

              {resume.content.experience.length === 0 && (
                <p className="text-xs text-[#94A3B8] p-4 bg-[#121720] border border-[#232C3B] rounded-xl">
                  No internship yet? No problem — showcase 1–2 college or live projects below.
                </p>
              )}

              {resume.content.experience.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 bg-[#121720] border border-[#232C3B] rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCoachTarget({ sectionType: 'experience', entryId: exp.id })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2563EB]/15 hover:bg-[#2563EB] text-[#38BDF8] hover:text-white border border-[#38BDF8]/40 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Polish Bullet with AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateContent((c) => ({
                          ...c,
                          experience: c.experience.filter((e) => e.id !== exp.id),
                        }))
                      }
                      aria-label="Remove experience"
                      className="text-[#94A3B8] hover:text-[#DC2626] p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={exp.organization}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          experience: c.experience.map((item) =>
                            item.id === exp.id ? { ...item, organization: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Organization Name"
                      className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                    <input
                      type="text"
                      value={exp.roleTitle}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          experience: c.experience.map((item) =>
                            item.id === exp.id ? { ...item, roleTitle: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Role Title (e.g., Summer Intern)"
                      className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          experience: c.experience.map((item) =>
                            item.id === exp.id ? { ...item, location: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="City"
                      className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                    <input
                      type="text"
                      value={exp.duration}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          experience: c.experience.map((item) =>
                            item.id === exp.id ? { ...item, duration: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Dates (e.g., May 2025 - Jul 2025)"
                      className="bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>

                  <div className="space-y-2">
                    {exp.bullets.map((bullet, bi) => (
                      <div key={bi} className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) =>
                            updateContent((c) => ({
                              ...c,
                              experience: c.experience.map((item) =>
                                item.id === exp.id
                                  ? {
                                      ...item,
                                      bullets: item.bullets.map((val, i) =>
                                        i === bi ? e.target.value : val
                                      ),
                                    }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Action + Context + Result (or tap 'Polish Bullet with AI')"
                          className="flex-1 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateContent((c) => ({
                              ...c,
                              experience: c.experience.map((item) =>
                                item.id === exp.id
                                  ? {
                                      ...item,
                                      bullets: item.bullets.filter((_, i) => i !== bi),
                                    }
                                  : item
                              ),
                            }))
                          }
                          aria-label="Remove bullet"
                          className="text-[#64748B] hover:text-[#DC2626] p-1 mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        updateContent((c) => ({
                          ...c,
                          experience: c.experience.map((item) =>
                            item.id === exp.id ? { ...item, bullets: [...item.bullets, ''] } : item
                          ),
                        }))
                      }
                      className="text-xs text-[#38BDF8] hover:underline"
                    >
                      + Add bullet point
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Projects Section */}
            <div className="space-y-3 pt-4 border-t border-[#232C3B]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#F1F5F9]">Projects</h2>
                  <p className="text-xs text-[#94A3B8]">
                    e.g., {preset.beginnerHints.projectExample}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateContent((c) => ({
                      ...c,
                      projects: [
                        ...c.projects,
                        { id: `proj-${Date.now()}`, title: '', subtitle: '', bullets: [''] },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#F1F5F9] border border-[#232C3B] rounded-lg whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              </div>

              {resume.content.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-4 bg-[#121720] border border-[#232C3B] rounded-xl space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setCoachTarget({ sectionType: 'project', entryId: proj.id })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2563EB]/15 hover:bg-[#2563EB] text-[#38BDF8] hover:text-white border border-[#38BDF8]/40 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Polish Bullet with AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateContent((c) => ({
                          ...c,
                          projects: c.projects.filter((p) => p.id !== proj.id),
                        }))
                      }
                      aria-label="Remove project"
                      className="text-[#94A3B8] hover:text-[#DC2626] p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={proj.title}
                    onChange={(e) =>
                      updateContent((c) => ({
                        ...c,
                        projects: c.projects.map((p) =>
                          p.id === proj.id ? { ...p, title: e.target.value } : p
                        ),
                      }))
                    }
                    placeholder="Project Title"
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />

                  {proj.bullets.map((b, bi) => (
                    <div key={bi} className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        value={b}
                        onChange={(e) =>
                          updateContent((c) => ({
                            ...c,
                            projects: c.projects.map((p) =>
                              p.id === proj.id
                                ? {
                                    ...p,
                                    bullets: p.bullets.map((val, i) =>
                                      i === bi ? e.target.value : val
                                    ),
                                  }
                                : p
                            ),
                          }))
                        }
                        placeholder="What you built/analyzed and what skill you learned..."
                        className="flex-1 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                      />
                      {proj.bullets.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateContent((c) => ({
                              ...c,
                              projects: c.projects.map((p) =>
                                p.id === proj.id
                                  ? { ...p, bullets: p.bullets.filter((_, i) => i !== bi) }
                                  : p
                              ),
                            }))
                          }
                          aria-label="Remove bullet"
                          className="text-[#64748B] hover:text-[#DC2626] p-1 mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateContent((c) => ({
                        ...c,
                        projects: c.projects.map((p) =>
                          p.id === proj.id ? { ...p, bullets: [...p.bullets, ''] } : p
                        ),
                      }))
                    }
                    className="text-xs text-[#38BDF8] hover:underline"
                  >
                    + Add bullet point
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: SKILLS, TOOLS, CERTIFICATIONS & COLLAPSIBLE JD MATCHER */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#F1F5F9]">Core Skills</label>
                <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                  {resume.content.coreExpertise.length} selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set([...coreSuggestions.map((k) => k.term), ...resume.content.coreExpertise])
                ).map((skill) => {
                  const selected = resume.content.coreExpertise.some(
                    (s) => s.toLowerCase() === skill.toLowerCase()
                  );
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkillChip(skill, 'coreExpertise')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                        selected
                          ? 'bg-[#2563EB] border-[#38BDF8] text-white'
                          : 'bg-[#121720] border-[#232C3B] text-[#CBD5E1] hover:border-[#38BDF8]'
                      }`}
                    >
                      {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{skill}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSkillInput.trim()) {
                      e.preventDefault();
                      toggleSkillChip(newSkillInput.trim(), 'coreExpertise');
                      setNewSkillInput('');
                    }
                  }}
                  placeholder="Add custom core skill..."
                  className="flex-1 bg-[#121720] border border-[#232C3B] rounded-lg px-3.5 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newSkillInput.trim()) {
                      toggleSkillChip(newSkillInput.trim(), 'coreExpertise');
                      setNewSkillInput('');
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#F1F5F9] border border-[#232C3B] rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#232C3B]">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#F1F5F9]">Tools &amp; Platforms</label>
                <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                  {resume.content.tools.length} selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set([...toolSuggestions.map((k) => k.term), ...resume.content.tools])
                ).map((tool) => {
                  const selected = resume.content.tools.some(
                    (t) => t.toLowerCase() === tool.toLowerCase()
                  );
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleSkillChip(tool, 'tools')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                        selected
                          ? 'bg-[#2563EB] border-[#38BDF8] text-white'
                          : 'bg-[#121720] border-[#232C3B] text-[#CBD5E1] hover:border-[#38BDF8]'
                      }`}
                    >
                      {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{tool}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newToolInput}
                  onChange={(e) => setNewToolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newToolInput.trim()) {
                      e.preventDefault();
                      toggleSkillChip(newToolInput.trim(), 'tools');
                      setNewToolInput('');
                    }
                  }}
                  placeholder="Add tool (Excel, Power BI, SQL, Figma...)"
                  className="flex-1 bg-[#121720] border border-[#232C3B] rounded-lg px-3.5 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newToolInput.trim()) {
                      toggleSkillChip(newToolInput.trim(), 'tools');
                      setNewToolInput('');
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#F1F5F9] border border-[#232C3B] rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Collapsible Match with a Job Description (AI) */}
            <div className="bg-[#121720] border border-[#232C3B] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setJdOpen((prev) => !prev)}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#181F2B] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#38BDF8] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[#F1F5F9]">
                      Match with a Job Description (AI)
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      Paste any JD to find missing ATS keywords and add them in 1 tap.
                    </p>
                  </div>
                </div>
                {jdOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
                )}
              </button>

              {jdOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-[#232C3B] space-y-3">
                  <textarea
                    rows={4}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the job description text here..."
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />

                  {jdError && (
                    <p className="text-xs text-[#FCA5A5] bg-[#DC2626]/10 border border-[#DC2626]/40 px-3 py-2 rounded-lg">
                      {jdError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleMatchJd}
                    disabled={isMatchingJd}
                    className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs font-medium rounded-lg inline-flex items-center justify-center gap-2"
                  >
                    {isMatchingJd ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking ATS Match...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Scan Missing ATS Keywords</span>
                      </>
                    )}
                  </button>

                  {jdResult && (
                    <div className="space-y-3 pt-2 border-t border-[#232C3B]">
                      {jdResult.quickTip && (
                        <p className="text-xs text-[#CBD5E1] leading-relaxed">{jdResult.quickTip}</p>
                      )}

                      {jdResult.matchedKeywords.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-[#16A34A]">
                            Already Matched ({jdResult.matchedKeywords.length})
                          </p>
                          <p className="text-xs text-[#94A3B8]">
                            {jdResult.matchedKeywords.join(' · ')}
                          </p>
                        </div>
                      )}

                      {jdResult.missingSkills.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-[#38BDF8]">
                            Missing Skills (Tap to Add)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {jdResult.missingSkills.map((term) => (
                              <button
                                key={term}
                                type="button"
                                onClick={() => addSkillIfMissing(term, 'coreExpertise')}
                                className="px-2.5 py-1.5 text-xs bg-[#0A0D12] hover:bg-[#2563EB] text-[#F1F5F9] border border-[#232C3B] hover:border-[#38BDF8] rounded-lg inline-flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{term}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {jdResult.missingTools.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-[#38BDF8]">
                            Missing Tools (Tap to Add)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {jdResult.missingTools.map((term) => (
                              <button
                                key={term}
                                type="button"
                                onClick={() => addSkillIfMissing(term, 'tools')}
                                className="px-2.5 py-1.5 text-xs bg-[#0A0D12] hover:bg-[#2563EB] text-[#F1F5F9] border border-[#232C3B] hover:border-[#38BDF8] rounded-lg inline-flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{term}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional Certifications */}
            <div className="pt-4 border-t border-[#232C3B] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#F1F5F9]">
                    Certifications &amp; Bootcamps (Optional)
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    e.g., {preset.beginnerHints.certificationExample}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCertSection(true);
                    updateContent((c) => ({
                      ...c,
                      certifications: [
                        ...c.certifications,
                        { id: `cert-${Date.now()}`, title: '', issuerOrYear: '', bullets: [''] },
                      ],
                    }));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#F1F5F9] border border-[#232C3B] rounded-lg whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Certificate</span>
                </button>
              </div>

              {showCertSection &&
                resume.content.certifications.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-3.5 bg-[#121720] border border-[#232C3B] rounded-xl space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cert.title}
                        onChange={(e) =>
                          updateContent((c) => ({
                            ...c,
                            certifications: c.certifications.map((item) =>
                              item.id === cert.id ? { ...item, title: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="Certificate Name"
                        className="flex-1 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                      />
                      <input
                        type="text"
                        value={cert.issuerOrYear}
                        onChange={(e) =>
                          updateContent((c) => ({
                            ...c,
                            certifications: c.certifications.map((item) =>
                              item.id === cert.id
                                ? { ...item, issuerOrYear: e.target.value }
                                : item
                            ),
                          }))
                        }
                        placeholder="Year"
                        className="w-20 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-2.5 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateContent((c) => ({
                            ...c,
                            certifications: c.certifications.filter((item) => item.id !== cert.id),
                          }))
                        }
                        aria-label="Remove certificate"
                        className="text-[#94A3B8] hover:text-[#DC2626] p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={cert.bullets[0] || ''}
                      onChange={(e) =>
                        updateContent((c) => ({
                          ...c,
                          certifications: c.certifications.map((item) =>
                            item.id === cert.id ? { ...item, bullets: [e.target.value] } : item
                          ),
                        }))
                      }
                      placeholder="1 line on what you learned (optional)"
                      className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* STEP 6: SUMMARY & DOWNLOAD */}
        {step === 6 && (
          <div className="space-y-5">
            <div className="p-4 bg-[#121720] border border-[#232C3B] rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#F1F5F9]">
                    Professional Summary (3–4 Lines)
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    Highlights your top ATS keywords at the top of your resume.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-lg whitespace-nowrap"
                >
                  {isGeneratingSummary ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Write Summary with AI</span>
                    </>
                  )}
                </button>
              </div>

              {summaryError && (
                <p className="text-xs text-[#FCA5A5] bg-[#DC2626]/10 border border-[#DC2626]/40 px-3 py-2 rounded-lg">
                  {summaryError}
                </p>
              )}

              <textarea
                rows={4}
                value={resume.content.summary}
                onChange={(e) => updateContent((c) => ({ ...c, summary: e.target.value }))}
                placeholder="Tap 'Write Summary with AI' above to generate a 3-4 line recruiter summary..."
                className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8] leading-relaxed"
              />
            </div>

            <div className="p-4 bg-[#121720] border border-[#232C3B] rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-[#F1F5F9]">Readiness Checklist</h2>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-[#CBD5E1]">
                  <span className={hasContact ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                    {hasContact ? '✓' : '•'}
                  </span>
                  <span>Contact Header</span>
                </div>
                <div className="flex items-center gap-2 text-[#CBD5E1]">
                  <span className={hasEducation ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                    {hasEducation ? '✓' : '•'}
                  </span>
                  <span>Education Details</span>
                </div>
                <div className="flex items-center gap-2 text-[#CBD5E1]">
                  <span className={hasWorkOrProject ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                    {hasWorkOrProject ? '✓' : '•'}
                  </span>
                  <span>Experience / Projects</span>
                </div>
                <div className="flex items-center gap-2 text-[#CBD5E1] font-mono tabular-nums">
                  <span className={coverage.percentage >= 50 ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                    {coverage.percentage >= 50 ? '✓' : '•'}
                  </span>
                  <span>
                    {coverage.matchedCount}/{coverage.totalTracked} Keywords
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#232C3B] flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onExportPdf}
                  disabled={isExporting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-xl transition-colors"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{pdfCtaLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#F1F5F9] border border-[#232C3B] rounded-xl"
                >
                  <FileText className="w-4 h-4" />
                  <span>Preview</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Back / Continue Footer */}
      <div className="pt-3 border-t border-[#232C3B] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={step <= 1}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-medium bg-[#121720] hover:bg-[#181F2B] disabled:opacity-40 text-[#F1F5F9] border border-[#232C3B] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] text-sm font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg transition-colors"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] text-sm font-medium bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{pdfCtaLabel}</span>
          </button>
        )}
      </div>

      {/* Action-Context-Result Bullet Coach Modal */}
      <BulletCoachModal
        isOpen={Boolean(coachTarget)}
        onClose={() => setCoachTarget(null)}
        sectionType={coachTarget?.sectionType || 'experience'}
        roleLabel={roleLabel}
        metricCategories={preset.metricCategories}
        targetKeywords={activeKeywords}
        telegramCtx={telegramCtx}
        onInsertBullet={handleInsertCoachedBullet}
      />
    </div>
  );
}
