import { GoogleGenAI } from '@google/genai';
import {
  AiProviderKind,
  AiRouterConfig,
  AiSlotConfig,
  ChatQaPayload,
  LayoutMode,
  ResumeContent,
} from '../src/types/resume';
import { recordAiSlotResult } from './db';

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

const VALID_GEMINI_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
]);

async function callGeminiProvider(
  modelRequested: string,
  systemInstruction: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }

  const safeModel = VALID_GEMINI_MODELS.has(modelRequested)
    ? modelRequested
    : 'gemini-4-hydrogen';

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const response = await ai.models.generateContent({
    model: safeModel,
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  return extractJsonText(response.text ?? '{}');
}

async function callOpenAiCompatibleProvider(
  providerName: string,
  endpoint: string,
  apiKey: string | undefined,
  envHint: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  if (!apiKey) {
    throw new Error(`${envHint} is not configured in server secrets.`);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${systemInstruction} Output strictly valid JSON only.` },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`${providerName} HTTP ${res.status}: ${txt.slice(0, 140)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return extractJsonText(data.choices?.[0]?.message?.content ?? '{}');
}

async function callWorkersAiRestProvider(
  modelRequested: string,
  systemInstruction: string,
  userPrompt: string
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare Workers AI runs natively via [ai] binding on Cloudflare Pages (or set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN).'
    );
  }

  const model = modelRequested || '@cf/meta/llama-3.1-8b-instruct';
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `${systemInstruction} Output strictly valid JSON only.` },
          { role: 'user', content: userPrompt },
        ],
      }),
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Workers AI HTTP ${res.status}: ${txt.slice(0, 140)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const data = (await res.json()) as { result?: { response?: string } };
  return extractJsonText(data.result?.response ?? '{}');
}

async function invokeSlot(
  slot: AiSlotConfig,
  systemInstruction: string,
  userPrompt: string
): Promise<string> {
  switch (slot.provider) {
    case 'gemini':
      return callGeminiProvider(slot.model, systemInstruction, userPrompt);
    case 'workers_ai':
      return callWorkersAiRestProvider(slot.model, systemInstruction, userPrompt);
    case 'groq':
      return callOpenAiCompatibleProvider(
        'Groq',
        'https://api.groq.com/openai/v1/chat/completions',
        process.env.GROQ_API_KEY,
        'GROQ_API_KEY',
        slot.model || 'llama-3.3-70b-versatile',
        systemInstruction,
        userPrompt
      );
    case 'openrouter':
      return callOpenAiCompatibleProvider(
        'OpenRouter',
        'https://openrouter.ai/api/v1/chat/completions',
        process.env.OPENROUTER_API_KEY,
        'OPENROUTER_API_KEY',
        slot.model || 'meta-llama/llama-3.3-70b-instruct:free',
        systemInstruction,
        userPrompt,
        { 'X-Title': 'Shortlist Studio' }
      );
    case 'cerebras':
      return callOpenAiCompatibleProvider(
        'Cerebras',
        'https://api.cerebras.ai/v1/chat/completions',
        process.env.CEREBRAS_API_KEY,
        'CEREBRAS_API_KEY',
        slot.model || 'llama3.1-8b',
        systemInstruction,
        userPrompt
      );
    default:
      throw new Error(`Unsupported provider ${slot.provider}`);
  }
}

function isQuotaError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    status === 429 ||
    status === 402 ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('insufficient')
  );
}

/**
 * 5-Slot Auto-Rotating Free AI Router:
 * Automatically skips slots on cooldown and rotates to the next enabled slot
 * whenever a provider hits token/rate limits (429) or errors out.
 */
