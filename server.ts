import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  checkAndIncrementUserAiChat,
  ensureTables,
  getAdminStats,
  getAdminUserAnalytics,
  getAdsConfig,
  getAiConfig,
  getBotServerConfig,
  getPublicAppConfig,
  getSettingRaw,
  listResumesByUser,
  recordUserPdfExport,
  saveAiConfig,
  setSettingRaw,
  touchUser,
  upsertResume,
} from './server/db';
import {
  aiBuildResumeFromChat,
  aiMatchJobDescription,
  aiPolishBullet,
  aiRefineResumeFromChat,
  aiWriteSummary,
  runRoutedJsonAi,
} from './server/gemini';
import {
  AdNetworksConfig,
  AiProviderKind,
  AiRouterConfig,
  ChatQaPayload,
  ResumeRecord,
  TrackPresetId,
} from './src/types/resume';

const PORT = 3000;
const SESSION_SIGNING_KEY =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const VALID_PROVIDERS = new Set<AiProviderKind>([
  'workers_ai',
  'gemini',
  'groq',
  'openrouter',
  'cerebras',
]);

function sanitizeUserId(raw: unknown): string {
  if (typeof raw !== 'string') return 'web_user_default';
  const cleaned = raw.trim();
  return /^[a-zA-Z0-9_-]{3,64}$/.test(cleaned) ? cleaned : 'web_user_default';
}

function verifyTelegramInitData(
  initData: string,
  botToken: string
): { userId: string; username: string; firstName: string } | null {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash) return null;
    params.delete('hash');

    const sortedPairs = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedPairs)
      .digest('hex');

    const receivedBuf = Buffer.from(receivedHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    if (
      receivedBuf.length !== computedBuf.length ||
      !crypto.timingSafeEqual(receivedBuf, computedBuf)
    ) {
      return null;
    }

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const u = JSON.parse(userRaw) as { id?: number; username?: string; first_name?: string };
    if (!u.id) return null;
    return {
      userId: `tg_${u.id}`,
      username: u.username || '',
      firstName: u.first_name || '',
    };
  } catch {
    return null;
  }
}

function resolveRequestUser(req: Request): {
  userId: string;
  username: string;
  firstName: string;
} {
  const tgInitData = req.header('x-telegram-init-data') || '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (tgInitData && botToken) {
    const verified = verifyTelegramInitData(tgInitData, botToken);
    if (verified) return verified;
  }
  const headerUser = req.header('x-workspace-user') || req.query.userId;
  return { userId: sanitizeUserId(headerUser), username: '', firstName: '' };
}

// --- Admin Auth Helpers (scrypt + in-memory signed Bearer token) ---
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  return derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf);
}

function createAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(req: Request): boolean {
  const auth = req.header('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function handleApiError(res: Response, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes('Daily AI')
    ? 429
    : message.includes('not configured')
      ? 503
      : 500;
  res.status(status).json({ error: message });
}

async function archivePdfToTelegramChannel(params: {
  pdfBytes: Buffer;
  fileName: string;
  userId: string;
  username: string;
  firstName: string;
  roleTitle: string;
}): Promise<boolean> {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const botCfg = getBotServerConfig();
  const channelId = botCfg.archiveChannelId.trim();
  if (!botToken || !channelId) return false;

  const safeFile =
    params.fileName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '') || 'ATS_Resume';
  const userTag = params.username
    ? `@${params.username} (${params.userId})`
    : params.firstName
      ? `${params.firstName} (${params.userId})`
      : params.userId;

  const formData = new FormData();
  formData.append('chat_id', channelId);
  formData.append(
    'document',
    new Blob([new Uint8Array(params.pdfBytes)], { type: 'application/pdf' }),
    `${safeFile}.pdf`
  );
  formData.append(
    'caption',
    `Resume Export\nUser: ${userTag}\nRole: ${params.roleTitle || 'Resume'}\nTime: ${new Date().toISOString()}`
  );

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  return tgRes.ok;
}

