export type TrackPresetId =
  | 'mba-finance'
  | 'equity-research'
  | 'mba-marketing'
  | 'mba-hr'
  | 'tech-swe'
  | 'tech-data'
  | 'custom';

export type LayoutMode = 'fresher' | 'switcher';

export type AtsFontFamily = 'times' | 'arial';

export type WorkspaceTab = 'build' | 'ai-chat' | 'preview';

export interface ResumeHeader {
  fullName: string;
  targetTitle: string;
  phone: string;
  email: string;
  location: string;
  linkedinUrl: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  location: string;
  degree: string;
  graduationYear: string;
  gpaOrScore: string;
  highlights: string[];
}

export interface ExperienceEntry {
  id: string;
  organization: string;
  location: string;
  roleTitle: string;
  duration: string;
  bullets: string[];
}

export interface ProjectEntry {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
}

export interface CertificationEntry {
  id: string;
  title: string;
  issuerOrYear: string;
  bullets: string[];
}

export interface VirtualExperienceEntry {
  id: string;
  title: string;
  bullets: string[];
}

export interface ResumeContent {
  header: ResumeHeader;
  summary: string;
  coreExpertise: string[];
  tools: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  virtualExperience: VirtualExperienceEntry[];
}

export interface ResumeRecord {
  id: string;
  userId: string;
  title: string;
  trackId: TrackPresetId;
  customRoleName: string;
  layoutMode: LayoutMode;
  fontFamily: AtsFontFamily;
  fontSizePt: number;
  currentStep: number;
  content: ResumeContent;
  updatedAt: string;
}

export type KeywordTier = 'must-have' | 'high-frequency' | 'differentiator';
export type KeywordCategory = 'core' | 'tool' | 'action-verb' | 'responsibility';

export interface KeywordItem {
  term: string;
  category: KeywordCategory;
  frequency: number;
  tier: KeywordTier;
  selected: boolean;
}

export interface MetricCategory {
  title: string;
  prompts: string[];
}

export interface TrackPreset {
  id: TrackPresetId;
  name: string;
  shortName: string;
  group: 'MBA & Business' | 'Finance Specialist' | 'Tech';
  tagline: string;
  defaultTargetTitle: string;
  sampleResumeFresher: ResumeContent;
  sampleResumeSwitcher?: ResumeContent;
  starterKeywords: KeywordItem[];
  sampleJds: Array<{
    company: string;
    roleTitle: string;
    rawText: string;
  }>;
  metricCategories: MetricCategory[];
  beginnerHints: {
    educationExample: string;
    experienceExample: string;
    projectExample: string;
    certificationExample: string;
  };
}

export interface AtsCoverageResult {
  totalTracked: number;
  matchedCount: number;
  percentage: number;
  matchedTerms: string[];
  missingTerms: string[];
}

// --- 5-Slot Auto-Rotating Free AI Engine ---
export type AiProviderKind = 'workers_ai' | 'gemini' | 'groq' | 'openrouter' | 'cerebras';

export interface AiSlotConfig {
  id: string; // slot_1 .. slot_5
  label: string;
  provider: AiProviderKind;
  model: string;
  enabled: boolean;
  callsCount: number;
  cooldownUntil?: string | null;
  lastError?: string;
}

export interface AiRouterConfig {
  dailyChatsLimitPerUser: number;
  slots: AiSlotConfig[];
}

export interface AdNetworksConfig {
  adsgram: { enabled: boolean; blockId: string };
  cleanadsRewarded: { enabled: boolean; placementId: string };
  cleanadsInterstitial: { enabled: boolean; placementId: string };
  cleanadsTestMode: boolean;
  monetag: { enabled: boolean; zoneId: string };
  triggers: {
    onPdfExport: boolean;
  };
  cooldownMinutes: number;
}

export interface PublicAppConfig {
  appName: string;
  botUsername: string;
  ads: AdNetworksConfig;
}

export interface AdminUserAnalytic {
  userId: string;
  username: string;
  firstName: string;
  resumesMade: number;
  pdfsDownloaded: number;
  aiChatsTotal: number;
  aiChatsToday: number;
  lastSeenAt: string;
}

export interface AdminStats {
  totalUsers: number;
  resumesSaved: number;
  pdfsGenerated: number;
  aiChatsTotal: number;
  aiChatsToday: number;
}

export interface AdminConfigResponse {
  stats: AdminStats;
  users: AdminUserAnalytic[];
  ai: AiRouterConfig;
  ads: AdNetworksConfig;
  bot: {
    appName: string;
    botUsername: string;
    archiveChannelId: string;
  };
  secretStatus: {
    workersAiConfigured: boolean;
    geminiConfigured: boolean;
    groqConfigured: boolean;
    openrouterConfigured: boolean;
    cerebrasConfigured: boolean;
    telegramBotConfigured: boolean;
    archiveChannelFromEnv: boolean;
    adminPasswordFromEnv: boolean;
  };
}

export interface ChatQaPayload {
  roleLabel: string;
  layoutMode: LayoutMode;
  fullName: string;
  city: string;
  contact: string;
  education: string;
  experience: string;
  projects: string;
  skillsAndTools: string;
  certifications: string;
}
