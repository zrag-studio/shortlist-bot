import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { extractPublicAdId } from '../lib/ads';
import {
  claimAdminPassword,
  fetchAdminAuthStatus,
  fetchAdminConfig,
  loginAdmin,
  saveAdminConfig,
  testAdminAi,
  testAdminChannel,
} from '../lib/api';
import {
  AdNetworksConfig,
  AdminConfigResponse,
  AiProviderKind,
  AiRouterConfig,
  AiSlotConfig,
} from '../types/resume';

interface AdminPanelProps {
  onExitAdmin: () => void;
  onPublicConfigUpdated: () => void;
}

const PROVIDER_META: Record<
  AiProviderKind,
  { name: string; freeTierNote: string; secretEnv: string; models: string[] }
> = {
  workers_ai: {
    name: 'Cloudflare Workers AI',
    freeTierNote: '10,000 Neurons/day free via [ai] binding',
    secretEnv: 'Workers AI binding (AI)',
    models: [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen2.5-coder-32b-instruct',
    ],
  },
  gemini: {
    name: 'Google Gemini',
    freeTierNote: 'Free tier via Google AI Studio',
    secretEnv: 'GEMINI_API_KEY',
    models: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
  },
  groq: {
    name: 'Groq Free Tier',
    freeTierNote: 'Ultra-fast free tier (~14,400 req/day)',
    secretEnv: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  openrouter: {
    name: 'OpenRouter Free',
    freeTierNote: 'Free-tier open models via OpenRouter',
    secretEnv: 'OPENROUTER_API_KEY',
    models: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
      'qwen/qwen-2.5-72b-instruct:free',
    ],
  },
  cerebras: {
    name: 'Cerebras Free',
    freeTierNote: 'Fast free inference via Cerebras Cloud',
    secretEnv: 'CEREBRAS_API_KEY',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
  },
};

const PROVIDER_LIST: AiProviderKind[] = [
  'workers_ai',
  'gemini',
  'groq',
  'openrouter',
  'cerebras',
];

const DEPLOY_CHECKLIST = `# 1. Create Free Cloudflare D1 Database
npx wrangler d1 create shortlist-studio-db

# 2. Paste your database_id into wrangler.toml, then push to GitHub.
# 3. Connect GitHub repo to Cloudflare Pages:
#    - Build command: npm run build
#    - Build output directory: dist
#    - Bindings: D1 Database -> variable "DB" | Workers AI -> variable "AI"
# 4. Add Encrypted Environment Variables in Cloudflare Pages Settings:
#    - ADMIN_PASSWORD (secret admin panel password)
#    - GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY / CEREBRAS_API_KEY (rotating free AI slots)
#    - TELEGRAM_BOT_TOKEN (from @BotFather)
#    - TELEGRAM_ARCHIVE_CHANNEL_ID (private channel ID like -100xxxxxxxxxx; make bot Admin in channel)
# 5. In @BotFather -> /newapp or Menu Button -> set Web App URL to your *.pages.dev URL.`;

function isSecretConfigured(
  provider: AiProviderKind,
  status: AdminConfigResponse['secretStatus']
): boolean {
  switch (provider) {
    case 'workers_ai':
      return status.workersAiConfigured;
    case 'gemini':
      return status.geminiConfigured;
    case 'groq':
      return status.groqConfigured;
    case 'openrouter':
      return status.openrouterConfigured;
    case 'cerebras':
      return status.cerebrasConfigured;
  }
}

