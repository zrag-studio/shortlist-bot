import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  AdNetworksConfig,
  AdminStats,
  AdminUserAnalytic,
  AiRouterConfig,
  AiSlotConfig,
  PublicAppConfig,
  ResumeRecord,
} from '../src/types/resume';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'shortlist.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

export const DEFAULT_AI_SLOTS: AiSlotConfig[] = [
  {
    id: 'slot_1',
    label: 'Slot 1 · Cloudflare Workers AI',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.1-8b-instruct',
    enabled: true,
    callsCount: 0,
    cooldownUntil: null,
    lastError: '',
  },
  {
    id: 'slot_2',
    label: 'Slot 2 · Google Gemini Free',
    provider: 'gemini',
    model: 'gemini-4-hydrogen',
    enabled: true,
    callsCount: 0,
    cooldownUntil: null,
    lastError: '',
  },
  {
    id: 'slot_3',
    label: 'Slot 3 · Groq Free',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    enabled: true,
    callsCount: 0,
    cooldownUntil: null,
    lastError: '',
  },
  {
    id: 'slot_4',
    label: 'Slot 4 · OpenRouter Free',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    enabled: false,
    callsCount: 0,
    cooldownUntil: null,
    lastError: '',
  },
  {
    id: 'slot_5',
    label: 'Slot 5 · Cerebras Free',
    provider: 'cerebras',
    model: 'llama3.1-8b',
    enabled: false,
    callsCount: 0,
    cooldownUntil: null,
    lastError: '',
  },
];

export const DEFAULT_AI_CONFIG: AiRouterConfig = {
  dailyChatsLimitPerUser: 10,
  slots: DEFAULT_AI_SLOTS,
};

export const DEFAULT_ADS_CONFIG: AdNetworksConfig = {
  adsgram: { enabled: false, blockId: '' },
  cleanadsRewarded: { enabled: false, placementId: '' },
  cleanadsInterstitial: { enabled: false, placementId: '' },
  cleanadsTestMode: false,
  monetag: { enabled: false, zoneId: '' },
  triggers: {
    onPdfExport: true,
  },
  cooldownMinutes: 3,
};

export const DEFAULT_BOT_CONFIG = {
  appName: 'Shortlist Studio',
  botUsername: '',
  archiveChannelId: '',
};

function safeAddColumn(table: string, colDef: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  } catch {
    // Column already exists
  }
}

/**
 * Auto-bootstraps all relational tables safely and upgrades columns if needed.
 */
