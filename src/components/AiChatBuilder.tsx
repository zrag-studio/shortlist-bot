import {
  ArrowRight,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PRESET_LIST, getPresetById } from '../data/presets';
import { chatBuildResumeApi, chatRefineResumeApi } from '../lib/api';
import { TelegramContext, triggerHaptic } from '../lib/telegram';
import {
  ChatQaPayload,
  LayoutMode,
  ResumeContent,
  ResumeRecord,
  TrackPresetId,
} from '../types/resume';

interface AiChatBuilderProps {
  resume: ResumeRecord;
  telegramCtx: TelegramContext;
  onApplyAiResume: (
    content: ResumeContent,
    meta: { roleLabel: string; trackId: TrackPresetId; layoutMode: LayoutMode }
  ) => void;
  onOpenPreview: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  showPreviewCta?: boolean;
}

interface QaStep {
  key: keyof ChatQaPayload;
  question: string;
  placeholder: string;
  optional?: boolean;
  skipLabel?: string;
}

const QA_STEPS: QaStep[] = [
  {
    key: 'roleLabel',
    question:
      'Hi! Let’s build your ATS resume in under 2 minutes. First, what target role are you applying for? Tap a preset below or type your own.',
    placeholder: 'e.g., MBA Finance, Software Engineer, Marketing Analyst...',
  },
  {
    key: 'fullName',
    question: 'Great choice! What is your full name and city?',
    placeholder: 'e.g., Aarav Mehta, Mumbai',
  },
  {
    key: 'contact',
    question: 'Share your phone number, email address, and optional LinkedIn URL.',
    placeholder: 'e.g., +91 98765 43210, aarav@gmail.com, linkedin.com/in/aarav',
  },
  {
    key: 'education',
    question:
      'Tell me your college, degree, graduation year, CGPA/percentage, and any clubs or exam scores.',
    placeholder: 'e.g., MBA Finance, NMIMS Mumbai (2026), 8.6 CGPA, Finance Club Member',
  },
  {
    key: 'experience',
    question:
      'Have you done any internship or job? Share company, role, duration, and 1–2 things you achieved (or skip if you are a fresher).',
    placeholder: 'e.g., Summer Intern at HDFC (May-Jul 2025), analyzed 15 client portfolios...',
    optional: true,
    skipLabel: 'Skip (No internship yet)',
  },
  {
    key: 'projects',
    question:
      'Share 1 or 2 college/live projects — what you built or analyzed, and what you learned.',
    placeholder: 'e.g., DCF Valuation model of Tata Consumer in Excel with sensitivity analysis',
    optional: true,
    skipLabel: 'Skip Projects',
  },
  {
    key: 'skillsAndTools',
    question:
      'Tap the skills & tools you know below, or type them out (e.g., Excel, PowerPoint, SQL, Financial Modeling).',
    placeholder: 'e.g., Financial Modeling, DCF, MS Excel, Power BI, SQL...',
  },
  {
    key: 'certifications',
    question:
      'Last question! Any certifications, bootcamps, or awards? (Optional — or tap Skip to generate your resume right now!)',
    placeholder: 'e.g., NISM Equity Research, Google Analytics, Case Competition Winner',
    optional: true,
    skipLabel: 'Skip & Build Resume Now',
  },
];

function detectTrackFromRole(roleText: string): TrackPresetId {
  const r = roleText.toLowerCase();
  if (r.includes('equity')) return 'equity-research';
  if (r.includes('finance') || r.includes('banking') || r.includes('accounting')) return 'mba-finance';
  if (r.includes('market') || r.includes('brand') || r.includes('growth') || r.includes('sales'))
    return 'mba-marketing';
  if (r.includes('hr') || r.includes('human') || r.includes('talent') || r.includes('recruit'))
    return 'mba-hr';
  if (r.includes('software') || r.includes('developer') || r.includes('engineer') || r.includes('full'))
    return 'tech-swe';
  if (r.includes('data') || r.includes('analyst') || r.includes('business')) return 'tech-data';
  return 'custom';
}

