import {
  AdNetworksConfig,
  AdminConfigResponse,
  AiRouterConfig,
  ChatQaPayload,
  LayoutMode,
  PublicAppConfig,
  ResumeContent,
  ResumeRecord,
} from '../types/resume';
import { TelegramContext } from './telegram';

function buildHeaders(tg: TelegramContext, extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-workspace-user': tg.workspaceUserId,
    ...extra,
  };
  if (tg.initData) {
    headers['x-telegram-init-data'] = tg.initData;
  }
  return headers;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// --- Public Config ---
export async function fetchPublicConfig(tg: TelegramContext): Promise<PublicAppConfig> {
  const res = await fetch('/api/public-config', { headers: buildHeaders(tg) });
  return parseJsonOrThrow(res);
}

// --- Resumes & Silent Server-Side PDF Export Tracking/Archive ---
export async function fetchResumes(
  tg: TelegramContext
): Promise<{ resumes: ResumeRecord[]; userId: string }> {
  const res = await fetch('/api/resumes', { headers: buildHeaders(tg) });
  return parseJsonOrThrow(res);
}

export async function saveResumeApi(
  tg: TelegramContext,
  record: ResumeRecord
): Promise<{ resume: ResumeRecord }> {
  const res = await fetch('/api/resumes', {
    method: 'POST',
    headers: buildHeaders(tg),
    body: JSON.stringify(record),
  });
  return parseJsonOrThrow(res);
}

export async function recordAndArchivePdfExport(
  tg: TelegramContext,
  pdfBytes: Uint8Array,
  fileName: string,
  roleTitle: string
): Promise<void> {
  try {
    await fetch('/api/resumes/export-pdf', {
      method: 'POST',
      headers: buildHeaders(tg),
      body: JSON.stringify({
        pdfBase64: uint8ToBase64(pdfBytes),
        fileName,
        roleTitle,
      }),
    });
  } catch {
    // Non-blocking background sync — never interrupts download
  }
}

// --- Unified 5-Slot Rotating Free AI Router (/api/ai) ---
async function callAiApi<T>(
  tg: TelegramContext,
  action: string,
  payload: Record<string, unknown>
): Promise<T & { slotUsed?: string; providerUsed?: string }> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: buildHeaders(tg),
    body: JSON.stringify({ action, payload }),
  });
  return parseJsonOrThrow(res);
}

export async function chatBuildResumeApi(
  tg: TelegramContext,
  qa: ChatQaPayload
): Promise<{
  content: ResumeContent;
  assistantMessage: string;
  slotUsed?: string;
  providerUsed?: string;
}> {
  return callAiApi(tg, 'chat-build-resume', qa as unknown as Record<string, unknown>);
}

export async function chatRefineResumeApi(
  tg: TelegramContext,
  payload: { roleLabel: string; instruction: string; content: ResumeContent }
): Promise<{
  content: ResumeContent;
  assistantMessage: string;
  slotUsed?: string;
  providerUsed?: string;
}> {
  return callAiApi(tg, 'chat-refine-resume', payload);
}

export async function matchJdApi(
  tg: TelegramContext,
  payload: { roleLabel: string; jdText: string; resumeContent: ResumeContent }
): Promise<{
  matchedKeywords: string[];
  missingSkills: string[];
  missingTools: string[];
  quickTip: string;
}> {
  return callAiApi(tg, 'match-jd', payload);
}

export async function writeSummaryApi(
  tg: TelegramContext,
  payload: {
    roleLabel: string;
    layoutMode: LayoutMode;
    content: ResumeContent;
    targetKeywords: string[];
  }
): Promise<{ summary: string }> {
  return callAiApi(tg, 'write-summary', payload);
}

export async function coachBulletApi(
  tg: TelegramContext,
  payload: {
    roleLabel: string;
    sectionType: 'experience' | 'project';
    rawNotes: string;
    selectedMetrics: string[];
    targetKeywords: string[];
  }
): Promise<{
  bullets: Array<{
    bulletText: string;
    actionPart: string;
    contextPart: string;
    resultPart: string;
  }>;
}> {
  return callAiApi(tg, 'polish-bullet', payload);
}

// --- Hidden Admin API (Bearer token strictly in memory) ---
export async function fetchAdminAuthStatus(): Promise<{
  needsInitialClaim: boolean;
  adminPasswordFromEnv: boolean;
}> {
  const res = await fetch('/api/admin/auth-status');
  return parseJsonOrThrow(res);
}

export async function claimAdminPassword(password: string): Promise<{ token: string }> {
  const res = await fetch('/api/admin/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJsonOrThrow(res);
}

export async function loginAdmin(password: string): Promise<{ token: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJsonOrThrow(res);
}

export async function fetchAdminConfig(token: string): Promise<AdminConfigResponse> {
  const res = await fetch('/api/admin/config', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonOrThrow(res);
}

export async function saveAdminConfig(
  token: string,
  payload: {
    ai?: AiRouterConfig;
    ads?: AdNetworksConfig;
    bot?: { appName: string; botUsername: string; archiveChannelId: string };
  }
): Promise<{ saved: boolean; ai: AiRouterConfig; ads: AdNetworksConfig }> {
  const res = await fetch('/api/admin/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function testAdminAi(
  token: string,
  slotId?: string
): Promise<{ ok: boolean; slotUsed: string; providerUsed: string }> {
  const res = await fetch('/api/admin/test-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(slotId ? { slotId } : {}),
  });
  return parseJsonOrThrow(res);
}

export async function testAdminChannel(token: string): Promise<{ ok: boolean }> {
  const res = await fetch('/api/admin/test-channel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  return parseJsonOrThrow(res);
}
