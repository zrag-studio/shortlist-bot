import { ensureTables, getPublicAppConfig, touchUser } from './_db';
import { PagesFunctionContext } from './_types';
import { jsonResponse, resolveEdgeUser } from './_utils';

export async function onRequestGet(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const u = await resolveEdgeUser(context.request, context.env);
    await touchUser(context.env.DB, u.userId, u.username, u.firstName);
    const config = await getPublicAppConfig(context.env.DB);
    return jsonResponse(config);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to load public config.' },
      500
    );
  }
}
