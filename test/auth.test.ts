// Phase 5.1 — auth: signed session round-trip + expiry + tamper, and the login rate-limit math.

import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  makeSession, sessionValid, verifyPassword, isRateLimited, recordFailure, clientIp,
} from '../src/lib/auth';

const NOW = new Date('2026-06-12T10:00:00.000Z');

describe('session token', () => {
  it('round-trips a freshly signed token', () => {
    const t = makeSession(NOW);
    expect(sessionValid(t, NOW)).toBe(true);
  });

  it('rejects empty / malformed tokens', () => {
    expect(sessionValid(undefined, NOW)).toBe(false);
    expect(sessionValid('', NOW)).toBe(false);
    expect(sessionValid('nodot', NOW)).toBe(false);
    expect(sessionValid('.onlysig', NOW)).toBe(false);
  });

  it('rejects a tampered payload (signature no longer matches)', () => {
    const t = makeSession(NOW);
    const [, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ exp: NOW.getTime() + 9e9 })).toString('base64url');
    expect(sessionValid(`${forged}.${sig}`, NOW)).toBe(false);
  });

  it('rejects once past the idle expiry (default 30 min)', () => {
    const t = makeSession(NOW);
    const later = new Date(NOW.getTime() + 31 * 60_000);
    expect(sessionValid(t, later)).toBe(false);
    const justInside = new Date(NOW.getTime() + 29 * 60_000);
    expect(sessionValid(t, justInside)).toBe(true);
  });
});

describe('password', () => {
  it('verifies against a bcrypt hash and rejects the wrong password', () => {
    // config.adminPasswordHash is empty in test; verify the bcrypt path directly.
    const hash = bcrypt.hashSync('correct horse', 10);
    expect(bcrypt.compareSync('correct horse', hash)).toBe(true);
    expect(bcrypt.compareSync('wrong', hash)).toBe(false);
  });
  it('verifyPassword returns false when no hash is configured', () => {
    expect(verifyPassword('anything')).toBe(false); // no ADMIN_PASSWORD_HASH in test env
  });
});

describe('rate-limit', () => {
  it('not limited with no prior attempts', () => {
    expect(isRateLimited(undefined, NOW)).toBe(false);
  });

  it('blocks after the configured number of failures within the window (default 5)', () => {
    let rec = recordFailure(undefined, NOW);            // 1
    for (let i = 0; i < 3; i++) rec = recordFailure(rec, NOW); // 2,3,4
    expect(isRateLimited(rec, NOW)).toBe(false);        // 4 < 5
    rec = recordFailure(rec, NOW);                      // 5
    expect(isRateLimited(rec, NOW)).toBe(true);
  });

  it('window resets after 60s, clearing the block', () => {
    let rec = recordFailure(undefined, NOW);
    for (let i = 0; i < 5; i++) rec = recordFailure(rec, NOW);
    expect(isRateLimited(rec, NOW)).toBe(true);
    const after = new Date(NOW.getTime() + 61_000);
    expect(isRateLimited(rec, after)).toBe(false);      // window elapsed
    const next = recordFailure(rec, after);             // rolls a fresh window at count 1
    expect(next.count).toBe(1);
  });
});

describe('clientIp', () => {
  it('prefers the Netlify header, then XFF, then unknown', () => {
    const mk = (h: Record<string, string>) => new Request('https://x.test', { headers: h });
    expect(clientIp(mk({ 'x-nf-client-connection-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIp(mk({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9');
    expect(clientIp(mk({}))).toBe('unknown');
  });
});
