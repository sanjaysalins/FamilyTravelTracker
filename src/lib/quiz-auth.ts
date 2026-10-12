// Birthday-quiz host access. The quiz itself (/quiz) is public. Sybil's answers page and the results
// page are protected: either by the organiser's admin session, or by the quiz password (a second,
// narrower login). Same signed-cookie idea as driver-auth.ts, but its own cookie + role, so a quiz
// cookie never satisfies requireSession() and the quiz password never opens /admin.

import type { APIContext, AstroCookies } from 'astro';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from './csrf';
import { SESSION_COOKIE, sessionValid, setSession } from './auth';

export const QUIZ_COOKIE = 'ftc_quiz';
export const DEVICE_COOKIE = 'ftc_quiz_dev';
/** bcrypt hash of the host password; QUIZ_PASSWORD_HASH (env) overrides it. */
const DEFAULT_PASSWORD_HASH = '$2a$10$LXm3RxSET/S6K5eQmwXcneaI7qUe83q8p6wnr7H9gAFkIGMbU/jSi';
const idleMs = () => Math.max(1, config.sessionIdleTimeoutMin) * 60_000 * 8; // the host keeps these pages open all evening

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update('quiz.' + payload).digest('base64url');
}

export function makeQuizSession(now: Date): string {
  const payload = Buffer.from(JSON.stringify({ role: 'quiz', exp: now.getTime() + idleMs() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function quizSessionValid(token: string | undefined | null, now: Date): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { role, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return role === 'quiz' && typeof exp === 'number' && now.getTime() < exp;
  } catch {
    return false;
  }
}

export function verifyQuizPassword(plain: string): boolean {
  if (!plain) return false;
  try { return bcrypt.compareSync(plain, config.quizPasswordHash || DEFAULT_PASSWORD_HASH); } catch { return false; }
}

export function setQuizSession(cookies: AstroCookies, now: Date): void {
  cookies.set(QUIZ_COOKIE, makeQuizSession(now), {
    path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: Math.floor(idleMs() / 1000),
  });
}

export function clearQuizSession(cookies: AstroCookies): void {
  cookies.delete(QUIZ_COOKIE, { path: '/' });
}

/** Who may use the host pages right now: the organiser (admin session) or someone with the quiz password. */
export function quizHost(cookies: AstroCookies, now: Date): 'admin' | 'quiz' | null {
  if (sessionValid(cookies.get(SESSION_COOKIE)?.value, now)) return 'admin';
  if (quizSessionValid(cookies.get(QUIZ_COOKIE)?.value, now)) return 'quiz';
  return null;
}

/** Slide the idle window of whichever session is in use. */
export function touchQuizHost(cookies: AstroCookies, role: 'admin' | 'quiz', now: Date): void {
  if (role === 'admin') setSession(cookies, now);
  else setQuizSession(cookies, now);
}

/** Guard for host POST endpoints: session + CSRF, then hand back the parsed form. */
export async function quizHostPost(ctx: APIContext): Promise<{ form: FormData } | Response> {
  const now = new Date();
  const role = quizHost(ctx.cookies, now);
  if (!role) return ctx.redirect('/quiz/login', 303);
  const form = await ctx.request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(ctx.cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid form session. Please reload.', { status: 403 });
  }
  touchQuizHost(ctx.cookies, role, now);
  return { form };
}

/** The phone's anonymous id: one quiz entry per device. Created on first visit, kept 30 days. */
export function deviceId(cookies: AstroCookies): { id: string; fresh: boolean } {
  const existing = cookies.get(DEVICE_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return { id: existing, fresh: false };
  return { id: randomBytes(18).toString('base64url'), fresh: true };
}

export function setDeviceCookie(cookies: AstroCookies, id: string): void {
  cookies.set(DEVICE_COOKIE, id, {
    path: '/', httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 30 * 24 * 3600,
  });
}

export { CSRF_COOKIE };
