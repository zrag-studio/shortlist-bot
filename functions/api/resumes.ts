import { ResumeRecord, TrackPresetId } from '../../src/types/resume';
import { ensureTables, listResumesByUser, touchUser, upsertResume } from './_db';
import { PagesFunctionContext } from './_types';
import { jsonResponse, resolveEdgeUser } from './_utils';

export async function onRequestGet(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const u = await resolveEdgeUser(context.request, context.env);
    await touchUser(context.env.DB, u.userId, u.username, u.firstName);
    const resumes = await listResumesByUser(context.env.DB, u.userId);
    return jsonResponse({ resumes, userId: u.userId });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to fetch resumes.' },
      500
    );
  }
}

export async function onRequestPost(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const u = await resolveEdgeUser(context.request, context.env);
    const body = (await context.request.json()) as Partial<ResumeRecord>;
    if (!body || !body.content) {
      return jsonResponse({ error: 'Invalid resume payload.' }, 400);
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

    const saved = await upsertResume(context.env.DB, record);
    return jsonResponse({ resume: saved });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to save resume.' },
      500
    );
  }
}