async function startServer() {
  ensureTables();
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // --- Public App & Ad Config (ZERO secrets, ZERO archiveChannelId) ---
  app.get('/api/public-config', (req, res) => {
    try {
      const u = resolveRequestUser(req);
      touchUser(u.userId, u.username, u.firstName);
      res.json(getPublicAppConfig());
    } catch (err) {
      handleApiError(res, err, 'Failed to load public configuration.');
    }
  });

  // --- Record PDF Export + Silent Server-Side Private Channel Backup ---
  app.post('/api/resumes/export-pdf', async (req, res) => {
    try {
      const u = resolveRequestUser(req);
      touchUser(u.userId, u.username, u.firstName);
      const count = recordUserPdfExport(u.userId);

      const { pdfBase64, fileName, roleTitle } = (req.body || {}) as {
        pdfBase64?: string;
        fileName?: string;
        roleTitle?: string;
      };

      if (typeof pdfBase64 === 'string' && pdfBase64.length >= 100 && pdfBase64.length <= 4_500_000) {
        const pdfBytes = Buffer.from(pdfBase64, 'base64');
        // Verify PDF magic header (%PDF-) before forwarding to Telegram archive
        if (pdfBytes.length <= 3_200_000 && pdfBytes.subarray(0, 5).toString('ascii') === '%PDF-') {
          archivePdfToTelegramChannel({
            pdfBytes,
            fileName: String(fileName || 'ATS_Resume').slice(0, 80),
            userId: u.userId,
            username: u.username,
            firstName: u.firstName,
            roleTitle: String(roleTitle || '').slice(0, 120),
          }).catch(() => {
            // Non-blocking storage backup — never disrupts user download
          });
        }
      }

      res.json({ ok: true, pdfsGenerated: count });
    } catch (err) {
      handleApiError(res, err, 'Failed to record PDF export.');
    }
  });

  // --- Resumes CRUD ---
  app.get('/api/resumes', (req, res) => {
    try {
      const u = resolveRequestUser(req);
      touchUser(u.userId, u.username, u.firstName);
      const resumes = listResumesByUser(u.userId);
      res.json({ resumes, userId: u.userId });
    } catch (err) {
      handleApiError(res, err, 'Failed to load resumes.');
    }
  });

  app.post('/api/resumes', (req, res) => {
    try {
      const u = resolveRequestUser(req);
      const body = req.body as Partial<ResumeRecord>;
      if (!body || typeof body !== 'object' || !body.content) {
        res.status(400).json({ error: 'Invalid resume payload.' });
        return;
      }

      const id =
        typeof body.id === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(body.id)
          ? body.id
          : `res_${crypto.randomUUID().slice(0, 12)}`;

      const record: ResumeRecord = {
        id,
        userId: u.userId,
        title: String(body.title || 'My ATS Resume').slice(0, 120),
        trackId: (body.trackId || 'mba-finance') as TrackPresetId,
        customRoleName: String(body.customRoleName || '').slice(0, 100),
        layoutMode: body.layoutMode === 'switcher' ? 'switcher' : 'fresher',
        fontFamily: body.fontFamily === 'arial' ? 'arial' : 'times',
        fontSizePt: Math.max(8.5, Math.min(11.5, Number(body.fontSizePt) || 10)),
        currentStep: Math.max(1, Math.min(6, Number(body.currentStep) || 1)),
        content: body.content,
        updatedAt: new Date().toISOString(),
      };

      const saved = upsertResume(record);
      res.json({ resume: saved });
    } catch (err) {
      handleApiError(res, err, 'Failed to save resume.');
    }
  });

  // --- Unified 5-Slot Rotating Free AI Endpoint (/api/ai) ---
  app.post('/api/ai', async (req, res) => {
    try {
      const u = resolveRequestUser(req);
      const { action, payload } = (req.body || {}) as {
        action?: string;
        payload?: Record<string, unknown>;
      };

      if (!action || !payload) {
        res.status(400).json({ error: 'Missing AI action or payload.' });
        return;
      }

      // Count 1 AI chat completion as 1 in per-user analytics; minor edits check quota cleanly
      const isNewChatCount = action === 'chat-build-resume';
      const quota = checkAndIncrementUserAiChat(u.userId, isNewChatCount || action !== 'chat-refine-resume');
      if (!quota.allowed) {
        res.status(429).json({
          error: `Daily AI limit reached (${quota.limit} AI chats/day). Your limit resets tomorrow!`,
        });
        return;
      }

      const aiConfig = getAiConfig();

      if (action === 'chat-build-resume') {
        const qa = payload as unknown as ChatQaPayload;
        if (!qa.fullName || !qa.roleLabel) {
          res.status(400).json({ error: 'Name and target role are required.' });
          return;
        }
        const out = await aiBuildResumeFromChat(aiConfig, {
          roleLabel: String(qa.roleLabel).slice(0, 120),
          layoutMode: qa.layoutMode === 'switcher' ? 'switcher' : 'fresher',
          fullName: String(qa.fullName).slice(0, 100),
          city: String(qa.city || '').slice(0, 80),
          contact: String(qa.contact || '').slice(0, 220),
          education: String(qa.education || '').slice(0, 800),
          experience: String(qa.experience || '').slice(0, 1500),
          projects: String(qa.projects || '').slice(0, 1200),
          skillsAndTools: String(qa.skillsAndTools || '').slice(0, 800),
          certifications: String(qa.certifications || '').slice(0, 600),
        });
        res.json({ ...out.data, slotUsed: out.slotUsed, providerUsed: out.providerUsed });
        return;
      }

      if (action === 'chat-refine-resume') {
        const instruction = String(payload.instruction || '').trim();
        if (instruction.length < 4) {
          res.status(400).json({ error: 'Describe what you want changed.' });
          return;
        }
        const out = await aiRefineResumeFromChat(aiConfig, {
          roleLabel: String(payload.roleLabel || 'Resume').slice(0, 120),
          instruction,
          content: payload.content as ResumeRecord['content'],
        });
        res.json({ ...out.data, slotUsed: out.slotUsed, providerUsed: out.providerUsed });
        return;
      }

      if (action === 'match-jd') {
        const jdText = String(payload.jdText || '').trim();
        if (jdText.length < 25) {
          res.status(400).json({ error: 'Paste a job description (at least 25 characters).' });
          return;
        }
        const out = await aiMatchJobDescription(aiConfig, {
          roleLabel: String(payload.roleLabel || 'MBA Fresher').slice(0, 120),
          jdText,
          resumeContent: payload.resumeContent as ResumeRecord['content'],
        });
        res.json({ ...out.data, providerUsed: out.providerUsed });
        return;
      }

      if (action === 'write-summary') {
        const out = await aiWriteSummary(aiConfig, {
          roleLabel: String(payload.roleLabel || 'MBA Fresher').slice(0, 120),
          layoutMode: payload.layoutMode === 'switcher' ? 'switcher' : 'fresher',
          content: payload.content as ResumeRecord['content'],
          targetKeywords: Array.isArray(payload.targetKeywords)
            ? (payload.targetKeywords as string[]).slice(0, 20)
            : [],
        });
        res.json({ ...out.data, providerUsed: out.providerUsed });
        return;
      }

      if (action === 'polish-bullet') {
        const rawNotes = String(payload.rawNotes || '').trim();
        if (rawNotes.length < 5) {
          res.status(400).json({ error: 'Enter a short description of what you worked on.' });
          return;
        }
        const out = await aiPolishBullet(aiConfig, {
          roleLabel: String(payload.roleLabel || 'MBA Fresher').slice(0, 120),
          sectionType: payload.sectionType === 'project' ? 'project' : 'experience',
          rawNotes: rawNotes.slice(0, 1500),
          selectedMetrics: Array.isArray(payload.selectedMetrics)
            ? (payload.selectedMetrics as string[]).slice(0, 8)
            : [],
          targetKeywords: Array.isArray(payload.targetKeywords)
            ? (payload.targetKeywords as string[]).slice(0, 15)
            : [],
        });
        res.json({ ...out.data, providerUsed: out.providerUsed });
        return;
      }

      res.status(400).json({ error: 'Unknown AI action.' });
    } catch (err) {
      handleApiError(res, err, 'AI request failed.');
    }
  });

  // =========================================================================
  // HIDDEN ADMIN PANEL API ROUTES (/api/admin/* — Password-Protected)
  // =========================================================================
  app.get('/api/admin/auth-status', (_req, res) => {
    const envPasswordSet = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim());
    const claimedHashSet = Boolean(getSettingRaw('admin_password_hash'));
    res.json({
      needsInitialClaim: !envPasswordSet && !claimedHashSet,
      adminPasswordFromEnv: envPasswordSet,
    });
  });

  app.post('/api/admin/claim', (req, res) => {
    const envPasswordSet = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim());
    const claimedHashSet = Boolean(getSettingRaw('admin_password_hash'));
    if (envPasswordSet || claimedHashSet) {
      res.status(403).json({ error: 'Admin password is already configured.' });
      return;
    }
    const password = String(req.body?.password || '').trim();
    if (password.length < 8) {
      res.status(400).json({ error: 'Choose an admin password of at least 8 characters.' });
      return;
    }
    setSettingRaw('admin_password_hash', hashPassword(password));
    res.json({ token: createAdminToken() });
  });

  app.post('/api/admin/login', (req, res) => {
    const password = String(req.body?.password || '');
    const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
    if (envPassword) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPassword);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        res.json({ token: createAdminToken() });
        return;
      }
      res.status(401).json({ error: 'Incorrect admin password.' });
      return;
    }

    const storedHash = getSettingRaw('admin_password_hash');
    if (storedHash && verifyPasswordHash(password, storedHash)) {
      res.json({ token: createAdminToken() });
      return;
    }
    res.status(401).json({ error: 'Incorrect admin password.' });
  });

  app.get('/api/admin/config', (req, res) => {
    if (!verifyAdminToken(req)) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }
    res.json({
      stats: getAdminStats(),
      users: getAdminUserAnalytics(),
      ai: getAiConfig(),
      ads: getAdsConfig(),
      bot: getBotServerConfig(),
      secretStatus: {
        workersAiConfigured: Boolean(
          process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN
        ),
        geminiConfigured: Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ),
        groqConfigured: Boolean(process.env.GROQ_API_KEY),
        openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        cerebrasConfigured: Boolean(process.env.CEREBRAS_API_KEY),
        telegramBotConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        archiveChannelFromEnv: Boolean(process.env.TELEGRAM_ARCHIVE_CHANNEL_ID),
        adminPasswordFromEnv: Boolean(
          process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()
        ),
      },
    });
  });

  app.put('/api/admin/config', (req, res) => {
    if (!verifyAdminToken(req)) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }
    try {
      const { ai, ads, bot } = (req.body || {}) as {
        ai?: AiRouterConfig;
        ads?: AdNetworksConfig;
        bot?: { appName?: string; botUsername?: string; archiveChannelId?: string };
      };

      if (ai && Array.isArray(ai.slots)) {
        const current = getAiConfig();
        const prevMap = new Map(current.slots.map((s) => [s.id, s]));
        const sanitizedSlots = ai.slots.slice(0, 5).map((slot, idx) => {
          const id = String(slot.id || `slot_${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '');
          const prev = prevMap.get(id);
          const provider: AiProviderKind = VALID_PROVIDERS.has(slot.provider)
            ? slot.provider
            : 'gemini';
          return {
            id,
            label: String(slot.label || `Slot ${idx + 1}`).slice(0, 60),
            provider,
            model: String(slot.model || 'gemini-4-hydrogen').slice(0, 96),
            enabled: Boolean(slot.enabled),
            callsCount: prev?.callsCount || 0,
            cooldownUntil: slot.cooldownUntil === null ? null : prev?.cooldownUntil || null,
            lastError: slot.cooldownUntil === null ? '' : prev?.lastError || '',
          };
        });
        saveAiConfig({
          dailyChatsLimitPerUser: Math.max(
            1,
            Math.min(200, Number(ai.dailyChatsLimitPerUser) || 10)
          ),
          slots: sanitizedSlots,
        });
      }

      if (ads) {
        const sanitizedAds: AdNetworksConfig = {
          adsgram: {
            enabled: Boolean(ads.adsgram?.enabled),
            blockId: String(ads.adsgram?.blockId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
          },
          cleanadsRewarded: {
            enabled: Boolean(ads.cleanadsRewarded?.enabled),
            placementId: String(ads.cleanadsRewarded?.placementId || '')
              .replace(/[^a-zA-Z0-9_-]/g, '')
              .slice(0, 64),
          },
          cleanadsInterstitial: {
            enabled: Boolean(ads.cleanadsInterstitial?.enabled),
            placementId: String(ads.cleanadsInterstitial?.placementId || '')
              .replace(/[^a-zA-Z0-9_-]/g, '')
              .slice(0, 64),
          },
          cleanadsTestMode: Boolean(ads.cleanadsTestMode),
          monetag: {
            enabled: Boolean(ads.monetag?.enabled),
            zoneId: String(ads.monetag?.zoneId || '').replace(/[^0-9]/g, '').slice(0, 32),
          },
          triggers: {
            onPdfExport: ads.triggers?.onPdfExport ?? true,
          },
          cooldownMinutes: Math.max(0, Math.min(120, Number(ads.cooldownMinutes ?? 3))),
        };
        setSettingRaw('ads_config', JSON.stringify(sanitizedAds));
      }

      if (bot) {
        const channelId = String(bot.archiveChannelId || '').trim().slice(0, 64);
        if (channelId && !/^(-100\d{5,20}|@[a-zA-Z0-9_]{4,32}|-\d{5,20})$/.test(channelId)) {
          res.status(400).json({
            error: 'Telegram Channel ID must look like -1001234567890 (or @channelusername).',
          });
          return;
        }
        setSettingRaw(
          'bot_config',
          JSON.stringify({
            appName: String(bot.appName || 'Shortlist Studio').slice(0, 60),
            botUsername: String(bot.botUsername || '').replace(/^@/, '').slice(0, 64),
            archiveChannelId: channelId,
          })
        );
      }

      res.json({
        saved: true,
        ai: getAiConfig(),
        ads: getAdsConfig(),
        bot: getBotServerConfig(),
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to save admin settings.');
    }
  });

  app.post('/api/admin/test-ai', async (req, res) => {
    if (!verifyAdminToken(req)) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }
    try {
      const slotId = typeof req.body?.slotId === 'string' ? req.body.slotId : undefined;
      const aiConfig = getAiConfig();
      const out = await runRoutedJsonAi<{ status: string; message: string }>(
        aiConfig,
        'Return JSON {"status":"ok","message":"AI slot is online."}',
        'Reply with the status check JSON.',
        slotId
      );
      res.json({ ok: true, slotUsed: out.slotUsed, providerUsed: out.providerUsed, result: out.data });
    } catch (err) {
      handleApiError(res, err, 'AI test failed.');
    }
  });

  app.post('/api/admin/test-channel', async (req, res) => {
    if (!verifyAdminToken(req)) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }
    try {
      const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
      const channelId = getBotServerConfig().archiveChannelId.trim();
      if (!botToken) {
        res.status(503).json({ error: 'Set TELEGRAM_BOT_TOKEN in server/Cloudflare secrets first.' });
        return;
      }
      if (!channelId) {
        res.status(400).json({ error: 'Enter and save your Private Telegram Channel ID first.' });
        return;
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: `Shortlist Studio storage channel connected (${new Date().toISOString()}).`,
        }),
      });
      if (!tgRes.ok) {
        const txt = await tgRes.text();
        res.status(502).json({
          error: `Telegram rejected channel test (make sure your bot is an Admin in that channel): ${txt.slice(0, 140)}`,
        });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err, 'Channel test failed.');
    }
  });

  // --- Vite Dev Middleware / Static Production Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shortlist Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
