// POST /api/admin/login (PRD §9 A1). CSRF-checked, IP-rate-limited (counter in the `system` store
// so it survives redeploys), bcrypt password check. On success: signed session cookie + redirect to
// /admin. On failure: increment the attempt counter, flash an error, back to the login page.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { config } from '../../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import {
  type AttemptMap, clientIp, isRateLimited, recordFailure, setSession, verifyPassword,
} from '../../../lib/auth';

export const prerender = false;

const ATTEMPTS_KEY = 'login_attempts';

function flashErr(cookies: import('astro').AstroCookies, kind: 'bad' | 'locked') {
  cookies.set('ftc_admin_err', kind, {
    path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 30,
  });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const csrfField = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof csrfField === 'string' ? csrfField : null)) {
    return new Response('Invalid or expired form session. Please reload and try again.', { status: 403 });
  }

  const now = new Date();
  const ip = clientIp(request);
  const attempts = (await store.getSystem<AttemptMap>(ATTEMPTS_KEY)) ?? {};

  // Rate-limit BEFORE checking the password (don't let lockout be bypassed by spamming).
  if (isRateLimited(attempts[ip], now)) {
    flashErr(cookies, 'locked');
    return redirect('/admin/login', 303);
  }

  const password = (form.get('password') ?? '').toString();
  if (verifyPassword(password)) {
    if (attempts[ip]) { delete attempts[ip]; await store.putSystem(ATTEMPTS_KEY, attempts); }
    setSession(cookies, now);
    return redirect('/admin', 303);
  }

  attempts[ip] = recordFailure(attempts[ip], now);
  await store.putSystem(ATTEMPTS_KEY, attempts);
  flashErr(cookies, isRateLimited(attempts[ip], now) ? 'locked' : 'bad');
  return redirect('/admin/login', 303);
};