export function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      ai_calls_today INTEGER NOT NULL DEFAULT 0,
      ai_calls_date TEXT NOT NULL DEFAULT '',
      ai_chats_total INTEGER NOT NULL DEFAULT 0,
      pdfs_downloaded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      track_id TEXT NOT NULL DEFAULT 'mba-finance',
      custom_role_name TEXT NOT NULL DEFAULT '',
      layout_mode TEXT NOT NULL DEFAULT 'fresher',
      font_family TEXT NOT NULL DEFAULT 'times',
      font_size_pt REAL NOT NULL DEFAULT 10.0,
      current_step INTEGER NOT NULL DEFAULT 1,
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
  `);

  // Safe upgrade for existing local SQLite databases
  safeAddColumn('users', 'ai_chats_total INTEGER NOT NULL DEFAULT 0');
  safeAddColumn('users', 'pdfs_downloaded INTEGER NOT NULL DEFAULT 0');
}

ensureTables();

// --- Settings helpers ---
export function getSettingRaw(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setSettingRaw(key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

export function getAiConfig(): AiRouterConfig {
  const raw = getSettingRaw('ai_config_v2');
  if (!raw) return structuredClone(DEFAULT_AI_CONFIG);
  try {
    const parsed = JSON.parse(raw) as Partial<AiRouterConfig>;
    const validSlots = Array.isArray(parsed.slots) && parsed.slots.length > 0
      ? parsed.slots.slice(0, 5).map((s, idx) => ({
          id: s.id || `slot_${idx + 1}`,
          label: String(s.label || `Slot ${idx + 1}`).slice(0, 60),
          provider: s.provider || 'gemini',
          model: String(s.model || 'gemini-4-hydrogen').slice(0, 96),
          enabled: Boolean(s.enabled),
          callsCount: Math.max(0, Number(s.callsCount) || 0),
          cooldownUntil: s.cooldownUntil || null,
          lastError: String(s.lastError || '').slice(0, 180),
        }))
      : structuredClone(DEFAULT_AI_SLOTS);

    return {
      dailyChatsLimitPerUser: Math.max(
        1,
        Math.min(200, Number(parsed.dailyChatsLimitPerUser) || 10)
      ),
      slots: validSlots,
    };
  } catch {
    return structuredClone(DEFAULT_AI_CONFIG);
  }
}

export function saveAiConfig(cfg: AiRouterConfig): void {
  setSettingRaw('ai_config_v2', JSON.stringify(cfg));
}

export function recordAiSlotResult(
  slotId: string,
  ok: boolean,
  errorMsg = '',
  isQuotaOrRateLimit = false
): void {
  const cfg = getAiConfig();
  const updatedSlots = cfg.slots.map((slot) => {
    if (slot.id !== slotId) return slot;
    if (ok) {
      return {
        ...slot,
        callsCount: (slot.callsCount || 0) + 1,
        cooldownUntil: null,
        lastError: '',
      };
    }
    const cooldownMs = isQuotaOrRateLimit ? 15 * 60 * 1000 : 2 * 60 * 1000;
    return {
      ...slot,
      cooldownUntil: new Date(Date.now() + cooldownMs).toISOString(),
      lastError: errorMsg.slice(0, 180),
    };
  });
  saveAiConfig({ ...cfg, slots: updatedSlots });
}

export function getAdsConfig(): AdNetworksConfig {
  const raw = getSettingRaw('ads_config');
  if (!raw) return structuredClone(DEFAULT_ADS_CONFIG);
  try {
    const parsed = JSON.parse(raw) as Partial<AdNetworksConfig>;
    return {
      adsgram: { ...DEFAULT_ADS_CONFIG.adsgram, ...(parsed.adsgram || {}) },
      cleanadsRewarded: {
        ...DEFAULT_ADS_CONFIG.cleanadsRewarded,
        ...(parsed.cleanadsRewarded || {}),
      },
      cleanadsInterstitial: {
        ...DEFAULT_ADS_CONFIG.cleanadsInterstitial,
        ...(parsed.cleanadsInterstitial || {}),
      },
      cleanadsTestMode: Boolean(parsed.cleanadsTestMode),
      monetag: { ...DEFAULT_ADS_CONFIG.monetag, ...(parsed.monetag || {}) },
      triggers: {
        onPdfExport: parsed.triggers?.onPdfExport ?? true,
      },
      cooldownMinutes: Math.max(0, Math.min(120, Number(parsed.cooldownMinutes ?? 3))),
    };
  } catch {
    return structuredClone(DEFAULT_ADS_CONFIG);
  }
}

export function getBotServerConfig(): {
  appName: string;
  botUsername: string;
  archiveChannelId: string;
} {
  const raw = getSettingRaw('bot_config');
  const envChannel = (process.env.TELEGRAM_ARCHIVE_CHANNEL_ID || '').trim();
  if (!raw) {
    return { ...DEFAULT_BOT_CONFIG, archiveChannelId: envChannel };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_BOT_CONFIG>;
    return {
      appName: String(parsed.appName || DEFAULT_BOT_CONFIG.appName).slice(0, 60),
      botUsername: String(parsed.botUsername || '').replace(/^@/, '').slice(0, 64),
      archiveChannelId: String(parsed.archiveChannelId || envChannel).trim().slice(0, 64),
    };
  } catch {
    return { ...DEFAULT_BOT_CONFIG, archiveChannelId: envChannel };
  }
}

/**
 * Strictly public app config — NEVER includes archiveChannelId or server secrets.
 */
export function getPublicAppConfig(): PublicAppConfig {
  const bot = getBotServerConfig();
  return {
    appName: bot.appName,
    botUsername: bot.botUsername,
    ads: getAdsConfig(),
  };
}

// --- Users & Analytics ---
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function touchUser(userId: string, username = '', firstName = ''): void {
  const now = new Date().toISOString();
  const today = todayUtcDate();
  db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, ai_calls_today, ai_calls_date, ai_chats_total, pdfs_downloaded, created_at, last_seen)
    VALUES (?, ?, ?, 0, ?, 0, 0, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = CASE WHEN excluded.username != '' THEN excluded.username ELSE users.username END,
      first_name = CASE WHEN excluded.first_name != '' THEN excluded.first_name ELSE users.first_name END,
      last_seen = excluded.last_seen
  `).run(userId, username.slice(0, 64), firstName.slice(0, 64), today, now, now);
}

/**
 * Counts 1 completed AI chat (or AI build request) as 1 unit in user analytics.
 */
export function checkAndIncrementUserAiChat(
  userId: string,
  countInAnalytics = true
): { allowed: boolean; usedToday: number; limit: number } {
  const aiConfig = getAiConfig();
  const limit = aiConfig.dailyChatsLimitPerUser;
  const today = todayUtcDate();
  touchUser(userId);

  const row = db
    .prepare('SELECT ai_calls_today, ai_calls_date, ai_chats_total FROM users WHERE telegram_id = ?')
    .get(userId) as
    | { ai_calls_today: number; ai_calls_date: string; ai_chats_total: number }
    | undefined;

  const currentToday = row && row.ai_calls_date === today ? row.ai_calls_today : 0;
  if (currentToday >= limit) {
    return { allowed: false, usedToday: currentToday, limit };
  }

  if (countInAnalytics) {
    db.prepare(
      'UPDATE users SET ai_calls_today = ?, ai_calls_date = ?, ai_chats_total = COALESCE(ai_chats_total, 0) + 1 WHERE telegram_id = ?'
    ).run(currentToday + 1, today, userId);
    return { allowed: true, usedToday: currentToday + 1, limit };
  }

  return { allowed: true, usedToday: currentToday, limit };
}

