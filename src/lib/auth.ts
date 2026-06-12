// Admin auth (plan Phase 5.1, PRD §9 A1). Stateless signed-cookie session (serverless has no
// memory), bcrypt password check against ADMIN_PASSWORD_HASH (never plaintext), and a login
// rate-limit whose counter lives in the Blobs `system` store so it survives a redeploy (Blocker #5).
//
// The pure bits (sign/verify session, rate-limit math) are exported + unit-tested; the store I/O
// and cookie wiring live in the /api/admin/login route.

import type { AstroCookies } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config';

export const SESSION_COOKIE = 'ftc_admin';
const idleMs = () => Math.max(1, config.sessionIdleTimeoutMin) * 60_000;

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
}

/** A signed session token good until now + idle-timeout. Format: `<payloadB64>.<hmac>`. */
export function makeSession(now: Date): string {
  const payload = Buffer.from(JSON.stringify({ exp: now.getTime() + idleMs() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** True iff the token is well-formed, correctly signed, and not past its exp. */
export function sessionValid(token: string | undefined | null, now: Date): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && now.getTime() < exp;
  } catch {
    return false;
  }
}

/** Constant-time-ish bcrypt check. Returns false (never throws) on any bad input. */
export function verifyPassword(plain: string): boolean {
  if (!plain || !config.adminPasswordHash) return false;
  try {
    return bcrypt.compareSync(plain, config.adminPasswordHash);
  } catch {
    return false;
  }
}

/* ---- login rate-limit (counter persisted in the `system` store) ---- */

export interface AttemptRec { count: number; resetAt: number } // resetAt = epoch ms
export type AttemptMap = Record<string, AttemptRec>;

/** Blocked right now? (limit reached and the 60s window hasn't elapsed). */
export function isRateLimited(rec: AttemptRec | undefined, now: Date): boolean {
  if (!rec || now.getTime() >= rec.resetAt) return false;
  return rec.count >= Math.max(1, config.loginRateLimitPerMin);
}

/** New record after a failed attempt — rolls a fresh 60s window if the old one elapsed. */
export function recordFailure(rec: AttemptRec | undefined, now: Date): AttemptRec {
  if (!rec || now.getTime() >= rec.resetAt) return { count: 1, resetAt: now.getTime() + 60_000 };
  return { count: rec.count + 1, resetAt: rec.resetAt };
}

/** Best-effort client IP for the rate-limit key (Netlify header, then XFF). */
export function clientIp(request: Request): string {
  const h = request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('x-forwarded-for')
    || '';
  return h.split(',')[0].trim() || 'unknown';
}

/* ---- cookie helpers shared by pages + endpoints ---- */

function cookieOpts() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.isProd,
    maxAge: Math.max(1, config.sessionIdleTimeoutMin) * 60,
  };
}

export function setSession(cookies: AstroCookies, now: Date): void {
  cookies.set(SESSION_COOKIE, makeSession(now), cookieOpts());
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

/**
 * Route guard for every `/admin/*` page and endpoint. Verifies the session and, when valid,
 * slides the idle window by re-issuing the cookie. Returns false when the caller should redirect
 * to /admin/login.
 */
export function requireSession(cookies: AstroCookies, now: Date): boolean {
  if (!sessionValid(cookies.get(SESSION_COOKIE)?.value, now)) return false;
  setSession(cookies, now); // sliding idle-timeout
  return true;
}
