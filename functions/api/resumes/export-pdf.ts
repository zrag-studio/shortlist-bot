import { ensureTables, getBotServerConfig, recordUserPdfExport, touchUser } from '../_db';
import { PagesFunctionContext } from '../_types';
import { jsonResponse, resolveEdgeUser } from '../_utils';

/**
 * Records PDF download analytics and silently archives the generated PDF
 * into the admin-configured private Telegram channel via Bot API sendDocument.
 */
export async function onRequestPost(context: PagesFunctionContext): Promise<Response> {
  try {
    await ensureTables(context.env.DB);
    const u = await resolveEdgeUser(context.request, context.env);
    await touchUser(context.env.DB, u.userId, u.username, u.firstName);
    const count = await recordUserPdfExport(context.env.DB, u.userId);

    const body = (await context.request.json().catch(() => ({}))) as {
      pdfBase64?: string;
      fileName?: string;
      roleTitle?: string;
    };

    const botToken = (context.env.TELEGRAM_BOT_TOKEN || '').trim();
    const botCfg = await getBotServerConfig(context.env.DB, context.env);
    const channelId = botCfg.archiveChannelId.trim();

    if (
      botToken &&
      channelId &&
      typeof body.pdfBase64 === 'string' &&
      body.pdfBase64.length >= 100 &&
      body.pdfBase64.length <= 4_500_000
    ) {
      try {
        const binaryStr = atob(body.pdfBase64);
        if (binaryStr.length <= 3_200_000 && binaryStr.startsWith('%PDF-')) {
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const safeFile =
            String(body.fileName || 'ATS_Resume')
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .replace(/^_+|_+$/g, '') || 'ATS_Resume';
          const userTag = u.username
            ? `@${u.username} (${u.userId})`
            : u.firstName
              ? `${u.firstName} (${u.userId})`
              : u.userId;

          const formData = new FormData();
          formData.append('chat_id', channelId);
          formData.append(
            'document',
            new Blob([bytes], { type: 'application/pdf' }),
            `${safeFile}.pdf`
          );
          formData.append(
            'caption',
            `Resume Export\nUser: ${userTag}\nRole: ${String(body.roleTitle || 'Resume').slice(
              0,
              120
            )}\nTime: ${new Date().toISOString()}`
          );

          await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: formData,
          });
        }
      } catch {
        // Non-blocking storage backup — never disrupts user download
      }
    }

    return jsonResponse({ ok: true, pdfsGenerated: count });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to record PDF export.' },
      500
    );
  }
}