export function recordUserPdfExport(userId: string): number {
  touchUser(userId);
  db.prepare(
    'UPDATE users SET pdfs_downloaded = COALESCE(pdfs_downloaded, 0) + 1, last_seen = ? WHERE telegram_id = ?'
  ).run(new Date().toISOString(), userId);

  const current = Number(getSettingRaw('pdfs_generated_count') || '0') || 0;
  const next = current + 1;
  setSettingRaw('pdfs_generated_count', String(next));
  return next;
}

export function getAdminStats(): AdminStats {
  const today = todayUtcDate();
  const totalUsersRow = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  const resumesRow = db.prepare('SELECT COUNT(*) as c FROM resumes').get() as { c: number };
  const aiTotalRow = db
    .prepare('SELECT COALESCE(SUM(ai_chats_total), 0) as s FROM users')
    .get() as { s: number };
  const aiTodayRow = db
    .prepare('SELECT COALESCE(SUM(ai_calls_today), 0) as s FROM users WHERE ai_calls_date = ?')
    .get(today) as { s: number };
  const pdfsGenerated = Number(getSettingRaw('pdfs_generated_count') || '0') || 0;

  return {
    totalUsers: totalUsersRow?.c ?? 0,
    resumesSaved: resumesRow?.c ?? 0,
    pdfsGenerated,
    aiChatsTotal: aiTotalRow?.s ?? 0,
    aiChatsToday: aiTodayRow?.s ?? 0,
  };
}

export function getAdminUserAnalytics(): AdminUserAnalytic[] {
  const today = todayUtcDate();
  const rows = db
    .prepare(`
      SELECT
        u.telegram_id AS user_id,
        u.username,
        u.first_name,
        u.ai_chats_total,
        CASE WHEN u.ai_calls_date = ? THEN u.ai_calls_today ELSE 0 END AS ai_chats_today,
        COALESCE(u.pdfs_downloaded, 0) AS pdfs_downloaded,
        u.last_seen,
        COUNT(r.id) AS resumes_made
      FROM users u
      LEFT JOIN resumes r ON r.user_id = u.telegram_id
      GROUP BY u.telegram_id
      ORDER BY u.last_seen DESC
      LIMIT 100
    `)
    .all(today) as Array<{
    user_id: string;
    username: string;
    first_name: string;
    ai_chats_total: number;
    ai_chats_today: number;
    pdfs_downloaded: number;
    last_seen: string;
    resumes_made: number;
  }>;

  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username || '',
    firstName: r.first_name || '',
    resumesMade: Number(r.resumes_made) || 0,
    pdfsDownloaded: Number(r.pdfs_downloaded) || 0,
    aiChatsTotal: Number(r.ai_chats_total) || 0,
    aiChatsToday: Number(r.ai_chats_today) || 0,
    lastSeenAt: r.last_seen,
  }));
}

// --- Resumes CRUD ---
interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  track_id: string;
  custom_role_name: string;
  layout_mode: string;
  font_family: string;
  font_size_pt: number;
  current_step: number;
  content_json: string;
  updated_at: string;
}

function mapResumeRow(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    trackId: row.track_id as ResumeRecord['trackId'],
    customRoleName: row.custom_role_name,
    layoutMode: row.layout_mode === 'switcher' ? 'switcher' : 'fresher',
    fontFamily: row.font_family === 'arial' ? 'arial' : 'times',
    fontSizePt: Math.max(8.5, Math.min(11.5, Number(row.font_size_pt) || 10)),
    currentStep: Math.max(1, Math.min(6, Number(row.current_step) || 1)),
    content: JSON.parse(row.content_json),
    updatedAt: row.updated_at,
  };
}

export function listResumesByUser(userId: string): ResumeRecord[] {
  const rows = db
    .prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20')
    .all(userId) as ResumeRow[];
  return rows.map(mapResumeRow);
}

export function upsertResume(record: ResumeRecord): ResumeRecord {
  const now = new Date().toISOString();
  touchUser(record.userId);
  db.prepare(`
    INSERT INTO resumes (
      id, user_id, title, track_id, custom_role_name, layout_mode,
      font_family, font_size_pt, current_step, content_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      track_id = excluded.track_id,
      custom_role_name = excluded.custom_role_name,
      layout_mode = excluded.layout_mode,
      font_family = excluded.font_family,
      font_size_pt = excluded.font_size_pt,
      current_step = excluded.current_step,
      content_json = excluded.content_json,
      updated_at = excluded.updated_at
    WHERE resumes.user_id = excluded.user_id
  `).run(
    record.id,
    record.userId,
    record.title,
    record.trackId,
    record.customRoleName,
    record.layoutMode,
    record.fontFamily,
    record.fontSizePt,
    record.currentStep,
    JSON.stringify(record.content),
    now
  );
  return { ...record, updatedAt: now };
}
