// Tests the "book selected together" backend the Pickup Dispatch Board relies on:
// createBookingFromLegIds groups several plannable legs (sharing date + route) into ONE booking and
// back-links each leg. Runs against the local-file store backend (NETLIFY unset), like store.test.ts.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Registration, TransportLeg } from '../src/lib/types';
import { store } from '../src/lib/store';
import { createBookingFromLegIds } from '../src/lib/vehicles';

let tmp: string;
const origCwd = process.cwd();
const NOW = '2026-06-13T00:00:00Z';

beforeAll(async () => {
  delete process.env.NETLIFY;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
  tmp = await mkdtemp(join(tmpdir(), 'ftt-dispatch-'));
  process.chdir(tmp);
});

afterAll(async () => {
  process.chdir(origCwd);
  await rm(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(join(tmp, '.data'), { recursive: true, force: true });
});

function arrivalLeg(id: string, over: Partial<TransportLeg> = {}): TransportLeg {
  return {
    id,
    leg_order: 1,
    direction: 'arrival',
    from_location: 'Hyderabad Airport',
    to_location: 'Bidar',
    travel_date: '2026-10-15',
    date_tbc: false,
    travel_time: '10:00',
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
    ...over,
  };
}

function reg(ref: string, leg: TransportLeg): Registration {
  return {
    reference_number: ref,
    edit_token_hash: 'h', edit_token_created_at: NOW, edit_token_expires_at: null, edit_token_revoked_at: null,
    main_contact_first: 'A', main_contact_surname: ref.slice(-1), email: `${ref}@e.test`,
    phone_raw: '9876543210', phone_e164: '+919876543210', whatsapp_same_as_phone: true, whatsapp_e164: '+919876543210',
    home_city: 'X', home_country: 'IN', relationship: 'cousin',
    party_size: leg.people_on_this_leg, party_members: [], special_requirements: null,
    stay_type: 'hotel', stay_location: 'Bidar', consent_given: true, consent_at: NOW,
    status: 'submitted', confirmed_at: null, edited_after_confirm: false, admin_notes: null,
    created_at: NOW, updated_at: NOW, legs: [leg], audit: [], emails: [],
  };
}

describe('createBookingFromLegIds (dispatch "book together")', () => {
  it('groups several legs sharing a date + route into one booking and back-links each leg', async () => {
    await store.putRegistration(reg('BDAY-2026-0001', arrivalLeg('leg-a', { people_on_this_leg: 3 })));
    await store.putRegistration(reg('BDAY-2026-0002', arrivalLeg('leg-b', { people_on_this_leg: 2 })));

    const booking = await createBookingFromLegIds(['leg-a', 'leg-b'], NOW);

    expect(booking).not.toBeNull();
    expect(booking!.covered_legs.map((c) => c.leg_id).sort()).toEqual(['leg-a', 'leg-b']);
    expect(booking!.covered_legs.reduce((s, c) => s + c.people, 0)).toBe(5);
    expect(booking!.seats).toBeGreaterThanOrEqual(5); // Innova (7) is the smallest that fits 5

    // Each covered leg now points back at the booking.
    for (const ref of ['BDAY-2026-0001', 'BDAY-2026-0002']) {
      const r = await store.getRegistration(ref);
      expect(r!.legs[0].vehicle_booking_id).toBe(booking!.id);
    }
  });

  it('only books legs that share the first leg\'s date + route (defends a mixed selection)', async () => {
    await store.putRegistration(reg('BDAY-2026-0001', arrivalLeg('leg-a')));
    // Same date, DIFFERENT route — must not be pulled into the same booking.
    await store.putRegistration(reg('BDAY-2026-0002', arrivalLeg('leg-c', { from_location: 'Bengaluru' })));

    const booking = await createBookingFromLegIds(['leg-a', 'leg-c'], NOW);

    expect(booking!.covered_legs.map((c) => c.leg_id)).toEqual(['leg-a']);
    const other = await store.getRegistration('BDAY-2026-0002');
    expect(other!.legs[0].vehicle_booking_id).toBeNull(); // left free
  });

  it('returns null when no selected leg is still plannable', async () => {
    await store.putRegistration(reg('BDAY-2026-0001', arrivalLeg('leg-a', { vehicle_booking_id: 'VEH-2026-0001' })));
    const booking = await createBookingFromLegIds(['leg-a'], NOW);
    expect(booking).toBeNull();
  });
});