export function AiChatBuilder({
  resume,
  telegramCtx,
  onApplyAiResume,
  onOpenPreview,
}: AiChatBuilderProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(resume.layoutMode);
  const [answers, setAnswers] = useState<ChatQaPayload>({
    roleLabel: '',
    layoutMode: resume.layoutMode,
    fullName: '',
    city: '',
    contact: '',
    education: '',
    experience: '',
    projects: '',
    skillsAndTools: '',
    certifications: '',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-welcome',
      sender: 'assistant',
      text: QA_STEPS[0].question,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBuilding]);

  const detectedTrackId = detectTrackFromRole(answers.roleLabel || 'MBA Finance');
  const suggestedSkillChips = getPresetById(detectedTrackId)
    .starterKeywords.slice(0, 10)
    .map((k) => k.term);

  const handleRestart = () => {
    setStepIdx(0);
    setIsCompleted(false);
    setErrorMsg(null);
    setInputValue('');
    setAnswers({
      roleLabel: '',
      layoutMode,
      fullName: '',
      city: '',
      contact: '',
      education: '',
      experience: '',
      projects: '',
      skillsAndTools: '',
      certifications: '',
    });
    setMessages([{ id: `m-${Date.now()}`, sender: 'assistant', text: QA_STEPS[0].question }]);
  };

  const triggerFinalGeneration = async (finalQa: ChatQaPayload) => {
    setIsBuilding(true);
    setErrorMsg(null);
    try {
      const res = await chatBuildResumeApi(telegramCtx, finalQa);
      const trackId = detectTrackFromRole(finalQa.roleLabel);
      if (res.content) {
        onApplyAiResume(res.content, {
          roleLabel: finalQa.roleLabel,
          trackId,
          layoutMode: finalQa.layoutMode,
        });
      }
      setIsCompleted(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-done-${Date.now()}`,
          sender: 'assistant',
          text:
            res.assistantMessage ||
            'Your ATS-ready resume is built! Tap Preview below to check it and download your PDF, or send a quick tweak request here.',
          showPreviewCta: true,
        },
      ]);
      triggerHaptic('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate resume right now.';
      setErrorMsg(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-err-${Date.now()}`,
          sender: 'assistant',
          text: `I hit a snag: ${msg} You can tap Retry below without re-typing your answers.`,
        },
      ]);
    } finally {
      setIsBuilding(false);
    }
  };

  const submitAnswer = async (rawText: string, skipped = false) => {
    const clean = rawText.trim();
    if (!skipped && !clean) return;
    setErrorMsg(null);

    // Post-completion quick refinement flow
    if (isCompleted) {
      if (!clean) return;
      setInputValue('');
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text: clean }]);
      setIsBuilding(true);
      try {
        const res = await chatRefineResumeApi(telegramCtx, {
          roleLabel: answers.roleLabel || resume.title,
          instruction: clean,
          content: resume.content,
        });
        if (res.content) {
          onApplyAiResume(res.content, {
            roleLabel: answers.roleLabel || resume.title,
            trackId: detectTrackFromRole(answers.roleLabel || resume.title),
            layoutMode,
          });
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: res.assistantMessage || 'Updated your resume! Check the Preview tab anytime.',
            showPreviewCta: true,
          },
        ]);
        triggerHaptic('success');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not apply tweak.');
      } finally {
        setIsBuilding(false);
      }
      return;
    }

    const currentStep = QA_STEPS[stepIdx];
    const displayReply = skipped ? 'Skipped' : clean;

    const nextAnswers: ChatQaPayload = { ...answers, layoutMode };
    if (currentStep.key === 'fullName') {
      const parts = clean.split(/[,|-]/).map((s) => s.trim());
      nextAnswers.fullName = parts[0] || clean;
      nextAnswers.city = parts.slice(1).join(', ');
    } else if (currentStep.key !== 'layoutMode') {
      nextAnswers[currentStep.key] = skipped ? '' : clean;
    }

    setAnswers(nextAnswers);
    setInputValue('');
    triggerHaptic('light');

    const nextIdx = stepIdx + 1;
    if (nextIdx < QA_STEPS.length) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, sender: 'user', text: displayReply },
        { id: `a-${Date.now() + 1}`, sender: 'assistant', text: QA_STEPS[nextIdx].question },
      ]);
      setStepIdx(nextIdx);
      inputRef.current?.focus();
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, sender: 'user', text: displayReply },
      ]);
      await triggerFinalGeneration(nextAnswers);
    }
  };

  const appendChipToInput = (chip: string) => {
    setInputValue((prev) => {
      const list = prev
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.some((x) => x.toLowerCase() === chip.toLowerCase())) {
        return list.filter((x) => x.toLowerCase() !== chip.toLowerCase()).join(', ');
      }
      return [...list, chip].join(', ');
    });
  };

  const currentStep = QA_STEPS[stepIdx];
  const progressPct = isCompleted
    ? 100
    : Math.round((stepIdx / QA_STEPS.length) * 100);

  return (
    <div className="flex flex-col h-[calc(100vh-146px)] md:h-[calc(100vh-104px)] max-w-3xl mx-auto bg-[#121720] border border-[#232C3B] rounded-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3.5 border-b border-[#232C3B] flex items-center justify-between gap-3 bg-[#0A0D12]/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB]/15 border border-[#38BDF8]/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#F1F5F9] truncate">AI Resume Chat</h1>
            <p className="text-xs text-[#94A3B8] font-mono tabular-nums">
              {isCompleted
                ? 'Resume Ready · Send a tweak or open Preview'
                : `Question ${stepIdx + 1} of ${QA_STEPS.length} · ${progressPct}%`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRestart}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] bg-[#181F2B] border border-[#232C3B] rounded-lg whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Subtle Progress Line */}
      <div className="h-0.5 bg-[#0A0D12] w-full">
        <div
          className="h-full bg-[#38BDF8] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] sm:max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-[#2563EB] text-white rounded-br-sm'
                  : 'bg-[#0A0D12] border border-[#232C3B] text-[#F1F5F9] rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>

              {msg.showPreviewCta && (
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Preview &amp; Download PDF</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Step 1 Inline Quick-Select Presets & Experience Level */}
        {!isCompleted && stepIdx === 0 && !isBuilding && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              {(
                [
                  { id: 'fresher' as LayoutMode, label: 'Fresher / Student' },
                  { id: 'switcher' as LayoutMode, label: 'Experienced' },
                ] as const
              ).map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setLayoutMode(lvl.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    layoutMode === lvl.id
                      ? 'bg-[#181F2B] border-[#38BDF8] text-[#F1F5F9]'
                      : 'bg-[#0A0D12] border-[#232C3B] text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_LIST.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => submitAnswer(p.shortName)}
                  className="px-3 py-2 min-h-[40px] text-xs font-medium bg-[#0A0D12] hover:bg-[#2563EB] text-[#CBD5E1] hover:text-white border border-[#232C3B] hover:border-[#38BDF8] rounded-xl transition-colors"
                >
                  {p.shortName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 7 Quick-Tap Skill Chips */}
        {!isCompleted && stepIdx === 6 && !isBuilding && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestedSkillChips.map((chip) => {
              const selected = inputValue.toLowerCase().includes(chip.toLowerCase());
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendChipToInput(chip)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selected
                      ? 'bg-[#2563EB] border-[#38BDF8] text-white'
                      : 'bg-[#0A0D12] border-[#232C3B] text-[#CBD5E1] hover:border-[#38BDF8]'
                  }`}
                >
                  {selected ? '✓ ' : '+ '}
                  {chip}
                </button>
              );
            })}
          </div>
        )}

        {/* Generating Indicator */}
        {isBuilding && (
          <div className="flex items-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[#0A0D12] border border-[#232C3B] text-xs text-[#38BDF8] inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Crafting your ATS resume with impact bullets...</span>
            </div>
          </div>
        )}

        {/* Retry button if single-call generation failed */}
        {errorMsg && !isCompleted && stepIdx >= QA_STEPS.length - 1 && !isBuilding && (
          <div className="flex items-start">
            <button
              type="button"
              onClick={() => triggerFinalGeneration(answers)}
              className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg"
            >
              Retry Resume Generation
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer Bar */}
      <div className="p-3 border-t border-[#232C3B] bg-[#0A0D12]/80 space-y-2">
        {!isCompleted && currentStep?.optional && !isBuilding && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => submitAnswer('', true)}
              className="text-xs font-medium text-[#38BDF8] hover:underline px-1"
            >
              {currentStep.skipLabel || 'Skip this step'} →
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputValue}
            disabled={isBuilding}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitAnswer(inputValue);
              }
            }}
            placeholder={
              isCompleted
                ? 'Optional tweak (e.g., "Make summary sharper" or "Add SQL to tools")...'
                : currentStep?.placeholder || 'Type your answer...'
            }
            className="flex-1 bg-[#121720] border border-[#232C3B] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8] resize-none"
          />
          <button
            type="button"
            onClick={() => submitAnswer(inputValue)}
            disabled={isBuilding || !inputValue.trim()}
            aria-label="Send answer"
            className="min-h-[48px] min-w-[48px] px-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white rounded-xl inline-flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
