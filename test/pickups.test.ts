// /pickups: time ordering + group numbering, driver-detail cleaning, and the driver session
// (must be valid for drivers, and never satisfy the admin session).

import { describe, expect, it } from 'vitest';
import { PICKUPS, cleanDriver, contactsSorted, minutes, orderedPickups, time24 } from '../src/lib/pickups';
import { makeDriverSession, driverSessionValid, hashDriverPassword, verifyDriverPassword } from '../src/lib/driver-auth';
import { sessionValid } from '../src/lib/auth';

const NOW = new Date('2026-10-07T10:00:00.000Z');

describe('ordering', () => {
  it('numbers 1..n in day then time order', () => {
    const o = orderedPickups();
    expect(o.map((p) => p.group)).toEqual(o.map((_, i) => i + 1));
    for (let i = 1; i < o.length; i++) {
      const a = o[i - 1], b = o[i];
      expect(a.day < b.day || (a.day === b.day && minutes(a.time) <= minutes(b.time))).toBe(true);
    }
  });
  it('15 Oct reads 08:30, 18:00, 23:00', () => {
    expect(orderedPickups().filter((p) => p.day === 15).map((p) => time24(p.time))).toEqual(['08:30', '18:00', '23:00']);
  });
  it('ids are unique and contacts are A-Z', () => {
    expect(new Set(PICKUPS.map((p) => p.id)).size).toBe(PICKUPS.length);
    const names = contactsSorted().map((c) => c[0].replace(/^Dr /, ''));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it('time24 handles noon and midnight', () => {
    expect(time24('12:30 PM')).toBe('12:30');
    expect(time24('12:05 AM')).toBe('00:05');
  });
});

describe('cleanDriver', () => {
  it('rejects an unknown pickup id', () => {
    expect(cleanDriver('p999', 'A', '1', 'X')).toBeNull();
    expect(cleanDriver(undefined, 'A', '1', 'X')).toBeNull();
  });
  it('trims, upper-cases the reg, strips junk from the phone, caps length', () => {
    const c = cleanDriver('p5', '  Ravi   Kumar ', '+91 98<script>76', ' ka 38 b 1234 ');
    expect(c).toEqual({ id: 'p5', name: 'Ravi Kumar', phone: '+91 9876', reg: 'KA 38 B 1234' });
    expect(cleanDriver('p5', 'x'.repeat(500), '', '')!.name.length).toBe(80);
  });
});

describe('driver session', () => {
  it('is valid for a driver but not for the admin guard', () => {
    const t = makeDriverSession(NOW);
    expect(driverSessionValid(t, NOW)).toBe(true);
    expect(sessionValid(t, NOW)).toBe(false);
  });
  it('rejects expired, tampered and empty tokens', () => {
    const t = makeDriverSession(NOW);
    expect(driverSessionValid(t, new Date(NOW.getTime() + 24 * 3600_000))).toBe(false);
    expect(driverSessionValid(t.slice(0, -2) + 'xx', NOW)).toBe(false);
    expect(driverSessionValid(undefined, NOW)).toBe(false);
  });
  it('password hash round-trips and fails closed', () => {
    const h = hashDriverPassword('correct horse');
    expect(verifyDriverPassword('correct horse', h)).toBe(true);
    expect(verifyDriverPassword('wrong', h)).toBe(false);
    expect(verifyDriverPassword('x', null)).toBe(false);
  });
  it("an admin token is not a valid driver token", async () => {
    const { makeSession } = await import('../src/lib/auth');
    expect(driverSessionValid(makeSession(NOW), NOW)).toBe(false);
  });
});
