import {
  AdNetworksConfig,
  AdminStats,
  AdminUserAnalytic,
  AiRouterConfig,
  AiSlotConfig,
  PublicAppConfig,
  ResumeContent,
  ResumeRecord,
  TrackPresetId,
} from '../../src/types/resume';
import { D1Database, PagesEnv } from './_types';

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
  triggers: { onPdfExport: true },
  cooldownMinutes: 3,
};

let tablesBootstrapped = false;

export async function ensureTables(db: D1Database): Promise<void> {
  if (tablesBootstrapped) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      ai_chats_total INTEGER NOT NULL DEFAULT 0,
      ai_chats_today INTEGER NOT NULL DEFAULT 0,
      ai_chats_date TEXT NOT NULL DEFAULT '',
      pdfs_downloaded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      track_id TEXT NOT NULL DEFAULT 'mba-finance',
      custom_role_name TEXT NOT NULL DEFAULT '',
      layout_mode TEXT NOT NULL DEFAULT 'fresher',
      font_family TEXT NOT NULL DEFAULT 'times',
      font_size_pt REAL NOT NULL DEFAULT 10,
      current_step INTEGER NOT NULL DEFAULT 1,
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, updated_at DESC)`,
  ];

  for (const sql of statements) {
    await db.prepare(sql).run();
  }
  tablesBootstrapped = true;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getSettingRaw(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row ? row.value : null;
}

export async function setSettingRaw(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, value, new Date().toISOString())
    .run();
}

export async function getAiConfig(db: D1Database): Promise<AiRouterConfig> {
  const raw = await getSettingRaw(db, 'ai_config_v2');
  if (!raw) return structuredClone(DEFAULT_AI_CONFIG);
  try {
    const parsed = JSON.parse(raw) as Partial<AiRouterConfig>;
    const slots =
      Array.isArray(parsed.slots) && parsed.slots.length > 0
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
      slots,
    };
  } catch {
    return structuredClone(DEFAULT_AI_CONFIG);
  }
}

export async function saveAiConfig(db: D1Database, cfg: AiRouterConfig): Promise<void> {
  await setSettingRaw(db, 'ai_config_v2', JSON.stringify(cfg));
}

export async function recordAiSlotResultEdge(
  db: D1Database,
  slotId: string,
  ok: boolean,
  errorMsg = '',
  isQuotaOrRateLimit = false
): Promise<void> {
  const cfg = await getAiConfig(db);
  const updated = cfg.slots.map((slot) => {
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
  await saveAiConfig(db, { ...cfg, slots: updated });
}

export async function getAdsConfig(db: D1Database): Promise<AdNetworksConfig> {
  const raw = await getSettingRaw(db, 'ads_config');
  if (!raw) return structuredClone(DEFAULT_ADS_CONFIG);
  try {
    const parsed = JSON.parse(raw) as Partial<AdNetworksConfig>;
    return {
      adsgram: { ...DEFAULT_ADS_CONFIG.adsgram, ...parsed.adsgram },
      cleanadsRewarded: { ...DEFAULT_ADS_CONFIG.cleanadsRewarded, ...parsed.cleanadsRewarded },
      cleanadsInterstitial: {
        ...DEFAULT_ADS_CONFIG.cleanadsInterstitial,
        ...parsed.cleanadsInterstitial,
      },
      cleanadsTestMode: Boolean(parsed.cleanadsTestMode),
      monetag: { ...DEFAULT_ADS_CONFIG.monetag, ...parsed.monetag },
      triggers: { onPdfExport: parsed.triggers?.onPdfExport ?? true },
      cooldownMinutes: Math.max(0, Math.min(120, Number(parsed.cooldownMinutes ?? 3))),
    };
  } catch {
    return structuredClone(DEFAULT_ADS_CONFIG);
  }
}

export async function getBotServerConfig(
  db: D1Database,
  env?: PagesEnv
): Promise<{ appName: string; botUsername: string; archiveChannelId: string }> {
  const raw = await getSettingRaw(db, 'bot_config');
  const envChannel = (env?.TELEGRAM_ARCHIVE_CHANNEL_ID || '').trim();
  if (!raw) {
    return { appName: 'Shortlist Studio', botUsername: '', archiveChannelId: envChannel };
  }
  try {
    const parsed = JSON.parse(raw) as {
      appName?: string;
      botUsername?: string;
      archiveChannelId?: string;
    };
    return {
      appName: parsed.appName?.trim() || 'Shortlist Studio',
      botUsername: parsed.botUsername?.trim() || '',
      archiveChannelId: (parsed.archiveChannelId || envChannel).trim(),
    };
  } catch {
    return { appName: 'Shortlist Studio', botUsername: '', archiveChannelId: envChannel };
  }
}

export async function getPublicAppConfig(db: D1Database): Promise<PublicAppConfig> {
  const [bot, ads] = await Promise.all([getBotServerConfig(db), getAdsConfig(db)]);
  return {
    appName: bot.appName,
    botUsername: bot.botUsername,
    ads,
  };
}

export async function touchUser(
  db: D1Database,
  userId: string,
  username = '',
  firstName = ''
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO users (id, username, first_name, ai_chats_total, ai_chats_today, ai_chats_date, pdfs_downloaded, created_at, last_seen_at)
       VALUES (?, ?, ?, 0, 0, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = CASE WHEN excluded.username != '' THEN excluded.username ELSE users.username END,
         first_name = CASE WHEN excluded.first_name != '' THEN excluded.first_name ELSE users.first_name END,
         last_seen_at = excluded.last_seen_at`
    )
    .bind(userId, username, firstName, todayIsoDate(), now, now)
    .run();
}

