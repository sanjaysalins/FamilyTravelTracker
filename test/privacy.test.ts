// Phase 7 — retention timing (pure) + delete-leaves-no-PII (against the local file store).

import { afterAll, describe, expect, it } from 'vitest';
import { isRetentionDue, deleteRegistrationCascade } from '../src/lib/privacy';
import { store } from '../src/lib/store';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import type { Registration, VehicleBooking } from '../src/lib/types';

describe('isRetentionDue', () => {
  const end = '2026-10-19';
  it('false before the window, true after', () => {
    expect(isRetentionDue(end, 60, new Date('2026-11-01T00:00:00Z'))).toBe(false); // ~13 days after
    expect(isRetentionDue(end, 60, new Date('2027-01-01T00:00:00Z'))).toBe(true);  // >60 days after
  });
  it('handles a bad date safely', () => {
    expect(isRetentionDue('not-a-date', 30, new Date('2030-01-01Z'))).toBe(false);
  });
});

function reg(ref: string): Registration {
  const fields: Record<string, string> = {
    first: 'Priya', surname: 'Secret', email: 'priya.secret@example.com', phone: '98765 43210', phone_region: 'IN',
    wa_same: 'on', home_country: 'India', party_size: '2', consent: 'on', special_requirements: 'wheelchair',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_mode: 'flight', arr_ref: '6E1', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_mode: 'flight', dep_ref: '6E2', dep_transport: 'yes',
  };
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: '2026-06-12T10:00:00Z', expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.doc;
}

const REF = 'BDAY-9999-7001'; // a test-only year so we never collide with real/seed data

describe('deleteRegistrationCascade leaves no PII', () => {
  afterAll(async () => { await store.deleteRegistration(REF); }); // belt-and-braces cleanup

  it('removes the document and scrubs the family from shared bookings', async () => {
    const doc = reg(REF);
    await store.putRegistration(doc);
    const legId = doc.legs[0].id;
    const booking: VehicleBooking = {
      id: 'VEH-9999-7001', date: '2026-10-16', purpose: 'arrival', route_from: 'Hyderabad', route_to: 'Bidar', depart_time: '10:00',
      vehicle_type: 'car', seats: 4, operator_name: null, operator_contact: null, quote_amount: null, currency: 'INR',
      driver_name: null, driver_phone_raw: null, driver_phone_e164: null, vehicle_reg: null, status: 'to_book',
      covered_legs: [{ registration_ref: REF, leg_id: legId, family_name: 'Secret', people: 2 }],
      notes: null, created_at: '2026-06-12T10:00:00Z', updated_at: '2026-06-12T10:00:00Z',
    };
    await store.putBooking(booking);

    await deleteRegistrationCascade(REF, '2026-11-01T00:00:00Z');

    expect(await store.getRegistration(REF)).toBeNull();
    const dump = JSON.stringify(await store.exportAll());
    expect(dump).not.toContain('priya.secret@example.com');
    expect(dump).not.toContain('wheelchair');
    expect(dump).not.toContain(REF);

    await store.deleteBooking('VEH-9999-7001');
  });
});