export async function runRoutedJsonAi<T>(
  aiConfig: AiRouterConfig,
  systemInstruction: string,
  userPrompt: string,
  onlySlotId?: string
): Promise<{ data: T; slotUsed: string; providerUsed: AiProviderKind }> {
  const now = Date.now();
  const candidates = onlySlotId
    ? aiConfig.slots.filter((s) => s.id === onlySlotId)
    : aiConfig.slots.filter((s) => s.enabled);

  if (candidates.length === 0) {
    throw new Error('No AI slots are enabled in Admin settings.');
  }

  // Try non-cooldown slots first; if all are cooling down, still try them as last resort
  const activeReady = candidates.filter(
    (s) => !s.cooldownUntil || new Date(s.cooldownUntil).getTime() <= now
  );
  const ordered =
    onlySlotId || activeReady.length === 0
      ? candidates
      : [
          ...activeReady,
          ...candidates.filter((s) => s.cooldownUntil && new Date(s.cooldownUntil).getTime() > now),
        ];

  const errors: string[] = [];
  for (const slot of ordered) {
    try {
      const jsonStr = await invokeSlot(slot, systemInstruction, userPrompt);
      const parsed = JSON.parse(jsonStr) as T;
      recordAiSlotResult(slot.id, true);
      return { data: parsed, slotUsed: slot.label, providerUsed: slot.provider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed';
      recordAiSlotResult(slot.id, false, msg, isQuotaError(err));
      errors.push(`${slot.label}: ${msg}`);
    }
  }

  throw new Error(`All enabled AI slots failed (${errors.join(' | ')})`);
}

// --- Ultra-Token-Optimized 1-Call Q&A Chat Resume Builder ---
export async function aiBuildResumeFromChat(aiConfig: AiRouterConfig, qa: ChatQaPayload) {
  return runRoutedJsonAi<{ content: ResumeContent; assistantMessage: string }>(
    aiConfig,
    `You build an ATS-ready single-page resume from short user Q&A answers in ONE compact pass.
Rules:
- Never fabricate companies, degrees, or fake GPA numbers.
- Write a crisp 3-line summary (45-65 words, no "I/my") with 3-5 **bold** ATS keywords.
- Rewrite experience & project bullets using Action -> Context -> Result with **bold** key metrics/skills (2-3 bullets per item).
- Categorize skills cleanly into coreExpertise (6-10 items) and tools (4-8 items).
- Return strict JSON: {"assistantMessage":"1 friendly short sentence confirming what you crafted","content":{"header":{"fullName":"","targetTitle":"","phone":"","email":"","location":"","linkedinUrl":""},"summary":"","coreExpertise":[],"tools":[],"education":[{"id":"edu-1","institution":"","location":"","degree":"","graduationYear":"","gpaOrScore":"","highlights":[]}],"experience":[{"id":"exp-1","organization":"","location":"","roleTitle":"","duration":"","bullets":[]}],"projects":[{"id":"proj-1","title":"","subtitle":"","bullets":[]}],"certifications":[{"id":"cert-1","title":"","issuerOrYear":"","bullets":[]}],"virtualExperience":[]}}.
Leave empty arrays [] for sections the user skipped.`,
    `Role: ${qa.roleLabel} (${qa.layoutMode === 'fresher' ? 'Fresher/Student' : 'Experienced'})
Name: ${qa.fullName} | City: ${qa.city}
Contact: ${qa.contact}
Education: ${qa.education}
Experience/Internships: ${qa.experience || 'None (Fresher)'}
Projects: ${qa.projects || 'None'}
Skills & Tools: ${qa.skillsAndTools}
Certifications/Awards: ${qa.certifications || 'None'}`
  );
}

export async function aiRefineResumeFromChat(
  aiConfig: AiRouterConfig,
  params: { roleLabel: string; instruction: string; content: ResumeContent }
) {
  return runRoutedJsonAi<{ content: ResumeContent; assistantMessage: string }>(
    aiConfig,
    'You apply a targeted edit to an ATS resume JSON based on the user request. Preserve all existing truthful facts. Return JSON {"assistantMessage":"Short confirmation of what changed","content":{...full ResumeContent...}}.',
    `Role: ${params.roleLabel}
User tweak request: "${params.instruction.slice(0, 600)}"
Current Resume JSON: ${JSON.stringify(params.content)}`
  );
}

export async function aiMatchJobDescription(
  aiConfig: AiRouterConfig,
  params: { roleLabel: string; jdText: string; resumeContent: ResumeContent }
) {
  return runRoutedJsonAi<{
    matchedKeywords: string[];
    missingSkills: string[];
    missingTools: string[];
    quickTip: string;
  }>(
    aiConfig,
    'Compare resume against 1 JD for ATS keywords. Return JSON {"matchedKeywords":[],"missingSkills":[],"missingTools":[],"quickTip":""}.',
    `Role: ${params.roleLabel}
JD: ${params.jdText.slice(0, 3000)}
Current Skills: ${params.resumeContent.coreExpertise.join(', ')} | Tools: ${params.resumeContent.tools.join(', ')}
Summary: ${params.resumeContent.summary}`
  );
}

export async function aiWriteSummary(
  aiConfig: AiRouterConfig,
  params: {
    roleLabel: string;
    layoutMode: LayoutMode;
    content: ResumeContent;
    targetKeywords: string[];
  }
) {
  return runRoutedJsonAi<{ summary: string }>(
    aiConfig,
    'Write a 3-line ATS summary (45-65 words, no "I/my") with 3-5 **bold** keywords. Return JSON {"summary":""}.',
    `Role: ${params.roleLabel} (${params.layoutMode})
Education: ${params.content.education.map((e) => `${e.degree} at ${e.institution}`).join('; ')}
Experience: ${params.content.experience.map((e) => `${e.roleTitle} at ${e.organization}`).join('; ')}
Projects: ${params.content.projects.map((p) => p.title).join('; ')}
Skills: ${[...params.content.coreExpertise, ...params.content.tools].join(', ')}
Keywords: ${params.targetKeywords.slice(0, 10).join(', ')}`
  );
}

export async function aiPolishBullet(
  aiConfig: AiRouterConfig,
  params: {
    roleLabel: string;
    sectionType: 'experience' | 'project';
    rawNotes: string;
    selectedMetrics: string[];
    targetKeywords: string[];
  }
) {
  return runRoutedJsonAi<{
    bullets: Array<{
      bulletText: string;
      actionPart: string;
      contextPart: string;
      resultPart: string;
    }>;
  }>(
    aiConfig,
    'Rewrite rough notes into 3 Action-Context-Result ATS bullets (18-30 words each, **bold** metrics). Return JSON {"bullets":[{"bulletText":"","actionPart":"","contextPart":"","resultPart":""}]}.',
    `Role: ${params.roleLabel} | Section: ${params.sectionType}
Notes: ${params.rawNotes.slice(0, 1200)}
Metrics: ${params.selectedMetrics.join('; ') || 'None'}
Keywords: ${params.targetKeywords.slice(0, 8).join(', ')}`
  );
}
