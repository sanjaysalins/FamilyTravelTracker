// Driver-company access for /pickups. A second, narrower login: it can ONLY edit driver details
// (name, phone, car reg), never the admin area. The shared password is set by the organiser in the
// app (stored bcrypt-hashed in the `system` store), so no Netlify env change is needed.
// Same signed-cookie idea as auth.ts but a different cookie + role, so a driver cookie never
// satisfies requireSession().

import type { AstroCookies } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { SESSION_COOKIE, sessionValid } from './auth';

export const DRIVER_COOKIE = 'ftc_driver';
export const DRIVER_PW_KEY = 'driver_password_hash';
const idleMs = () => Math.max(1, config.sessionIdleTimeoutMin) * 60_000 * 8; // longer window: drivers keep the page open

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret).update('driver.' + payload).digest('base64url');
}

export function makeDriverSession(now: Date): string {
  const payload = Buffer.from(JSON.stringify({ role: 'driver', exp: now.getTime() + idleMs() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function driverSessionValid(token: string | undefined | null, now: Date): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { role, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return role === 'driver' && typeof exp === 'number' && now.getTime() < exp;
  } catch {
    return false;
  }
}

export function hashDriverPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyDriverPassword(plain: string, hash: string | null | undefined): boolean {
  if (!plain || !hash) return false;
  try { return bcrypt.compareSync(plain, hash); } catch { return false; }
}

export function setDriverSession(cookies: AstroCookies, now: Date): void {
  cookies.set(DRIVER_COOKIE, makeDriverSession(now), {
    path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: Math.floor(idleMs() / 1000),
  });
}

export function clearDriverSession(cookies: AstroCookies): void {
  cookies.delete(DRIVER_COOKIE, { path: '/' });
}

/** Who may edit driver details right now: the organiser (admin session) or the driver company. */
export function editorRole(cookies: AstroCookies, now: Date): 'admin' | 'driver' | null {
  if (sessionValid(cookies.get(SESSION_COOKIE)?.value, now)) return 'admin';
  if (driverSessionValid(cookies.get(DRIVER_COOKIE)?.value, now)) return 'driver';
  return null;
}
