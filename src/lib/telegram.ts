export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebAppInstance {
  initData: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppInstance;
    };
  }
}

export interface TelegramContext {
  isTelegramMiniApp: boolean;
  initData: string;
  user: TelegramUser | null;
  workspaceUserId: string;
}

export function initTelegramWebApp(): TelegramContext {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

  if (tg && tg.initData && tg.initData.length > 0) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#0A0D12');
      tg.setBackgroundColor?.('#0A0D12');
    } catch {
      // Ignore optional Telegram theme styling errors on older clients
    }

    const user = tg.initDataUnsafe?.user ?? null;
    return {
      isTelegramMiniApp: true,
      initData: tg.initData,
      user,
      workspaceUserId: user ? `tg_${user.id}` : 'tg_guest',
    };
  }

  // Standard web browser workspace session ID
  let localId = 'web_fresher_default';
  try {
    const stored = window.localStorage.getItem('shortlist_workspace_id');
    if (stored && /^[a-zA-Z0-9_-]{4,64}$/.test(stored)) {
      localId = stored;
    } else {
      localId = `web_${crypto.randomUUID().slice(0, 12)}`;
      window.localStorage.setItem('shortlist_workspace_id', localId);
    }
  } catch {
    // Fallback if storage is disabled
  }

  return {
    isTelegramMiniApp: false,
    initData: '',
    user: null,
    workspaceUserId: localId,
  };
}

export function triggerHaptic(type: 'light' | 'success' = 'light') {
  try {
    const hf = window.Telegram?.WebApp?.HapticFeedback;
    if (!hf) return;
    if (type === 'success') {
      hf.notificationOccurred('success');
    } else {
      hf.impactOccurred('light');
    }
  } catch {
    // No-op outside Telegram
  }
}

export function isSafeHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
