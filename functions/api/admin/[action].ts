import { AdNetworksConfig, AiProviderKind, AiRouterConfig } from '../../../src/types/resume';
import {
  ensureTables,
  getAdminStats,
  getAdminUserAnalytics,
  getAdsConfig,
  getAiConfig,
  getBotServerConfig,
  getSettingRaw,
  saveAiConfig,
  setSettingRaw,
} from '../_db';
import { PagesFunctionContext } from '../_types';
import {
  createAdminTokenEdge,
  hashPasswordEdge,
  jsonResponse,
  runRoutedJsonAiEdge,
  safeCompareStrings,
  verifyAdminTokenEdge,
  verifyPasswordHashEdge,
} from '../_utils';

const VALID_PROVIDERS = new Set<AiProviderKind>([
  'workers_ai',
  'gemini',
  'groq',
  'openrouter',
  'cerebras',
]);

export async function onRequestGet(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const action = context.params.action;

    if (action === 'auth-status') {
      const envPasswordSet = Boolean(context.env.ADMIN_PASSWORD?.trim());
      const claimedHashSet = Boolean(await getSettingRaw(context.env.DB, 'admin_password_hash'));
      return jsonResponse({
        needsInitialClaim: !envPasswordSet && !claimedHashSet,
        adminPasswordFromEnv: envPasswordSet,
      });
    }

    if (action === 'config') {
      if (!(await verifyAdminTokenEdge(context.request, context.env))) {
        return jsonResponse({ error: 'Admin authentication required.' }, 401);
      }
      const [stats, users, ai, ads, bot] = await Promise.all([
        getAdminStats(context.env.DB),
        getAdminUserAnalytics(context.env.DB),
        getAiConfig(context.env.DB),
        getAdsConfig(context.env.DB),
        getBotServerConfig(context.env.DB, context.env),
      ]);
      return jsonResponse({
        stats,
        users,
        ai,
        ads,
        bot,
        secretStatus: {
          workersAiConfigured: Boolean(context.env.AI),
          geminiConfigured: Boolean(context.env.GEMINI_API_KEY),
          groqConfigured: Boolean(context.env.GROQ_API_KEY),
          openrouterConfigured: Boolean(context.env.OPENROUTER_API_KEY),
          cerebrasConfigured: Boolean(context.env.CEREBRAS_API_KEY),
          telegramBotConfigured: Boolean(context.env.TELEGRAM_BOT_TOKEN),
          archiveChannelFromEnv: Boolean(context.env.TELEGRAM_ARCHIVE_CHANNEL_ID),
          adminPasswordFromEnv: Boolean(context.env.ADMIN_PASSWORD?.trim()),
        },
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Admin request failed.' },
      500
    );
  }
}

export async function onRequestPost(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const action = context.params.action;

    if (action === 'claim') {
      const envPasswordSet = Boolean(context.env.ADMIN_PASSWORD?.trim());
      const claimedHashSet = Boolean(await getSettingRaw(context.env.DB, 'admin_password_hash'));
      if (envPasswordSet || claimedHashSet) {
        return jsonResponse({ error: 'Admin password is already configured.' }, 403);
      }
      const body = (await context.request.json()) as { password?: string };
      const password = String(body?.password || '').trim();
      if (password.length < 8) {
        return jsonResponse({ error: 'Choose an admin password of at least 8 characters.' }, 400);
      }
      const hash = await hashPasswordEdge(password);
      await setSettingRaw(context.env.DB, 'admin_password_hash', hash);
      return jsonResponse({ token: await createAdminTokenEdge(context.env) });
    }

    if (action === 'login') {
      const body = (await context.request.json()) as { password?: string };
      const password = String(body?.password || '');
      const envPassword = (context.env.ADMIN_PASSWORD || '').trim();

      if (envPassword) {
        if (safeCompareStrings(password, envPassword)) {
          return jsonResponse({ token: await createAdminTokenEdge(context.env) });
        }
        return jsonResponse({ error: 'Incorrect admin password.' }, 401);
      }

      const storedHash = await getSettingRaw(context.env.DB, 'admin_password_hash');
      if (storedHash && (await verifyPasswordHashEdge(password, storedHash))) {
        return jsonResponse({ token: await createAdminTokenEdge(context.env) });
      }
      return jsonResponse({ error: 'Incorrect admin password.' }, 401);
    }

    if (action === 'test-ai') {
      if (!(await verifyAdminTokenEdge(context.request, context.env))) {
        return jsonResponse({ error: 'Admin authentication required.' }, 401);
      }
      const body = (await context.request.json().catch(() => ({}))) as { slotId?: string };
      const aiConfig = await getAiConfig(context.env.DB);
      const out = await runRoutedJsonAiEdge<{ status: string; message: string }>(
        context.env,
        aiConfig,
        'Return JSON {"status":"ok","message":"AI slot is online."}',
        'Reply with the status check JSON.',
        body.slotId
      );
      return jsonResponse({
        ok: true,
        slotUsed: out.slotUsed,
        providerUsed: out.providerUsed,
        result: out.data,
      });
    }

    if (action === 'test-channel') {
      if (!(await verifyAdminTokenEdge(context.request, context.env))) {
        return jsonResponse({ error: 'Admin authentication required.' }, 401);
      }
      const botToken = (context.env.TELEGRAM_BOT_TOKEN || '').trim();
      const botCfg = await getBotServerConfig(context.env.DB, context.env);
      const channelId = botCfg.archiveChannelId.trim();
      if (!botToken) {
        return jsonResponse({ error: 'Set TELEGRAM_BOT_TOKEN in Cloudflare Secrets first.' }, 503);
      }
      if (!channelId) {
        return jsonResponse({ error: 'Enter and save your Private Telegram Channel ID first.' }, 400);
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
        return jsonResponse(
          { error: 'Telegram rejected channel test. Make sure your bot is an Admin in that channel.' },
          502
        );
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Admin POST failed.' },
      500
    );
  }
}

export async function onRequestPut(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    if (context.params.action !== 'config') {
      return jsonResponse({ error: 'Not found' }, 404);
    }
    if (!(await verifyAdminTokenEdge(context.request, context.env))) {
      return jsonResponse({ error: 'Admin authentication required.' }, 401);
    }

    const body = (await context.request.json()) as {
      ai?: AiRouterConfig;
      ads?: AdNetworksConfig;
      bot?: { appName?: string; botUsername?: string; archiveChannelId?: string };
    };

    if (body.ai && Array.isArray(body.ai.slots)) {
      const current = await getAiConfig(context.env.DB);
      const prevMap = new Map(current.slots.map((s) => [s.id, s]));
      const sanitizedSlots = body.ai.slots.slice(0, 5).map((slot, idx) => {
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
      await saveAiConfig(context.env.DB, {
        dailyChatsLimitPerUser: Math.max(
          1,
          Math.min(200, Number(body.ai.dailyChatsLimitPerUser) || 10)
        ),
        slots: sanitizedSlots,
      });
    }

    if (body.ads) {
      const sanitizedAds: AdNetworksConfig = {
        adsgram: {
          enabled: Boolean(body.ads.adsgram?.enabled),
          blockId: String(body.ads.adsgram?.blockId || '')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 64),
        },
        cleanadsRewarded: {
          enabled: Boolean(body.ads.cleanadsRewarded?.enabled),
          placementId: String(body.ads.cleanadsRewarded?.placementId || '')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 64),
        },
        cleanadsInterstitial: {
          enabled: Boolean(body.ads.cleanadsInterstitial?.enabled),
          placementId: String(body.ads.cleanadsInterstitial?.placementId || '')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 64),
        },
        cleanadsTestMode: Boolean(body.ads.cleanadsTestMode),
        monetag: {
          enabled: Boolean(body.ads.monetag?.enabled),
          zoneId: String(body.ads.monetag?.zoneId || '')
            .replace(/[^0-9]/g, '')
            .slice(0, 32),
        },
        triggers: { onPdfExport: body.ads.triggers?.onPdfExport ?? true },
        cooldownMinutes: Math.max(0, Math.min(120, Number(body.ads.cooldownMinutes ?? 3))),
      };
      await setSettingRaw(context.env.DB, 'ads_config', JSON.stringify(sanitizedAds));
    }

    if (body.bot) {
      const channelId = String(body.bot.archiveChannelId || '').trim().slice(0, 64);
      if (channelId && !/^(-100\d{5,20}|@[a-zA-Z0-9_]{4,32}|-\d{5,20})$/.test(channelId)) {
        return jsonResponse(
          { error: 'Telegram Channel ID must look like -1001234567890 (or @channelusername).' },
          400
        );
      }
      await setSettingRaw(
        context.env.DB,
        'bot_config',
        JSON.stringify({
          appName: String(body.bot.appName || 'Shortlist Studio').slice(0, 60),
          botUsername: String(body.bot.botUsername || '')
            .replace(/^@/, '')
            .slice(0, 64),
          archiveChannelId: channelId,
        })
      );
    }

    const [ai, ads, bot] = await Promise.all([
      getAiConfig(context.env.DB),
      getAdsConfig(context.env.DB),
      getBotServerConfig(context.env.DB, context.env),
    ]);
    return jsonResponse({ saved: true, ai, ads, bot });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to save admin config.' },
      500
    );
  }
}
