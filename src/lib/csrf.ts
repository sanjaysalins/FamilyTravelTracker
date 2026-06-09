// CSRF — double-submit cookie (cross-cutting Definition of Done). On a GET that renders a
// form, the server sets a random token in a cookie AND renders the same token into a hidden
// field. On POST it requires the two to match. The cookie is HttpOnly because the SERVER
// (SSR) injects the field value — the browser never needs to read it.
//
// IMPORTANT: the Phase 2b localStorage autosave must EXCLUDE this field.

import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE = 'ftc_csrf';
export const CSRF_FIELD = 'csrf_token';

/** A fresh CSRF token. */
export function issueCsrf(): string {
  return randomBytes(24).toString('base64url');
}

/** Constant-time equality of the cookie value and the posted field value. */
export function verifyCsrf(cookieVal: string | null | undefined, fieldVal: string | null | undefined): boolean {
  if (!cookieVal || !fieldVal) return false;
  const a = Buffer.from(cookieVal);
  const b = Buffer.from(fieldVal);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
