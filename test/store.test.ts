// Integration tests for the data layer (src/lib/store.ts) against its local-file backend.
// We run with NETLIFY unset, so store.ts uses the .data/<store>/<key>.json fallback —
// the same code paths used by `npm run dev`. Each run uses an isolated temp cwd.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Registration, VehicleBooking } from '../src/lib/types';
import { store } from '../src/lib/store';

let tmp: string;
const origCwd = process.cwd();

beforeAll(async () => {
  // Force the local-file backend, isolated in a throwaway dir.
  delete process.env.NETLIFY;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
  tmp = await mkdtemp(join(tmpdir(), 'ftt-store-'));
  process.chdir(tmp); // store.ts resolves `.data` relative to cwd at call time
});

afterAll(async () => {
  process.chdir(origCwd);
  await rm(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  // Clean slate between tests.
  await rm(join(tmp, '.data'), { recursive: true, force: true });
});

function makeRegistration(ref: string): Registration {
  return {
    reference_number: ref,
    edit_token_hash: 'hash',
    edit_token_created_at: '2026-06-08T00:00:00Z',
    edit_token_expires_at: null,
    edit_token_revoked_at: null,
    main_contact_first: 'Asha',
    main_contact_surname: 'Rao',
    email: 'asha@example.com',
    phone_raw: '9876543210',
    phone_e164: '+919876543210',
    whatsapp_same_as_phone: true,
    whatsapp_e164: '+919876543210',
    home_city: 'Bengaluru',
    home_country: 'IN',
    relationship: 'niece',
    party_size: 2,
    party_members: [
      { name: 'Asha Rao', age_band: 'adult' },
      { name: 'Riya Rao', age_band: 'child' },
    ],
    special_requirements: null,
    stay_type: 'hotel',
    stay_location: 'Bidar',
    consent_given: true,
    consent_at: '2026-06-08T00:00:00Z',
    status: 'submitted',
    confirmed_at: null,
    edited_after_confirm: false,
    admin_notes: null,
    created_at: '2026-06-08T00:00:00Z',
    updated_at: '2026-06-08T00:00:00Z',
    legs: [
      {
        id: 'leg-1',
        leg_order: 1,
        direction: 'arrival',
        from_location: 'Hyderabad Airport',
        to_location: 'Bidar',
        travel_date: '2026-10-16',
        date_tbc: false,
        travel_time: '14:00',
        time_meaning: 'arrival_at_destination',
        carrier_type: 'flight',
        carrier_ref: '6E123',
        people_on_this_leg: 2,
        transport_needed: true,
        guest_notes: null,
        status: 'requested',
        vehicle_booking_id: null,
        pickup_point: null,
        pickup_time_confirmed: null,
        driver_name: null,
        driver_phone_e164: null,
        admin_notes: null,
        confirmation_sent_at: null,
      },
    ],
    audit: [{ at: '2026-06-08T00:00:00Z', actor: 'guest', action: 'submitted', details: null }],
    emails: [],
  };
}

function makeBooking(id: string): VehicleBooking {
  return {
    id,
    date: '2026-10-16',
    purpose: 'arrival',
    route_from: 'Hyderabad Airport',
    route_to: 'Bidar',
    depart_time: '14:30',
    vehicle_type: 'tempo_traveller',
    seats: 12,
    operator_name: 'ACME Travels',
    operator_contact: '+910000000000',
    quote_amount: 8000,
    currency: 'INR',
    driver_name: null,
    driver_phone_raw: null,
    driver_phone_e164: null,
    vehicle_reg: null,
    status: 'suggested',
    covered_legs: [
      { registration_ref: 'BDAY-2026-0001', leg_id: 'leg-1', family_name: 'Rao', people: 2 },
    ],
    notes: null,
    created_at: '2026-06-08T00:00:00Z',
    updated_at: '2026-06-08T00:00:00Z',
  };
}

describe('registrations', () => {
  it('round-trips a registration (put -> get)', async () => {
    const doc = makeRegistration('BDAY-2026-0001');
    await store.putRegistration(doc);
    const got = await store.getRegistration('BDAY-2026-0001');
    expect(got).toEqual(doc);
    expect(got?.legs[0].carrier_ref).toBe('6E123');
  });

  it('returns null for a missing registration', async () => {
    expect(await store.getRegistration('NOPE')).toBeNull();
  });

  it('lists all registrations', async () => {
    await store.putRegistration(makeRegistration('BDAY-2026-0001'));
    await store.putRegistration(makeRegistration('BDAY-2026-0002'));
    const all = await store.listRegistrations();
    expect(all.map((r) => r.reference_number).sort()).toEqual(['BDAY-2026-0001', 'BDAY-2026-0002']);
  });

  it('deletes a registration', async () => {
    await store.putRegistration(makeRegistration('BDAY-2026-0001'));
    await store.deleteRegistration('BDAY-2026-0001');
    expect(await store.getRegistration('BDAY-2026-0001')).toBeNull();
    expect(await store.listRegistrations()).toEqual([]);
  });

  it('overwrites on re-put with the same reference', async () => {
    const doc = makeRegistration('BDAY-2026-0001');
    await store.putRegistration(doc);
    await store.putRegistration({ ...doc, status: 'confirmed', confirmed_at: '2026-06-09T00:00:00Z' });
    const got = await store.getRegistration('BDAY-2026-0001');
    expect(got?.status).toBe('confirmed');
    expect(await store.listRegistrations()).toHaveLength(1);
  });

  it('fills missing fields with safe defaults when reading an older/partial doc', async () => {
    // simulate a document written before newer fields existed
    await store.putRegistration({
      reference_number: 'BDAY-2026-0099',
      legs: [{ direction: 'arrival', from_location: 'Hyderabad', to_location: 'Bidar' }],
    } as any);

    const got = await store.getRegistration('BDAY-2026-0099');
    expect(got).not.toBeNull();
    expect(got?.reference_number).toBe('BDAY-2026-0099'); // present value kept
    // top-level defaults
    expect(got?.party_size).toBe(1);
    expect(got?.party_members).toEqual([]);
    expect(got?.status).toBe('submitted');
    expect(got?.consent_given).toBe(false);
    expect(got?.emails).toEqual([]);
    expect(got?.audit).toEqual([]);
    // leg defaults, with present values preserved
    expect(got?.legs[0].from_location).toBe('Hyderabad');
    expect(got?.legs[0].leg_order).toBe(1);
    expect(got?.legs[0].status).toBe('requested');
    expect(got?.legs[0].transport_needed).toBe(false);
    expect(got?.legs[0].date_tbc).toBe(false);
  });

  it('normalises through listRegistrations too', async () => {
    await store.putRegistration({ reference_number: 'BDAY-2026-0098', legs: [] } as any);
    const [got] = await store.listRegistrations();
    expect(got.party_size).toBe(1);
    expect(got.legs).toEqual([]);
  });
});

describe('vehicle bookings', () => {
  it('round-trips a booking and keeps cross-family covered_legs', async () => {
    const b = makeBooking('VEH-2026-0001');
    await store.putBooking(b);
    const got = await store.getBooking('VEH-2026-0001');
    expect(got).toEqual(b);
    expect(got?.covered_legs[0].registration_ref).toBe('BDAY-2026-0001');
  });

  it('lists and deletes bookings', async () => {
    await store.putBooking(makeBooking('VEH-2026-0001'));
    await store.putBooking(makeBooking('VEH-2026-0002'));
    expect(await store.listBookings()).toHaveLength(2);
    await store.deleteBooking('VEH-2026-0001');
    const left = await store.listBookings();
    expect(left.map((b) => b.id)).toEqual(['VEH-2026-0002']);
  });
});

describe('system keys', () => {
  it('round-trips an arbitrary system value (e.g. login lockout counter)', async () => {
    await store.putSystem('login_attempts', { count: 3, locked_until: null });
    expect(await store.getSystem('login_attempts')).toEqual({ count: 3, locked_until: null });
  });

  it('returns null for a missing system key', async () => {
    expect(await store.getSystem('does_not_exist')).toBeNull();
  });
});

describe('exportAll backup', () => {
  it('bundles registrations + bookings in the expected shape', async () => {
    await store.putRegistration(makeRegistration('BDAY-2026-0001'));
    await store.putBooking(makeBooking('VEH-2026-0001'));
    const dump = await store.exportAll();
    expect(dump.exported_for).toBe('family-travel-coordinator');
    expect(dump.registrations).toHaveLength(1);
    expect(dump.vehicle_bookings).toHaveLength(1);
  });
});
