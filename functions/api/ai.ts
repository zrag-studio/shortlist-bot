import { ChatQaPayload, ResumeContent } from '../../src/types/resume';
import { checkAndIncrementUserAiChat, ensureTables, getAiConfig } from './_db';
import { PagesFunctionContext } from './_types';
import { jsonResponse, resolveEdgeUser, runRoutedJsonAiEdge } from './_utils';

export async function onRequestPost(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const u = await resolveEdgeUser(context.request, context.env);
    const body = (await context.request.json()) as {
      action?: string;
      payload?: Record<string, unknown>;
    };
    const { action, payload } = body || {};
    if (!action || !payload) {
      return jsonResponse({ error: 'Missing AI action or payload.' }, 400);
    }

    const countInAnalytics = action !== 'chat-refine-resume';
    const quota = await checkAndIncrementUserAiChat(context.env.DB, u.userId, countInAnalytics);
    if (!quota.allowed) {
      return jsonResponse(
        { error: `Daily AI limit reached (${quota.limit} AI chats/day). Resets tomorrow!` },
        429
      );
    }

    const aiConfig = await getAiConfig(context.env.DB);

    if (action === 'chat-build-resume') {
      const qa = payload as unknown as ChatQaPayload;
      if (!qa.fullName || !qa.roleLabel) {
        return jsonResponse({ error: 'Name and target role are required.' }, 400);
      }
      const out = await runRoutedJsonAiEdge<{ content: ResumeContent; assistantMessage: string }>(
        context.env,
        aiConfig,
        `You build an ATS-ready single-page resume from short user Q&A answers in ONE compact pass.
Rules:
- Never fabricate companies, degrees, or fake GPA numbers.
- Write a crisp 3-line summary (45-65 words, no "I/my") with 3-5 **bold** ATS keywords.
- Rewrite experience & project bullets using Action -> Context -> Result with **bold** key metrics/skills (2-3 bullets per item).
- Categorize skills cleanly into coreExpertise (6-10 items) and tools (4-8 items).
- Return strict JSON: {"assistantMessage":"1 short confirmation sentence","content":{"header":{"fullName":"","targetTitle":"","phone":"","email":"","location":"","linkedinUrl":""},"summary":"","coreExpertise":[],"tools":[],"education":[{"id":"edu-1","institution":"","location":"","degree":"","graduationYear":"","gpaOrScore":"","highlights":[]}],"experience":[{"id":"exp-1","organization":"","location":"","roleTitle":"","duration":"","bullets":[]}],"projects":[{"id":"proj-1","title":"","subtitle":"","bullets":[]}],"certifications":[{"id":"cert-1","title":"","issuerOrYear":"","bullets":[]}],"virtualExperience":[]}}.`,
        `Role: ${String(qa.roleLabel).slice(0, 120)} (${qa.layoutMode === 'switcher' ? 'Experienced' : 'Fresher/Student'})
Name: ${String(qa.fullName).slice(0, 100)} | City: ${String(qa.city || '').slice(0, 80)}
Contact: ${String(qa.contact || '').slice(0, 220)}
Education: ${String(qa.education || '').slice(0, 800)}
Experience/Internships: ${String(qa.experience || 'None (Fresher)').slice(0, 1500)}
Projects: ${String(qa.projects || 'None').slice(0, 1200)}
Skills & Tools: ${String(qa.skillsAndTools || '').slice(0, 800)}
Certifications/Awards: ${String(qa.certifications || 'None').slice(0, 600)}`
      );
      return jsonResponse({ ...out.data, slotUsed: out.slotUsed, providerUsed: out.providerUsed });
    }

    if (action === 'chat-refine-resume') {
      const instruction = String(payload.instruction || '').trim();
      if (instruction.length < 4) {
        return jsonResponse({ error: 'Describe what you want changed.' }, 400);
      }
      const out = await runRoutedJsonAiEdge<{ content: ResumeContent; assistantMessage: string }>(
        context.env,
        aiConfig,
        'Apply a targeted edit to an ATS resume JSON based on the user request. Preserve truthful facts. Return JSON {"assistantMessage":"Short confirmation","content":{...full ResumeContent...}}.',
        `Role: ${String(payload.roleLabel || 'Resume').slice(0, 120)}
Request: "${instruction.slice(0, 600)}"
Current Resume JSON: ${JSON.stringify(payload.content)}`
      );
      return jsonResponse({ ...out.data, slotUsed: out.slotUsed, providerUsed: out.providerUsed });
    }

    if (action === 'match-jd') {
      const jdText = String(payload.jdText || '').trim();
      if (jdText.length < 25) {
        return jsonResponse({ error: 'Paste a job description (at least 25 characters).' }, 400);
      }
      const resumeContent = (payload.resumeContent || {}) as ResumeContent;
      const out = await runRoutedJsonAiEdge<{
        matchedKeywords: string[];
        missingSkills: string[];
        missingTools: string[];
        quickTip: string;
      }>(
        context.env,
        aiConfig,
        'Compare resume against 1 JD for ATS keywords. Return JSON {"matchedKeywords":[],"missingSkills":[],"missingTools":[],"quickTip":""}.',
        `Role: ${String(payload.roleLabel || 'Fresher').slice(0, 120)}
JD: ${jdText.slice(0, 3000)}
Skills: ${(resumeContent.coreExpertise || []).join(', ')} | Tools: ${(resumeContent.tools || []).join(', ')}`
      );
      return jsonResponse({ ...out.data, providerUsed: out.providerUsed });
    }

    if (action === 'write-summary') {
      const content = (payload.content || {}) as ResumeContent;
      const out = await runRoutedJsonAiEdge<{ summary: string }>(
        context.env,
        aiConfig,
        'Write a crisp 3-line ATS summary (45-65 words, no "I/my") with 3-5 **bold** keywords. Return JSON {"summary":""}.',
        `Role: ${String(payload.roleLabel || 'Fresher').slice(0, 120)}
Education: ${(content.education || []).map((e) => `${e.degree} at ${e.institution}`).join('; ')}
Skills: ${[...(content.coreExpertise || []), ...(content.tools || [])].join(', ')}`
      );
      return jsonResponse({ ...out.data, providerUsed: out.providerUsed });
    }

    if (action === 'polish-bullet') {
      const rawNotes = String(payload.rawNotes || '').trim();
      if (rawNotes.length < 5) {
        return jsonResponse({ error: 'Enter a short description of what you worked on.' }, 400);
      }
      const out = await runRoutedJsonAiEdge<{
        bullets: Array<{
          bulletText: string;
          actionPart: string;
          contextPart: string;
          resultPart: string;
        }>;
      }>(
        context.env,
        aiConfig,
        'Rewrite rough notes into 3 Action-Context-Result ATS bullets (18-30 words each, **bold** metrics). Return JSON {"bullets":[{"bulletText":"","actionPart":"","contextPart":"","resultPart":""}]}.',
        `Role: ${String(payload.roleLabel || 'Fresher').slice(0, 120)} | Section: ${
          payload.sectionType === 'project' ? 'project' : 'experience'
        }
Notes: ${rawNotes.slice(0, 1200)}
Metrics: ${Array.isArray(payload.selectedMetrics) ? (payload.selectedMetrics as string[]).join('; ') : 'None'}`
      );
      return jsonResponse({ ...out.data, providerUsed: out.providerUsed });
    }

    return jsonResponse({ error: 'Unknown AI action.' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI request failed.';
    return jsonResponse({ error: msg }, msg.includes('Daily AI') ? 429 : 500);
  }
}
