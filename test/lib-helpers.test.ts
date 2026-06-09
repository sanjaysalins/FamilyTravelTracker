// Unit tests for the Phase 2a foundation helpers: reference numbers, edit tokens,
// phone normalisation, date display, and CSRF.

import { describe, expect, it } from 'vitest';
import { nextReference, refPrefix } from '../src/lib/reference';
import { buildEditLink, generateToken, hashToken, verifyToken } from '../src/lib/tokens';
import { normalizePhone } from '../src/lib/phone';
import { humanDate, toDDMMYYYY } from '../src/lib/dates';
import { issueCsrf, verifyCsrf } from '../src/lib/csrf';

describe('reference numbers', () => {
  it('starts at 0001 for an empty store', () => {
    expect(nextReference([], '2026')).toBe('BDAY-2026-0001');
  });
  it('takes the max suffix + 1 (safe over seeded data)', () => {
    const seeded = Array.from({ length: 9 }, (_, i) => `${refPrefix('2026')}${String(i + 1).padStart(4, '0')}`);
    expect(nextReference(seeded, '2026')).toBe('BDAY-2026-0010');
  });
  it('ignores references from other years / other prefixes', () => {
    expect(nextReference(['BDAY-2025-0099', 'OTHER-1', 'BDAY-2026-0003'], '2026')).toBe('BDAY-2026-0004');
  });
});

describe('edit tokens', () => {
  it('hashes deterministically and never equals the raw token', () => {
    const raw = generateToken();
    expect(raw.length).toBeGreaterThan(20);
    const h = hashToken(raw);
    expect(h).toHaveLength(64); // sha256 hex
    expect(h).not.toBe(raw);
    expect(hashToken(raw)).toBe(h); // deterministic
  });

  it('builds an edit link with the raw token in the query', () => {
    expect(buildEditLink('https://x.test/', 'BDAY-2026-0001', 'abc')).toBe(
      'https://x.test/edit/BDAY-2026-0001?token=abc',
    );
  });

  it('verifyToken accepts a good token and rejects bad/revoked/expired', () => {
    const raw = generateToken();
    const base = { edit_token_hash: hashToken(raw), edit_token_revoked_at: null, edit_token_expires_at: null as string | null };
    expect(verifyToken(raw, base, '2026-06-09T00:00:00Z')).toBe('ok');
    expect(verifyToken('wrong', base, '2026-06-09T00:00:00Z')).toBe('invalid');
    expect(verifyToken(raw, { ...base, edit_token_revoked_at: '2026-06-01T00:00:00Z' }, '2026-06-09T00:00:00Z')).toBe('revoked');
    expect(verifyToken(raw, { ...base, edit_token_expires_at: '2026-06-08T00:00:00Z' }, '2026-06-09T00:00:00Z')).toBe('expired');
  });
});

describe('phone normalisation', () => {
  it('normalises a messy Indian mobile to E.164', () => {
    expect(normalizePhone('98765 43210', 'IN').e164).toBe('+919876543210');
  });
  it('keeps an explicit international number', () => {
    expect(normalizePhone('+44 7700 900123').e164).toBe('+447700900123');
  });
  it('never rejects junk — keeps raw, e164 null', () => {
    const r = normalizePhone('call me maybe', 'IN');
    expect(r.raw).toBe('call me maybe');
    expect(r.e164).toBeNull();
  });
  it('empty input is e164 null', () => {
    expect(normalizePhone('').e164).toBeNull();
  });
});

describe('date display', () => {
  it('formats DD-MM-YYYY and a human label', () => {
    expect(toDDMMYYYY('2026-10-16')).toBe('16-10-2026');
    expect(humanDate('2026-10-16')).toBe('16 Oct 2026');
    expect(toDDMMYYYY(null)).toBe('');
    expect(humanDate(null)).toBe('');
  });
});

describe('csrf', () => {
  it('round-trips a matching token and rejects mismatches/empties', () => {
    const t = issueCsrf();
    expect(verifyCsrf(t, t)).toBe(true);
    expect(verifyCsrf(t, t + 'x')).toBe(false);
    expect(verifyCsrf(t, 'other')).toBe(false);
    expect(verifyCsrf(null, t)).toBe(false);
    expect(verifyCsrf(t, '')).toBe(false);
  });
});