function formatLastSeen(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AdminPanel({ onExitAdmin, onPublicConfigUpdated }: AdminPanelProps) {
  // Admin Bearer token strictly in memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    loading: boolean;
    needsInitialClaim: boolean;
    adminPasswordFromEnv: boolean;
  }>({ loading: true, needsInitialClaim: false, adminPasswordFromEnv: false });

  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [config, setConfig] = useState<AdminConfigResponse | null>(null);
  const [aiDraft, setAiDraft] = useState<AiRouterConfig | null>(null);
  const [adsDraft, setAdsDraft] = useState<AdNetworksConfig | null>(null);
  const [botDraft, setBotDraft] = useState<{
    appName: string;
    botUsername: string;
    archiveChannelId: string;
  } | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingSlotId, setTestingSlotId] = useState<string | null>(null);
  const [isTestingChannel, setIsTestingChannel] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedChecklist, setCopiedChecklist] = useState(false);

  useEffect(() => {
    fetchAdminAuthStatus()
      .then((res) =>
        setAuthStatus({
          loading: false,
          needsInitialClaim: res.needsInitialClaim,
          adminPasswordFromEnv: res.adminPasswordFromEnv,
        })
      )
      .catch(() =>
        setAuthStatus({ loading: false, needsInitialClaim: false, adminPasswordFromEnv: false })
      );
  }, []);

  const loadConfig = async (activeToken: string) => {
    setIsLoadingConfig(true);
    setFeedback(null);
    try {
      const data = await fetchAdminConfig(activeToken);
      setConfig(data);
      setAiDraft(data.ai);
      setAdsDraft(data.ads);
      setBotDraft(data.bot);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to load admin configuration.',
      });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (authStatus.needsInitialClaim) {
      if (passwordInput.trim().length < 8) {
        setAuthError('Password must be at least 8 characters.');
        return;
      }
      if (passwordInput !== confirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }
    }

    setAuthSubmitting(true);
    try {
      const res = authStatus.needsInitialClaim
        ? await claimAdminPassword(passwordInput.trim())
        : await loginAdmin(passwordInput);
      setToken(res.token);
      setPasswordInput('');
      setConfirmPassword('');
      await loadConfig(res.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSaveAll = async () => {
    if (!token || !aiDraft || !adsDraft || !botDraft) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAdminConfig(token, { ai: aiDraft, ads: adsDraft, bot: botDraft });
      setFeedback({ type: 'ok', text: 'Settings saved to database.' });
      onPublicConfigUpdated();
      await loadConfig(token);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not save settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAi = async (slotId?: string) => {
    if (!token) return;
    setTestingSlotId(slotId || 'rotation');
    setFeedback(null);
    try {
      const res = await testAdminAi(token, slotId);
      const provName = PROVIDER_META[res.providerUsed as AiProviderKind]?.name || res.providerUsed;
      setFeedback({
        type: 'ok',
        text: `AI test succeeded via ${res.slotUsed} (${provName}).`,
      });
      await loadConfig(token);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'AI test failed.',
      });
    } finally {
      setTestingSlotId(null);
    }
  };

  const handleTestChannel = async () => {
    if (!token) return;
    setIsTestingChannel(true);
    setFeedback(null);
    try {
      if (aiDraft && adsDraft && botDraft) {
        await saveAdminConfig(token, { ai: aiDraft, ads: adsDraft, bot: botDraft });
      }
      await testAdminChannel(token);
      setFeedback({
        type: 'ok',
        text: 'Private Telegram archive channel verified! Test message sent to your channel.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Channel verification failed.',
      });
    } finally {
      setIsTestingChannel(false);
    }
  };

  const moveSlot = (index: number, delta: -1 | 1) => {
    if (!aiDraft) return;
    const next = [...aiDraft.slots];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setAiDraft({ ...aiDraft, slots: next });
  };

  const updateSlot = (slotId: string, patch: Partial<AiSlotConfig>) => {
    if (!aiDraft) return;
    setAiDraft({
      ...aiDraft,
      slots: aiDraft.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
    });
  };

  const handleCopyChecklist = async () => {
    try {
      await navigator.clipboard.writeText(DEPLOY_CHECKLIST);
      setCopiedChecklist(true);
      setTimeout(() => setCopiedChecklist(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const filteredUsers = useMemo(() => {
    const list = config?.users || [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.userId.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q)
    );
  }, [config?.users, userSearch]);

  // --- Auth Gate (Claim or Sign In) ---
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0A0D12] text-[#F1F5F9] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121720] border border-[#232C3B] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#2563EB]/15 border border-[#38BDF8]/30 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-[#38BDF8]" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#F1F5F9]">
                  {authStatus.needsInitialClaim ? 'Claim Admin Password' : 'Admin Sign In'}
                </h1>
                <p className="text-xs text-[#94A3B8]">Shortlist Studio Control Panel</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs text-[#94A3B8] hover:text-[#F1F5F9] inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
          </div>

          {authStatus.loading ? (
            <div className="py-8 flex items-center justify-center text-xs text-[#94A3B8] gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking admin status...</span>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authStatus.needsInitialClaim && (
                <p className="text-xs text-[#CBD5E1] bg-[#0A0D12] border border-[#232C3B] rounded-lg p-3 leading-relaxed">
                  First-time setup: choose a strong admin password (8+ characters) to lock this
                  panel. You can also set{' '}
                  <code className="font-mono text-[#38BDF8]">ADMIN_PASSWORD</code> in server secrets.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              {authStatus.needsInitialClaim && (
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>
              )}

              {authError && (
                <p className="text-xs text-[#FCA5A5] bg-[#DC2626]/10 border border-[#DC2626]/40 px-3 py-2 rounded-lg">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2"
              >
                {authSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>{authStatus.needsInitialClaim ? 'Set Password & Enter' : 'Unlock Admin'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F1F5F9] pb-16">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 h-15 bg-[#0A0D12]/95 backdrop-blur-md border-b border-[#232C3B]">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to App</span>
            </button>
            <span className="text-[#232C3B]">|</span>
            <h1 className="text-sm sm:text-base font-bold text-[#F1F5F9]">Admin Control Panel</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || !aiDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
            <button
              type="button"
              onClick={() => setToken(null)}
              aria-label="Sign out"
              className="p-2 text-[#94A3B8] hover:text-white bg-[#121720] border border-[#232C3B] rounded-lg"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {feedback && (
          <div
            className={`px-4 py-3 rounded-xl border text-xs ${
              feedback.type === 'ok'
                ? 'bg-[#16A34A]/10 border-[#16A34A]/40 text-[#86EFAC]'
                : 'bg-[#DC2626]/10 border-[#DC2626]/40 text-[#FCA5A5]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {isLoadingConfig || !config || !aiDraft || !adsDraft || !botDraft ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#94A3B8]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW METRICS */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F1F5F9]">1. Overview Metrics</h2>
                <button
                  type="button"
                  onClick={() => loadConfig(token)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#38BDF8]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Total Users', value: config.stats.totalUsers },
                  { label: 'Resumes Saved', value: config.stats.resumesSaved },
                  { label: 'PDFs Exported', value: config.stats.pdfsGenerated },
                  { label: 'AI Chats Total', value: config.stats.aiChatsTotal },
                  { label: 'AI Chats Today', value: config.stats.aiChatsToday },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="p-4 bg-[#121720] border border-[#232C3B] rounded-xl"
                  >
                    <p className="text-xs text-[#94A3B8]">{kpi.label}</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-[#F1F5F9] mt-1">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. PER-USER ANALYTICS TABLE */}
            <section className="p-5 bg-[#121720] border border-[#232C3B] rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#38BDF8]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[#F1F5F9]">
                      2. User Analytics (1 AI Chat = 1 Unit)
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      Track resumes created, PDFs downloaded, and AI chats used per user.
                    </p>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filter by user ID or name..."
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#94A3B8] border border-dashed border-[#232C3B] rounded-lg">
                  No user activity recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#232C3B] rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0A0D12] border-b border-[#232C3B] text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3 text-right">Resumes</th>
                        <th className="py-2.5 px-3 text-right">PDFs</th>
                        <th className="py-2.5 px-3 text-right">AI Chats (Total)</th>
                        <th className="py-2.5 px-3 text-right">AI Chats (Today)</th>
                        <th className="py-2.5 px-3 text-right">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232C3B] text-xs">
                      {filteredUsers.map((u) => (
                        <tr key={u.userId} className="hover:bg-[#181F2B]/50">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-[#F1F5F9]">
                              {u.firstName || (u.username ? `@${u.username}` : u.userId)}
                            </div>
                            <div className="text-[11px] font-mono text-[#64748B]">
                              {u.username ? `@${u.username} · ` : ''}
                              {u.userId}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#CBD5E1]">
                            {u.resumesMade}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#CBD5E1]">
                            {u.pdfsDownloaded}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#38BDF8] font-semibold">
                            {u.aiChatsTotal}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#CBD5E1]">
                            {u.aiChatsToday}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#94A3B8]">
                            {formatLastSeen(u.lastSeenAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 3. 5-SLOT AUTO-ROTATING FREE AI ENGINE */}
            <section className="p-5 bg-[#121720] border border-[#232C3B] rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#F1F5F9]">
                    3. 5-Slot Auto-Rotating Free AI Engine
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    When a slot hits rate limits (HTTP 429) or token exhaustion, the router cools it
                    down and automatically rotates to the next enabled slot. Provider keys live
                    safely in server secrets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTestAi()}
                  disabled={testingSlotId !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#38BDF8] border border-[#232C3B] rounded-lg"
                >
                  {testingSlotId === 'rotation' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Test Rotation</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {aiDraft.slots.map((slot, idx) => {
                  const meta = PROVIDER_META[slot.provider];
                  const configured = isSecretConfigured(slot.provider, config.secretStatus);
                  const isCooling =
                    Boolean(slot.cooldownUntil) &&
                    new Date(slot.cooldownUntil as string).getTime() > Date.now();

                  return (
                    <div
                      key={slot.id}
                      className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-xl flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-[230px]">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSlot(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Move slot priority up"
                            className="p-1 text-[#94A3B8] hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSlot(idx, 1)}
                            disabled={idx === aiDraft.slots.length - 1}
                            aria-label="Move slot priority down"
                            className="p-1 text-[#94A3B8] hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-[#38BDF8]">
                              Slot #{idx + 1}
                            </span>
                            <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                              · {slot.callsCount} calls
                            </span>
                            <span
                              className={`text-[11px] font-medium ${
                                configured ? 'text-[#16A34A]' : 'text-[#D97706]'
                              }`}
                            >
                              · {configured ? 'Secret Configured' : `${meta.secretEnv} Not Set`}
                            </span>
                            {isCooling && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateSlot(slot.id, { cooldownUntil: null, lastError: '' })
                                }
                                className="text-[11px] text-[#FCA5A5] underline hover:text-white"
                              >
                                Cooldown active (Clear)
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B]">
                            {slot.lastError ? `Last error: ${slot.lastError}` : meta.freeTierNote}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <select
                          aria-label={`Slot ${idx + 1} provider`}
                          value={slot.provider}
                          onChange={(e) => {
                            const nextProvider = e.target.value as AiProviderKind;
                            updateSlot(slot.id, {
                              provider: nextProvider,
                              label: PROVIDER_META[nextProvider].name,
                              model: PROVIDER_META[nextProvider].models[0],
                              cooldownUntil: null,
                            });
                          }}
                          className="bg-[#121720] border border-[#232C3B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9]"
                        >
                          {PROVIDER_LIST.map((p) => (
                            <option key={p} value={p}>
                              {PROVIDER_META[p].name}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Slot ${idx + 1} model`}
                          value={slot.model}
                          onChange={(e) => updateSlot(slot.id, { model: e.target.value })}
                          className="bg-[#121720] border border-[#232C3B] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F1F5F9] max-w-[230px]"
                        >
                          {Array.from(new Set([slot.model, ...meta.models])).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>

                        <label className="inline-flex items-center gap-1.5 text-xs text-[#CBD5E1] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={slot.enabled}
                            onChange={(e) => updateSlot(slot.id, { enabled: e.target.checked })}
                            className="accent-[#2563EB] w-4 h-4"
                          />
                          <span>On</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleTestAi(slot.id)}
                          disabled={testingSlotId !== null}
                          className="px-2.5 py-1.5 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#CBD5E1] border border-[#232C3B] rounded-lg"
                        >
                          {testingSlotId === slot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Test'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <label className="text-xs font-medium text-[#94A3B8]">
                  Daily AI Chats Limit per User:
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={aiDraft.dailyChatsLimitPerUser}
                  onChange={(e) =>
                    setAiDraft({
                      ...aiDraft,
                      dailyChatsLimitPerUser: Math.max(1, Number(e.target.value) || 20),
                    })
                  }
                  className="w-24 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F1F5F9]"
                />
              </div>
            </section>

            {/* 4. AD NETWORKS (UNLOCK PDF DOWNLOAD) */}
            <section className="p-5 bg-[#121720] border border-[#232C3B] rounded-xl space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[#F1F5F9]">
                  4. Ad Networks (Unlock PDF Download Button)
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Users watch 1 rewarded/interstitial ad when clicking Download PDF. Paste either a
                  raw public ID or the full &lt;script&gt; snippet.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* AdsGram */}
                <div className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F1F5F9]">AdsGram</span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <input
                        type="checkbox"
                        checked={adsDraft.adsgram.enabled}
                        onChange={(e) =>
                          setAdsDraft({
                            ...adsDraft,
                            adsgram: { ...adsDraft.adsgram, enabled: e.target.checked },
                          })
                        }
                        className="accent-[#2563EB]"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={adsDraft.adsgram.blockId}
                    onChange={(e) =>
                      setAdsDraft({
                        ...adsDraft,
                        adsgram: {
                          ...adsDraft.adsgram,
                          blockId: extractPublicAdId(e.target.value, 'adsgram'),
                        },
                      })
                    }
                    placeholder="Block ID (e.g., int-1234 or paste snippet)"
                    className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-[#64748B]"
                  />
                </div>

                {/* CleanAds Rewarded */}
                <div className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F1F5F9]">CleanAds Rewarded</span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <input
                        type="checkbox"
                        checked={adsDraft.cleanadsRewarded.enabled}
                        onChange={(e) =>
                          setAdsDraft({
                            ...adsDraft,
                            cleanadsRewarded: {
                              ...adsDraft.cleanadsRewarded,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="accent-[#2563EB]"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={adsDraft.cleanadsRewarded.placementId}
                    onChange={(e) =>
                      setAdsDraft({
                        ...adsDraft,
                        cleanadsRewarded: {
                          ...adsDraft.cleanadsRewarded,
                          placementId: extractPublicAdId(e.target.value, 'cleanads'),
                        },
                      })
                    }
                    placeholder="Rewarded Placement ID"
                    className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-[#64748B]"
                  />
                </div>

                {/* CleanAds Interstitial */}
                <div className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F1F5F9]">
                      CleanAds Interstitial
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <input
                        type="checkbox"
                        checked={adsDraft.cleanadsInterstitial.enabled}
                        onChange={(e) =>
                          setAdsDraft({
                            ...adsDraft,
                            cleanadsInterstitial: {
                              ...adsDraft.cleanadsInterstitial,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="accent-[#2563EB]"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={adsDraft.cleanadsInterstitial.placementId}
                    onChange={(e) =>
                      setAdsDraft({
                        ...adsDraft,
                        cleanadsInterstitial: {
                          ...adsDraft.cleanadsInterstitial,
                          placementId: extractPublicAdId(e.target.value, 'cleanads'),
                        },
                      })
                    }
                    placeholder="Interstitial Placement ID"
                    className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-[#64748B]"
                  />
                </div>

                {/* Monetag */}
                <div className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F1F5F9]">Monetag Mini App</span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <input
                        type="checkbox"
                        checked={adsDraft.monetag.enabled}
                        onChange={(e) =>
                          setAdsDraft({
                            ...adsDraft,
                            monetag: { ...adsDraft.monetag, enabled: e.target.checked },
                          })
                        }
                        className="accent-[#2563EB]"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={adsDraft.monetag.zoneId}
                    onChange={(e) =>
                      setAdsDraft({
                        ...adsDraft,
                        monetag: {
                          ...adsDraft.monetag,
                          zoneId: extractPublicAdId(e.target.value, 'monetag'),
                        },
                      })
                    }
                    placeholder="Numeric Zone ID (e.g., 9012345 or paste <script>)"
                    className="w-full bg-[#121720] border border-[#232C3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-[#64748B]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#232C3B] flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#CBD5E1]">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={adsDraft.triggers.onPdfExport}
                      onChange={(e) =>
                        setAdsDraft({
                          ...adsDraft,
                          triggers: { onPdfExport: e.target.checked },
                        })
                      }
                      className="accent-[#2563EB]"
                    />
                    <span>Require Ad to Unlock PDF Download</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[#38BDF8]">
                    <input
                      type="checkbox"
                      checked={adsDraft.cleanadsTestMode}
                      onChange={(e) =>
                        setAdsDraft({ ...adsDraft, cleanadsTestMode: e.target.checked })
                      }
                      className="accent-[#2563EB]"
                    />
                    <span>CleanAds Test Mode</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                  <span>Cooldown (min):</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={adsDraft.cooldownMinutes}
                    onChange={(e) =>
                      setAdsDraft({
                        ...adsDraft,
                        cooldownMinutes: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-18 bg-[#0A0D12] border border-[#232C3B] rounded-lg px-2.5 py-1 text-xs font-mono text-[#F1F5F9]"
                  />
                </div>
              </div>
            </section>

            {/* 5. PRIVATE TELEGRAM ARCHIVE CHANNEL & DEPLOYMENT */}
            <section className="p-5 bg-[#121720] border border-[#232C3B] rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#F1F5F9]">
                    5. Private Telegram Storage Channel &amp; Bot Settings
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Every PDF downloaded by users is silently backed up to your private Telegram
                    channel server-side (invisible to end users). Bot token status:{' '}
                    <span
                      className={
                        config.secretStatus.telegramBotConfigured
                          ? 'text-[#16A34A] font-medium'
                          : 'text-[#D97706] font-medium'
                      }
                    >
                      {config.secretStatus.telegramBotConfigured
                        ? 'TELEGRAM_BOT_TOKEN Configured'
                        : 'TELEGRAM_BOT_TOKEN Not Set in Server Secrets'}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestChannel}
                  disabled={isTestingChannel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#181F2B] hover:bg-[#232C3B] text-[#38BDF8] border border-[#232C3B] rounded-lg"
                >
                  {isTestingChannel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Test Private Channel</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">Mini App Display Name</label>
                  <input
                    type="text"
                    value={botDraft.appName}
                    onChange={(e) => setBotDraft({ ...botDraft, appName: e.target.value })}
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">
                    Bot Username (without @)
                  </label>
                  <input
                    type="text"
                    value={botDraft.botUsername}
                    onChange={(e) => setBotDraft({ ...botDraft, botUsername: e.target.value })}
                    placeholder="ShortlistStudioBot"
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">
                    Private Archive Channel ID
                  </label>
                  <input
                    type="text"
                    value={botDraft.archiveChannelId}
                    onChange={(e) =>
                      setBotDraft({ ...botDraft, archiveChannelId: e.target.value })
                    }
                    placeholder="-1001234567890"
                    className="w-full bg-[#0A0D12] border border-[#232C3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F1F5F9] placeholder:text-[#64748B]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#232C3B]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#CBD5E1]">
                    Cloudflare Pages + D1 + Workers AI Checklist
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyChecklist}
                    className="inline-flex items-center gap-1.5 text-xs text-[#38BDF8] hover:underline"
                  >
                    {copiedChecklist ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedChecklist ? 'Copied' : 'Copy Checklist'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-[#0A0D12] border border-[#232C3B] rounded-lg text-[11px] font-mono text-[#94A3B8] overflow-x-auto leading-relaxed">
                  {DEPLOY_CHECKLIST}
                </pre>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
