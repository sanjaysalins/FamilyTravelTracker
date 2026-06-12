// POST /api/find — "Find my registration" (PRD §8.5). ALWAYS returns the same generic outcome,
// whether or not the email matches — we never reveal that a registration exists from an email
// alone. A match triggers a fresh emailed link.
import type { APIRoute } from 'astro';
import type { Registration } from '../../lib/types';
import { store } from '../../lib/store';
import { config } from '../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../lib/csrf';
import { generateToken, hashToken, buildEditLink } from '../../lib/tokens';
import { sendEmail, eventInfo } from '../../lib/email';
import { ackEmail } from '../../lib/email-templates';

export const prerender = false;

function isoPlusDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86400000).toISOString();
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const csrfField = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof csrfField === 'string' ? csrfField : null)) {
    return new Response('Invalid or expired form session. Please reload and try again.', { status: 403 });
  }

  const email = (form.get('email') ?? '').toString().trim().toLowerCase();
  if (email) {
    const match = (await store.listRegistrations()).find((r) => r.email.toLowerCase() === email);
    if (match) {
      // Regenerate the edit token and email the fresh link. Atomicity rule (PRD §12): the OLD link
      // is only invalidated once the NEW one is actually delivered — so on a send failure we keep
      // the old token and just log the failed attempt.
      const now = new Date();
      const nowIso = now.toISOString();
      const rawToken = generateToken();
      const candidate: Registration = {
        ...match,
        edit_token_hash: hashToken(rawToken),
        edit_token_created_at: nowIso,
        edit_token_expires_at: isoPlusDays(now, config.editTokenExpiryDays),
        edit_token_revoked_at: null,
        updated_at: nowIso,
      };
      const editLink = buildEditLink(config.appBaseUrl, candidate.reference_number, rawToken);
      const { doc: withEmail, sent } = await sendEmail(candidate, 'ack', ackEmail(candidate, editLink, eventInfo()), nowIso);
      if (sent) {
        await store.putRegistration(withEmail);            // new token live, old link now dead
      } else {
        // Keep the original token (old link stays valid); still record the failed attempt.
        await store.putRegistration({
          ...withEmail,
          edit_token_hash: match.edit_token_hash,
          edit_token_created_at: match.edit_token_created_at,
          edit_token_expires_at: match.edit_token_expires_at,
          edit_token_revoked_at: match.edit_token_revoked_at,
        });
      }
    }
  }

  // Generic outcome regardless of whether a match was found.
  cookies.set('ftc_find_done', '1', { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 60 });
  return redirect('/find', 303);
};
