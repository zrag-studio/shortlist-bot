import { Check, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { coachBulletApi } from '../lib/api';
import { parseBoldSegments } from '../lib/atsMatcher';
import { TelegramContext } from '../lib/telegram';
import { MetricCategory } from '../types/resume';

interface BulletCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionType: 'experience' | 'project';
  roleLabel: string;
  metricCategories: MetricCategory[];
  targetKeywords: string[];
  telegramCtx: TelegramContext;
  onInsertBullet: (bulletText: string) => void;
}

export function BulletCoachModal({
  isOpen,
  onClose,
  sectionType,
  roleLabel,
  metricCategories,
  targetKeywords,
  telegramCtx,
  onInsertBullet,
}: BulletCoachModalProps) {
  const [rawNotes, setRawNotes] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{
      bulletText: string;
      actionPart: string;
      contextPart: string;
      resultPart: string;
    }>
  >([]);

  if (!isOpen) return null;

  const toggleMetric = (prompt: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(prompt) ? prev.filter((p) => p !== prompt) : [...prev.slice(-4), prompt]
    );
  };

  const handleGenerate = async () => {
    if (rawNotes.trim().length < 5) {
      setError('Describe briefly what you worked on (e.g., "analyzed 15 company balance sheets in Excel").');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await coachBulletApi(telegramCtx, {
        roleLabel,
        sectionType,
        rawNotes: rawNotes.trim(),
        selectedMetrics,
        targetKeywords,
      });
      setSuggestions(result.bullets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to coach bullet right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Action Context Result Bullet Coach"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#121720] border border-[#232C3B] rounded-t-2xl md:rounded-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#232C3B] flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#F1F5F9]">
              Action · Context · Result Bullet Coach
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {sectionType === 'project'
                ? 'Show what you built/analyzed and what practical skill you learned.'
                : 'Turn raw responsibilities into quantified, impact-driven recruiter bullets.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bullet coach"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#181F2B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Input Rough Notes */}
          <div>
            <label className="block text-sm font-medium text-[#F1F5F9] mb-1.5">
              1. Explain in plain English what you did (and any numbers you have)
            </label>
            <textarea
              rows={3}
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder={
                sectionType === 'project'
                  ? 'Example: Built a DCF valuation model for DMart in Excel, compared 4 retail peers, learned sensitivity analysis.'
                  : 'Example: Screened 200 resumes on Naukri and LinkedIn for tech roles, scheduled 40 interviews, cut time to fill by 20%.'
              }
              className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          {/* Role-Specific Metric Prompts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#F1F5F9]">
                2. Optional: Tap numbers/metrics that fit your work ({roleLabel})
              </label>
              <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                {selectedMetrics.length} selected
              </span>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {metricCategories.map((cat) => (
                <div key={cat.title}>
                  <p className="text-xs font-medium text-[#94A3B8] mb-1.5">{cat.title}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {cat.prompts.map((prompt) => {
                      const active = selectedMetrics.includes(prompt);
                      return (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => toggleMetric(prompt)}
                          className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors flex items-start gap-2 ${
                            active
                              ? 'bg-[#2563EB]/15 border-[#38BDF8] text-[#F1F5F9]'
                              : 'bg-[#0A0D12] border-[#232C3B] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#334155]'
                          }`}
                        >
                          <span className="mt-0.5 shrink-0">
                            {active ? (
                              <Check className="w-3.5 h-3.5 text-[#38BDF8]" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-[#64748B]" />
                            )}
                          </span>
                          <span>{prompt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/40 text-xs text-[#FCA5A5]">
              {error}
            </div>
          )}

          {/* Action Trigger */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Coaching 3 Action-Context-Result Options...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate 3 Impact-Driven Bullets</span>
              </>
            )}
          </button>

          {/* AI Output Options */}
          {suggestions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#232C3B]">
              <p className="text-xs font-medium text-[#94A3B8]">
                Pick a bullet to add directly to your resume:
              </p>
              {suggestions.map((opt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-lg space-y-2.5"
                >
                  <p className="text-sm text-[#F1F5F9] leading-relaxed">
                    {parseBoldSegments(opt.bulletText).map((s, si) =>
                      s.bold ? (
                        <strong key={si} className="font-semibold text-white">
                          {s.text}
                        </strong>
                      ) : (
                        <span key={si}>{s.text}</span>
                      )
                    )}
                  </p>
                  <div className="text-xs text-[#94A3B8] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Action: {opt.actionPart}</span>
                    <span aria-hidden="true">·</span>
                    <span>Context: {opt.contextPart}</span>
                    <span aria-hidden="true">·</span>
                    <span>Result: {opt.resultPart}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onInsertBullet(opt.bulletText);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[#181F2B] hover:bg-[#2563EB] text-[#F1F5F9] hover:text-white border border-[#232C3B] rounded-md transition-colors"
                  >
                    Insert Bullet
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
