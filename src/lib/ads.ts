import { AdNetworksConfig } from '../types/resume';

export type AdTriggerKey = 'onPdfExport';

type ActiveNetwork =
  | { type: 'adsgram'; blockId: string }
  | { type: 'cleanads_rewarded'; placementId: string; testMode: boolean }
  | { type: 'cleanads_interstitial'; placementId: string; testMode: boolean }
  | { type: 'monetag'; zoneId: string };

declare global {
  interface Window {
    Adsgram?: {
      init: (opts: { blockId: string }) => {
        show: () => Promise<unknown>;
      };
    };
    CleanAds?: {
      showRewarded?: (opts: { placementId: string; userId?: string; testMode?: boolean }) => Promise<unknown>;
      showInterstitial?: (opts: { placementId: string; userId?: string; testMode?: boolean }) => Promise<unknown>;
      show?: (opts: { placementId: string; type?: string; userId?: string; testMode?: boolean }) => Promise<unknown>;
    };
    [key: `show_${string}`]: (() => Promise<unknown>) | undefined;
  }
}

const COOLDOWN_STORAGE_KEY = 'shortlist_last_ad_ts';
const ROTATION_INDEX_KEY = 'shortlist_ad_rotation_idx';
const loadedScripts = new Set<string>();

function loadExternalScript(src: string, attrs?: Record<string, string>, timeoutMs = 4500): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (loadedScripts.has(src)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      loadedScripts.add(src);
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        script.setAttribute(k, v);
      }
    }

    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      loadedScripts.add(src);
      resolve(true);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error('ad_timeout')), ms);
    promise
      .then((v) => {
        window.clearTimeout(id);
        resolve(v);
      })
      .catch((err) => {
        window.clearTimeout(id);
        reject(err);
      });
  });
}

async function tryShowNetwork(network: ActiveNetwork, userId: string): Promise<boolean> {
  try {
    if (network.type === 'adsgram') {
      const ok = await loadExternalScript('https://sad.adsgram.ai/js/sad.min.js');
      if (!ok || !window.Adsgram?.init) return false;
      const controller = window.Adsgram.init({ blockId: network.blockId });
      await withTimeout(controller.show(), 25000);
      return true;
    }

    if (network.type === 'cleanads_rewarded' || network.type === 'cleanads_interstitial') {
      const ok = await loadExternalScript('https://cdn.cleanads.io/sdk/telegram.min.js');
      if (!ok || !window.CleanAds) return false;
      const opts = {
        placementId: network.placementId,
        userId,
        testMode: network.testMode,
      };
      if (network.type === 'cleanads_rewarded' && window.CleanAds.showRewarded) {
        await withTimeout(window.CleanAds.showRewarded(opts), 25000);
        return true;
      }
      if (network.type === 'cleanads_interstitial' && window.CleanAds.showInterstitial) {
        await withTimeout(window.CleanAds.showInterstitial(opts), 25000);
        return true;
      }
      if (window.CleanAds.show) {
        await withTimeout(
          window.CleanAds.show({
            ...opts,
            type: network.type === 'cleanads_rewarded' ? 'rewarded' : 'interstitial',
          }),
          25000
        );
        return true;
      }
      return false;
    }

    if (network.type === 'monetag') {
      const fnName = `show_${network.zoneId}` as `show_${string}`;
      const ok = await loadExternalScript('https://libtl.com/sdk.js', {
        'data-zone': network.zoneId,
        'data-sdk': fnName,
      });
      if (!ok) return false;
      const fn = window[fnName];
      if (typeof fn !== 'function') return false;
      await withTimeout(fn(), 25000);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getEnabledNetworks(ads: AdNetworksConfig): ActiveNetwork[] {
  const list: ActiveNetwork[] = [];
  if (ads.adsgram.enabled && ads.adsgram.blockId.trim()) {
    list.push({ type: 'adsgram', blockId: ads.adsgram.blockId.trim() });
  }
  if (ads.cleanadsRewarded.enabled && ads.cleanadsRewarded.placementId.trim()) {
    list.push({
      type: 'cleanads_rewarded',
      placementId: ads.cleanadsRewarded.placementId.trim(),
      testMode: ads.cleanadsTestMode,
    });
  }
  if (ads.cleanadsInterstitial.enabled && ads.cleanadsInterstitial.placementId.trim()) {
    list.push({
      type: 'cleanads_interstitial',
      placementId: ads.cleanadsInterstitial.placementId.trim(),
      testMode: ads.cleanadsTestMode,
    });
  }
  if (ads.monetag.enabled && ads.monetag.zoneId.trim()) {
    list.push({ type: 'monetag', zoneId: ads.monetag.zoneId.trim() });
  }
  return list;
}

export function hasActivePdfAd(adsConfig: AdNetworksConfig | null | undefined): boolean {
  if (!adsConfig || !adsConfig.triggers.onPdfExport) return false;
  return getEnabledNetworks(adsConfig).length > 0;
}

/**
 * Attempts to display a short ad to unlock PDF download, rotating across enabled networks.
 * Always resolves cleanly on no-fill/timeout so the user is never trapped.
 */
export async function maybeShowAd(
  trigger: AdTriggerKey,
  adsConfig: AdNetworksConfig | null | undefined,
  userId: string
): Promise<{ shown: boolean; network?: string }> {
  if (!adsConfig || !adsConfig.triggers[trigger]) {
    return { shown: false };
  }

  const networks = getEnabledNetworks(adsConfig);
  if (networks.length === 0) {
    return { shown: false };
  }

  try {
    const lastTs = Number(window.localStorage.getItem(COOLDOWN_STORAGE_KEY) || '0');
    const cooldownMs = Math.max(0, adsConfig.cooldownMinutes) * 60 * 1000;
    if (cooldownMs > 0 && Date.now() - lastTs < cooldownMs) {
      return { shown: false };
    }
  } catch {
    // Ignore
  }

  let startIdx = 0;
  try {
    startIdx = Number(window.localStorage.getItem(ROTATION_INDEX_KEY) || '0') % networks.length;
  } catch {
    startIdx = 0;
  }

  for (let offset = 0; offset < networks.length; offset++) {
    const idx = (startIdx + offset) % networks.length;
    const candidate = networks[idx];
    const shown = await tryShowNetwork(candidate, userId);
    if (shown) {
      try {
        window.localStorage.setItem(COOLDOWN_STORAGE_KEY, String(Date.now()));
        window.localStorage.setItem(ROTATION_INDEX_KEY, String((idx + 1) % networks.length));
      } catch {
        // Ignore
      }
      return { shown: true, network: candidate.type };
    }
  }

  return { shown: false };
}

export function extractPublicAdId(
  rawInput: string,
  kind: 'adsgram' | 'cleanads' | 'monetag'
): string {
  const input = rawInput.trim();
  if (!input) return '';

  if (kind === 'monetag') {
    const dataZone = input.match(/data-zone=["']?(\d+)["']?/i);
    if (dataZone?.[1]) return dataZone[1];
    const showZone = input.match(/show_(\d+)/i);
    if (showZone?.[1]) return showZone[1];
    return input.replace(/[^0-9]/g, '').slice(0, 32);
  }

  if (kind === 'adsgram') {
    const blockMatch = input.match(/blockId\s*[:=]\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    if (blockMatch?.[1]) return blockMatch[1];
    return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  }

  const placeMatch = input.match(
    /(?:placementId|data-placement|unitId)\s*[:=]\s*["']?([a-zA-Z0-9_-]+)["']?/i
  );
  if (placeMatch?.[1]) return placeMatch[1];
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}
