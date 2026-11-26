import { AiProviderKind, AiRouterConfig, AiSlotConfig } from '../../src/types/resume';
import { recordAiSlotResultEdge } from './_db';
import { PagesEnv } from './_types';

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function sanitizeUserId(raw: string | null): string {
  if (!raw) return 'web_user_default';
  const cleaned = raw.trim();
  return /^[a-zA-Z0-9_-]{3,64}$/.test(cleaned) ? cleaned : 'web_user_default';
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return atob(padded);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyTelegramInitDataEdge(
  initData: string,
  botToken: string
): Promise<{ userId: string; username: string; firstName: string } | null> {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash) return null;
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const enc = new TextEncoder();
    const webAppKey = await crypto.subtle.importKey(
      'raw',
      enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyBytes = await crypto.subtle.sign('HMAC', webAppKey, enc.encode(botToken));

    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const computedSig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const computedHex = bytesToHex(new Uint8Array(computedSig));

    if (!constantTimeEqual(computedHex.toLowerCase(), receivedHash.toLowerCase())) {
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

export async function resolveEdgeUser(
  request: Request,
  env: PagesEnv
): Promise<{ userId: string; username: string; firstName: string }> {
  const initData = request.headers.get('x-telegram-init-data') || '';
  if (initData && env.TELEGRAM_BOT_TOKEN) {
    const verified = await verifyTelegramInitDataEdge(initData, env.TELEGRAM_BOT_TOKEN);
    if (verified) return verified;
  }
  const url = new URL(request.url);
  const rawId = request.headers.get('x-workspace-user') || url.searchParams.get('userId');
  return { userId: sanitizeUserId(rawId), username: '', firstName: '' };
}

export async function hashPasswordEdge(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    256
  );
  return `pbkdf2:${bytesToHex(saltBytes)}:${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifyPasswordHashEdge(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const [, saltHex, hashHex] = parts;
  const saltBytes = new Uint8Array(
    (saltHex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16))
  );
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    256
  );
  return constantTimeEqual(bytesToHex(new Uint8Array(derived)), hashHex);
}

function getSigningSecret(env: PagesEnv): string {
  return (
    env.ADMIN_SESSION_SECRET ||
    env.ADMIN_PASSWORD ||
    env.TELEGRAM_BOT_TOKEN ||
    'shortlist-edge-signing-key-configure-admin-secret'
  );
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function createAdminTokenEdge(env: PagesEnv): Promise<string> {
  const payload = toBase64Url(
    JSON.stringify({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 })
  );
  const sig = await signPayload(payload, getSigningSecret(env));
  return `${payload}.${sig}`;
}

export async function verifyAdminTokenEdge(request: Request, env: PagesEnv): Promise<boolean> {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = await signPayload(payload, getSigningSecret(env));
  if (!constantTimeEqual(sig, expected)) return false;
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { role?: string; exp?: number };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function safeCompareStrings(a: string, b: string): boolean {
  return constantTimeEqual(a, b);
}

// --- 5-Slot Auto-Rotating Edge AI Router ---
function extractJsonPayload<T>(rawText: string): T {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) return JSON.parse(fence[1].trim()) as T;
    const objStart = trimmed.indexOf('{');
    const objEnd = trimmed.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      return JSON.parse(trimmed.slice(objStart, objEnd + 1)) as T;
    }
    throw new Error('AI returned unreadable JSON format.');
  }
}

async function callGeminiEdge(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string
): Promise<string> {
  const safeModel =
    model === 'gemini-2.0-flash' || !model ? 'gemini-4-hydrogen' : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    safeModel
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = new Error(`Gemini HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response.');
  return text;
}

async function callOpenAiCompatibleEdge(
  providerName: string,
  endpoint: string,
  apiKey: string | undefined,
  envHint: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  if (!apiKey) throw new Error(`${envHint} not set`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${systemInstruction} Output valid JSON only.` },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = new Error(`${providerName} HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${providerName} returned empty response.`);
  return text;
}

async function invokeSlotEdge(
  env: PagesEnv,
  slot: AiSlotConfig,
  systemInstruction: string,
  userPrompt: string
): Promise<string> {
  if (slot.provider === 'workers_ai') {
    if (!env.AI) throw new Error('Workers AI binding (AI) not configured.');
    const result = await env.AI.run(slot.model || '@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: `${systemInstruction} Output strictly valid JSON only.` },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1800,
      temperature: 0.3,
    });
    return typeof result.response === 'string' ? result.response : JSON.stringify(result);
  }
  if (slot.provider === 'gemini') {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
    return callGeminiEdge(env.GEMINI_API_KEY, slot.model, systemInstruction, userPrompt);
  }
  if (slot.provider === 'groq') {
    return callOpenAiCompatibleEdge(
      'Groq',
      'https://api.groq.com/openai/v1/chat/completions',
      env.GROQ_API_KEY,
      'GROQ_API_KEY',
      slot.model || 'llama-3.3-70b-versatile',
      systemInstruction,
      userPrompt
    );
  }
  if (slot.provider === 'openrouter') {
    return callOpenAiCompatibleEdge(
      'OpenRouter',
      'https://openrouter.ai/api/v1/chat/completions',
      env.OPENROUTER_API_KEY,
      'OPENROUTER_API_KEY',
      slot.model || 'meta-llama/llama-3.3-70b-instruct:free',
      systemInstruction,
      userPrompt,
      { 'X-Title': 'Shortlist Studio' }
    );
  }
  if (slot.provider === 'cerebras') {
    return callOpenAiCompatibleEdge(
      'Cerebras',
      'https://api.cerebras.ai/v1/chat/completions',
      env.CEREBRAS_API_KEY,
      'CEREBRAS_API_KEY',
      slot.model || 'llama3.1-8b',
      systemInstruction,
      userPrompt
    );
  }
  throw new Error(`Unsupported provider: ${slot.provider}`);
}

export async function runRoutedJsonAiEdge<T>(
  env: PagesEnv,
  config: AiRouterConfig,
  systemInstruction: string,
  userPrompt: string,
  onlySlotId?: string
): Promise<{ data: T; slotUsed: string; providerUsed: AiProviderKind }> {
  const now = Date.now();
  const candidates = onlySlotId
    ? config.slots.filter((s) => s.id === onlySlotId)
    : config.slots.filter((s) => s.enabled);

  if (candidates.length === 0) {
    throw new Error('No AI slots are enabled.');
  }

  const ready = candidates.filter(
    (s) => !s.cooldownUntil || new Date(s.cooldownUntil).getTime() <= now
  );
  const ordered =
    onlySlotId || ready.length === 0
      ? candidates
      : [
          ...ready,
          ...candidates.filter((s) => s.cooldownUntil && new Date(s.cooldownUntil).getTime() > now),
        ];

  const errors: string[] = [];
  for (const slot of ordered) {
    try {
      const raw = await invokeSlotEdge(env, slot, systemInstruction, userPrompt);
      const parsed = extractJsonPayload<T>(raw);
      await recordAiSlotResultEdge(env.DB, slot.id, true);
      return { data: parsed, slotUsed: slot.label, providerUsed: slot.provider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed';
      const status = (err as { status?: number })?.status;
      const isQuota =
        status === 429 ||
        status === 402 ||
        msg.toLowerCase().includes('429') ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('rate limit');
      await recordAiSlotResultEdge(env.DB, slot.id, false, msg, isQuota);
      errors.push(`${slot.label}: ${msg}`);
    }
  }

  throw new Error(`All enabled AI slots failed (${errors.join(' | ')})`);
}
