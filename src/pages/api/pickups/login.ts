// POST /api/pickups/login: driver-company login (shared password set by the organiser).
// CSRF-checked and IP-rate-limited with the same counter as the admin login.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { config } from '../../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { type AttemptMap, clientIp, isRateLimited, recordFailure } from '../../../lib/auth';
import { DRIVER_PW_KEY, setDriverSession, verifyDriverPassword } from '../../../lib/driver-auth';

export const prerender = false;
const ATTEMPTS_KEY = 'login_attempts';

function flash(cookies: import('astro').AstroCookies, kind: 'bad' | 'locked' | 'unset') {
  cookies.set('ftc_driver_err', kind, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 30 });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid or expired form session. Please reload and try again.', { status: 403 });
  }
  const now = new Date();
  const key = 'driver:' + clientIp(request);
  const attempts = (await store.getSystem<AttemptMap>(ATTEMPTS_KEY)) ?? {};
  if (isRateLimited(attempts[key], now)) { flash(cookies, 'locked'); return redirect('/driver', 303); }

  const hash = await store.getSystem<string>(DRIVER_PW_KEY);
  if (!hash) { flash(cookies, 'unset'); return redirect('/driver', 303); }

  if (verifyDriverPassword((form.get('password') ?? '').toString(), hash)) {
    if (attempts[key]) { delete attempts[key]; await store.putSystem(ATTEMPTS_KEY, attempts); }
    setDriverSession(cookies, now);
    return redirect('/pickups', 303);
  }
  attempts[key] = recordFailure(attempts[key], now);
  await store.putSystem(ATTEMPTS_KEY, attempts);
  flash(cookies, isRateLimited(attempts[key], now) ? 'locked' : 'bad');
  return redirect('/driver', 303);
};
