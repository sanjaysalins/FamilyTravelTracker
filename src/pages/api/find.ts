// POST /api/find — "Find my registration" (PRD §8.5). ALWAYS returns the same generic outcome,
// whether or not the email matches — we never reveal that a registration exists from an email
// alone. A match triggers a fresh emailed link.
import type { APIRoute } from 'astro';
import { store } from '../../lib/store';
import { config } from '../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../lib/csrf';

export const prerender = false;

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
      // TODO Phase 4 (email): regenerate the edit token (overwrite hash, clear revoked, reset
      // expiry) and email the fresh link via email.ts. Done atomically so the old link is only
      // invalidated when the new one is actually sent. Intentionally a no-op until then.
    }
  }

  // Generic outcome regardless of whether a match was found.
  cookies.set('ftc_find_done', '1', { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 60 });
  return redirect('/find', 303);
};
