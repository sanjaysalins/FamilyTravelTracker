// POST /api/quiz/login: the quiz host password (Sybil's page + results). CSRF-checked and IP-rate-limited
// with the same persisted counter as the admin login. Success -> a quiz-only cookie, then to the page
// asked for (only the two host pages are allowed as a target).
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { config } from '../../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { type AttemptMap, clientIp, isRateLimited, recordFailure } from '../../../lib/auth';
import { setQuizSession, verifyQuizPassword } from '../../../lib/quiz-auth';

export const prerender = false;
const ATTEMPTS_KEY = 'login_attempts';
const TARGETS: Record<string, string> = { sybil: '/quiz/sybil', results: '/quiz/results' };

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid or expired form session. Please reload and try again.', { status: 403 });
  }
  const next = TARGETS[(form.get('next') ?? '').toString()] ? (form.get('next') ?? '').toString() : 'results';
  const back = `/quiz/login?next=${next}`;
  const flash = (kind: 'bad' | 'locked') =>
    cookies.set('ftc_quiz_err', kind, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 30 });

  const now = new Date();
  const key = 'quiz:' + clientIp(request);
  const attempts = (await store.getSystem<AttemptMap>(ATTEMPTS_KEY)) ?? {};
  if (isRateLimited(attempts[key], now)) { flash('locked'); return redirect(back, 303); }

  if (verifyQuizPassword((form.get('password') ?? '').toString())) {
    if (attempts[key]) { delete attempts[key]; await store.putSystem(ATTEMPTS_KEY, attempts); }
    setQuizSession(cookies, now);
    return redirect(TARGETS[next], 303);
  }
  attempts[key] = recordFailure(attempts[key], now);
  await store.putSystem(ATTEMPTS_KEY, attempts);
  flash(isRateLimited(attempts[key], now) ? 'locked' : 'bad');
  return redirect(back, 303);
};
