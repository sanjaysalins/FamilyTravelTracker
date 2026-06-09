// Tests for the form -> Registration builder (the bug-prone wire-format seam).
// Fully synchronous/pure — no browser, no I/O.

import { describe, expect, it } from 'vitest';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import { hashToken } from '../src/lib/tokens';

const NOW = '2026-06-09T10:00:00.000Z';
const RAW = 'raw-token-value-123';

function input(fields: Record<string, string>): BuildInput {
  return { fields, reference: 'BDAY-2026-0001', rawToken: RAW, now: NOW, expiresAt: null };
}

// A minimal set of valid fields (only the blocking ones filled).
function validFields(extra: Record<string, string> = {}): Record<string, string> {
  return {
    first: 'Rashid',
    surname: 'Khan',
    email: 'rashid@example.com',
    phone: '98765 43210',
    home_country: 'India',
    party_size: '4',
    consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_transport: 'yes',
    ...extra,
  };
}

function ok(res: ReturnType<typeof buildRegistration>) {
  if (!res.ok) throw new Error('expected ok, got errors: ' + JSON.stringify(res.errors));
  return res.doc;
}

describe('buildRegistration — happy path', () => {
  it('creates a doc with exactly one arrival + one departure, server-derived order', () => {
    const doc = ok(buildRegistration(input(validFields())));
    expect(doc.legs).toHaveLength(2);
    expect(doc.legs.map((l) => l.direction)).toEqual(['arrival', 'departure']);
    expect(doc.legs.map((l) => l.leg_order)).toEqual([1, 2]);
    expect(doc.reference_number).toBe('BDAY-2026-0001');
    expect(doc.status).toBe('submitted');
    expect(doc.consent_given).toBe(true);
    expect(doc.audit[0].action).toBe('submitted');
  });

  it('stores the token HASH, never the raw token, anywhere in the doc', () => {
    const doc = ok(buildRegistration(input(validFields())));
    expect(doc.edit_token_hash).toBe(hashToken(RAW));
    expect(JSON.stringify(doc)).not.toContain(RAW);
  });

  it('normalises the phone to E.164 and mirrors WhatsApp when "same"', () => {
    const doc = ok(buildRegistration(input(validFields({ wa_same: 'on' }))));
    expect(doc.phone_e164).toBe('+919876543210');
    expect(doc.whatsapp_same_as_phone).toBe(true);
    expect(doc.whatsapp_e164).toBe('+919876543210');
  });

  it('people_on_this_leg defaults to party_size, but a per-leg override wins', () => {
    const doc = ok(buildRegistration(input(validFields({ arr_people: '2' }))));
    expect(doc.legs[0].people_on_this_leg).toBe(2); // arrival override
    expect(doc.legs[1].people_on_this_leg).toBe(4); // departure default = party_size
  });
});

describe('buildRegistration — internal legs (wire format)', () => {
  it('seeds internal legs from legs_json between arrival and departure, orders 1..N', () => {
    const legs_json = JSON.stringify([
      { from: 'Bidar', to: 'Gulbarga', date: '2026-10-18', people: '2', transport: 'yes' },
    ]);
    const doc = ok(buildRegistration(input(validFields({ legs_json }))));
    expect(doc.legs.map((l) => l.direction)).toEqual(['arrival', 'internal', 'departure']);
    expect(doc.legs.map((l) => l.leg_order)).toEqual([1, 2, 3]);
    expect(doc.legs[1].people_on_this_leg).toBe(2);
  });

  it('caps internal legs at 2 even if more are posted', () => {
    const legs_json = JSON.stringify([
      { from: 'A', to: 'B', transport: 'yes' },
      { from: 'C', to: 'D', transport: 'yes' },
      { from: 'E', to: 'F', transport: 'yes' },
    ]);
    const doc = ok(buildRegistration(input(validFields({ legs_json }))));
    expect(doc.legs.filter((l) => l.direction === 'internal')).toHaveLength(2);
    expect(doc.legs).toHaveLength(4);
    expect(doc.legs[3].direction).toBe('departure');
    expect(doc.legs[3].leg_order).toBe(4);
  });

  it('ignores malformed legs_json without throwing', () => {
    const doc = ok(buildRegistration(input(validFields({ legs_json: 'not json' }))));
    expect(doc.legs).toHaveLength(2);
  });

  it('falls back to flat int1_/int2_ fields when legs_json is absent (no-JS path)', () => {
    const doc = ok(buildRegistration(input(validFields({
      int1_from: 'Bidar', int1_to: 'Gulbarga', int1_date: '2026-10-18', int1_people: '2', int1_transport: 'yes',
    }))));
    expect(doc.legs.map((l) => l.direction)).toEqual(['arrival', 'internal', 'departure']);
    expect(doc.legs[1].from_location).toBe('Bidar');
    expect(doc.legs[1].people_on_this_leg).toBe(2);
  });
});

describe('buildRegistration — transport answer mapping (PRD §7.4)', () => {
  it('"no" -> not_required + transport_needed false', () => {
    const doc = ok(buildRegistration(input(validFields({ arr_transport: 'no' }))));
    expect(doc.legs[0].transport_needed).toBe(false);
    expect(doc.legs[0].status).toBe('not_required');
  });
  it('"not_sure" -> requested + transport_needed true (treated as yes)', () => {
    const doc = ok(buildRegistration(input(validFields({ arr_transport: 'not_sure' }))));
    expect(doc.legs[0].transport_needed).toBe(true);
    expect(doc.legs[0].status).toBe('requested');
  });
});

describe('buildRegistration — leniency (never block on missing travel detail)', () => {
  it('allows blank dates/times/carrier and a TBC date', () => {
    const doc = ok(buildRegistration(input(validFields({ arr_tbc: 'on', arr_date: '', arr_time: '', arr_ref: '' }))));
    expect(doc.legs[0].date_tbc).toBe(true);
    expect(doc.legs[0].travel_date).toBeNull();
    expect(doc.legs[0].travel_time).toBeNull();
    expect(doc.legs[0].carrier_ref).toBeNull();
    expect(doc.legs[0].time_meaning).toBeNull(); // no time => no meaning
  });
});

describe('buildRegistration — validation blocks', () => {
  it('collects errors for missing/invalid required fields', () => {
    const res = buildRegistration(input({ email: 'bad', party_size: '0' }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors).toHaveProperty('first');
    expect(res.errors).toHaveProperty('email'); // invalid format
    expect(res.errors).toHaveProperty('phone');
    expect(res.errors).toHaveProperty('home_country');
    expect(res.errors).toHaveProperty('party_size'); // 0 < 1
    expect(res.errors).toHaveProperty('consent');
    expect(res.errors).toHaveProperty('arr_from');
    expect(res.errors).toHaveProperty('dep_transport');
  });

  it('rejects an unanswered transport question', () => {
    const res = buildRegistration(input(validFields({ arr_transport: '' })));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toHaveProperty('arr_transport');
  });
});