export async function checkAndIncrementUserAiChat(
  db: D1Database,
  userId: string,
  countInAnalytics = true
): Promise<{ allowed: boolean; usedToday: number; limit: number }> {
  await touchUser(db, userId);
  const config = await getAiConfig(db);
  const today = todayIsoDate();
  const row = await db
    .prepare('SELECT ai_chats_today, ai_chats_date FROM users WHERE id = ?')
    .bind(userId)
    .first<{ ai_chats_today: number; ai_chats_date: string }>();

  const currentToday = row && row.ai_chats_date === today ? Number(row.ai_chats_today) : 0;
  if (currentToday >= config.dailyChatsLimitPerUser) {
    return { allowed: false, usedToday: currentToday, limit: config.dailyChatsLimitPerUser };
  }

  if (countInAnalytics) {
    await db
      .prepare(
        'UPDATE users SET ai_chats_today = ?, ai_chats_date = ?, ai_chats_total = ai_chats_total + 1, last_seen_at = ? WHERE id = ?'
      )
      .bind(currentToday + 1, today, new Date().toISOString(), userId)
      .run();
    return { allowed: true, usedToday: currentToday + 1, limit: config.dailyChatsLimitPerUser };
  }

  return { allowed: true, usedToday: currentToday, limit: config.dailyChatsLimitPerUser };
}

export async function recordUserPdfExport(db: D1Database, userId: string): Promise<number> {
  await touchUser(db, userId);
  await db
    .prepare('UPDATE users SET pdfs_downloaded = pdfs_downloaded + 1, last_seen_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), userId)
    .run();
  const raw = await getSettingRaw(db, 'pdfs_generated_count');
  const next = (Number(raw) || 0) + 1;
  await setSettingRaw(db, 'pdfs_generated_count', String(next));
  return next;
}

export async function getAdminStats(db: D1Database): Promise<AdminStats> {
  const today = todayIsoDate();
  const [usersRow, resumesRow, aiTotalRow, aiTodayRow, pdfRaw] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM resumes').first<{ c: number }>(),
    db.prepare('SELECT COALESCE(SUM(ai_chats_total), 0) as s FROM users').first<{ s: number }>(),
    db
      .prepare('SELECT COALESCE(SUM(ai_chats_today), 0) as s FROM users WHERE ai_chats_date = ?')
      .bind(today)
      .first<{ s: number }>(),
    getSettingRaw(db, 'pdfs_generated_count'),
  ]);

  return {
    totalUsers: Number(usersRow?.c ?? 0),
    resumesSaved: Number(resumesRow?.c ?? 0),
    pdfsGenerated: Number(pdfRaw) || 0,
    aiChatsTotal: Number(aiTotalRow?.s ?? 0),
    aiChatsToday: Number(aiTodayRow?.s ?? 0),
  };
}

export async function getAdminUserAnalytics(db: D1Database): Promise<AdminUserAnalytic[]> {
  const today = todayIsoDate();
  const res = await db
    .prepare(`
      SELECT
        u.id AS user_id,
        u.username,
        u.first_name,
        u.ai_chats_total,
        CASE WHEN u.ai_chats_date = ? THEN u.ai_chats_today ELSE 0 END AS ai_chats_today,
        u.pdfs_downloaded,
        u.last_seen_at,
        COUNT(r.id) AS resumes_made
      FROM users u
      LEFT JOIN resumes r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY u.last_seen_at DESC
      LIMIT 100
    `)
    .bind(today)
    .all<Record<string, unknown>>();

  return (res.results || []).map((r) => ({
    userId: String(r.user_id),
    username: String(r.username || ''),
    firstName: String(r.first_name || ''),
    resumesMade: Number(r.resumes_made) || 0,
    pdfsDownloaded: Number(r.pdfs_downloaded) || 0,
    aiChatsTotal: Number(r.ai_chats_total) || 0,
    aiChatsToday: Number(r.ai_chats_today) || 0,
    lastSeenAt: String(r.last_seen_at || ''),
  }));
}

export async function listResumesByUser(db: D1Database, userId: string): Promise<ResumeRecord[]> {
  const res = await db
    .prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20')
    .bind(userId)
    .all<Record<string, unknown>>();

  return (res.results || []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    trackId: String(row.track_id) as TrackPresetId,
    customRoleName: String(row.custom_role_name || ''),
    layoutMode: row.layout_mode === 'switcher' ? 'switcher' : 'fresher',
    fontFamily: row.font_family === 'arial' ? 'arial' : 'times',
    fontSizePt: Number(row.font_size_pt || 10),
    currentStep: Number(row.current_step || 1),
    content: JSON.parse(String(row.content_json)) as ResumeContent,
    updatedAt: String(row.updated_at),
  }));
}

export async function upsertResume(db: D1Database, record: ResumeRecord): Promise<ResumeRecord> {
  await touchUser(db, record.userId);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO resumes (
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
        updated_at = excluded.updated_at`
    )
    .bind(
      record.id,
      record.userId,
      record.title,
      record.trackId,
      record.customRoleName || '',
      record.layoutMode,
      record.fontFamily,
      record.fontSizePt,
      record.currentStep,
      JSON.stringify(record.content),
      now
    )
    .run();

  return { ...record, updatedAt: now };
}
