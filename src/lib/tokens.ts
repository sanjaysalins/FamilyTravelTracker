// Edit-token handling (PRD §12). We generate a URL-safe raw token, store ONLY its sha256
// hash on the registration, and build the edit link from the raw token. The raw token is
// shown on the success screen + emailed, and never persisted.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Registration } from './types';

/** A new URL-safe raw token (~43 chars from 32 random bytes). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex of the raw token — this is what we store. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** The guest's private edit link. baseUrl has no trailing slash requirement. */
export function buildEditLink(baseUrl: string, ref: string, rawToken: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/edit/${encodeURIComponent(ref)}?token=${encodeURIComponent(rawToken)}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type TokenCheck = 'ok' | 'invalid' | 'revoked' | 'expired';

/** Verify a raw token against a stored doc. `now` is an ISO timestamp (UTC sorts lexically). */
export function verifyToken(
  rawToken: string,
  doc: Pick<Registration, 'edit_token_hash' | 'edit_token_revoked_at' | 'edit_token_expires_at'>,
  now: string,
): TokenCheck {
  if (doc.edit_token_revoked_at) return 'revoked';
  if (doc.edit_token_expires_at && now > doc.edit_token_expires_at) return 'expired';
  if (!safeEqualHex(hashToken(rawToken), doc.edit_token_hash)) return 'invalid';
  return 'ok';
}
