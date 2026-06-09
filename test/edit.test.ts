// Tests for the edit flow logic: prefill round-trip (docToFormValues) and the
// edit-after-confirm cascade (applyEdit). Pure — no browser, no I/O.

import { describe, expect, it } from 'vitest';
import { applyEdit, buildRegistration, docToFormValues, type BuildInput } from '../src/lib/registration-form';
import type { Registration } from '../src/lib/types';

const NOW = '2026-06-09T10:00:00.000Z';
const LATER = '2026-07-01T09:00:00.000Z';

function build(fields: Record<string, string>, ref = 'BDAY-2026-0001'): Registration {
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: NOW, expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error('build failed: ' + JSON.stringify(res.errors));
  return res.doc;
}

function baseFields(extra: Record<string, string> = {}): Record<string, string> {
  return {
    first: 'Rashid', surname: 'Khan', email: 'rashid@example.com', phone: '98765 43210',
    phone_region: 'IN', wa_same: 'on', home_country: 'India', party_size: '4', consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_time: '10:15', arr_mode: 'flight', arr_ref: '6E7123', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_time: '07:00', dep_mode: 'flight', dep_ref: '6E7124', dep_transport: 'yes',
    ...extra,
  };
}

describe('docToFormValues — prefill round-trips through the builder', () => {
  it('rebuilding from prefilled values reproduces the guest-facing data', () => {
    const original = build(baseFields({
      int1_from: 'Bidar', int1_to: 'Gulbarga', int1_date: '2026-10-18', int1_people: '2', int1_transport: 'yes',
      special_requirements: 'Step-free pickup please',
    }));
    const values = docToFormValues(original);
    const rebuilt = build({ ...values, phone_region: 'IN' });

    expect(rebuilt.main_contact_first).toBe('Rashid');
    expect(rebuilt.email).toBe('rashid@example.com');
    expect(rebuilt.party_size).toBe(4);
    expect(rebuilt.special_requirements).toBe('Step-free pickup please');
    expect(rebuilt.legs.map((l) => l.direction)).toEqual(['arrival', 'internal', 'departure']);
    expect(rebuilt.legs[0].carrier_type).toBe('flight');
    expect(rebuilt.legs[0].carrier_ref).toBe('6E7123');
    expect(rebuilt.legs[1].from_location).toBe('Bidar');
    expect(rebuilt.legs[1].people_on_this_leg).toBe(2);
  });

  it('preserves a "leave by" departure note across the round-trip', () => {
    const original = build(baseFields({ dep_leaveby: '04:30' }));
    expect(original.legs.find((l) => l.direction === 'departure')?.guest_notes).toContain('04:30');
    const rebuilt = build({ ...docToFormValues(original), phone_region: 'IN' });
    expect(rebuilt.legs.find((l) => l.direction === 'departure')?.guest_notes).toContain('04:30');
  });
});

describe('applyEdit — edit-after-confirm cascade', () => {
  // A confirmed registration whose legs the admin has already confirmed + assigned.
  function confirmedDoc(): Registration {
    const doc = build(baseFields());
    doc.status = 'confirmed';
    doc.confirmed_at = '2026-06-05T00:00:00Z';
    for (const leg of doc.legs) {
      leg.status = 'confirmed';
      leg.vehicle_booking_id = 'VEH-2026-0001';
      leg.driver_name = 'Ravi';
      leg.driver_phone_e164 = '+919000000000';
      leg.confirmation_sent_at = '2026-06-06T00:00:00Z';
    }
    return doc;
  }

  it('resets only the TOUCHED confirmed leg to planned; untouched stays confirmed', () => {
    const existing = confirmedDoc();
    // Guest edits ONLY the arrival time.
    const rebuilt = build(baseFields({ arr_time: '11:45' }));
    const out = applyEdit(existing, rebuilt, LATER);

    const arr = out.legs.find((l) => l.direction === 'arrival')!;
    const dep = out.legs.find((l) => l.direction === 'departure')!;
    expect(arr.status).toBe('planned');   // touched -> reset
    expect(dep.status).toBe('confirmed'); // untouched -> stays confirmed

    // registration flagged + dropped to in_review
    expect(out.status).toBe('in_review');
    expect(out.edited_after_confirm).toBe(true);
    expect(out.audit.some((a) => a.action === 'edited_after_confirm')).toBe(true);
    expect(out.audit.some((a) => a.action === 'edited')).toBe(true);
  });

  it('preserves admin leg-planning (driver, booking id) on the touched leg', () => {
    const existing = confirmedDoc();
    const rebuilt = build(baseFields({ arr_time: '11:45' }));
    const arr = applyEdit(existing, rebuilt, LATER).legs.find((l) => l.direction === 'arrival')!;
    expect(arr.vehicle_booking_id).toBe('VEH-2026-0001');
    expect(arr.driver_name).toBe('Ravi');
    expect(arr.id).toBe(existing.legs.find((l) => l.direction === 'arrival')!.id);
  });

  it('preserves token, created_at, reference, and emails; updates updated_at', () => {
    const existing = confirmedDoc();
    existing.emails = [{ at: NOW, type: 'ack', to_email: 'x@y.z', subject: 'Hi', status: 'sent', error_message: null }];
    const out = applyEdit(existing, build(baseFields({ arr_time: '11:45' })), LATER);
    expect(out.reference_number).toBe(existing.reference_number);
    expect(out.edit_token_hash).toBe(existing.edit_token_hash);
    expect(out.created_at).toBe(existing.created_at);
    expect(out.updated_at).toBe(LATER);
    expect(out.emails).toHaveLength(1);
  });

  it('a non-confirmed edit keeps status and does not set the flag', () => {
    const existing = build(baseFields());
    existing.status = 'in_review';
    const out = applyEdit(existing, build(baseFields({ arr_time: '09:00' })), LATER);
    expect(out.status).toBe('in_review');
    expect(out.edited_after_confirm).toBe(false);
  });

  it('turns a leg to not_required when the guest now declines transport', () => {
    const existing = confirmedDoc();
    const out = applyEdit(existing, build(baseFields({ arr_transport: 'no' })), LATER);
    expect(out.legs.find((l) => l.direction === 'arrival')!.status).toBe('not_required');
  });
});
