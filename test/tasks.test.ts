// Phase 5.2 — Action Centre job counts (pure) + the chase predicate.

import { describe, expect, it } from 'vitest';
import { computeJobs, isChaseable, chaseLegs, needsYouItems } from '../src/lib/tasks';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import type { Registration, TransportLeg, VehicleBooking } from '../src/lib/types';

const NOW = '2026-06-12T10:00:00.000Z';

function reg(extra: Record<string, string> = {}, ref = 'BDAY-2026-0001'): Registration {
  const fields: Record<string, string> = {
    first: 'A', surname: 'B', email: 'a@b.c', phone: '98765 43210', phone_region: 'IN',
    wa_same: 'on', home_country: 'India', party_size: '2', consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_mode: 'flight', arr_ref: '6E1', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_mode: 'flight', dep_ref: '6E2', dep_transport: 'yes',
    ...extra,
  };
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: NOW, expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.doc;
}

function booking(over: Partial<VehicleBooking>): VehicleBooking {
  return {
    id: 'VEH-1', date: '2026-10-16', purpose: 'arrival', route_from: 'X', route_to: 'Y', depart_time: null,
    vehicle_type: 'suv_innova', seats: 6, operator_name: null, operator_contact: null, quote_amount: null,
    currency: 'INR', driver_name: null, driver_phone_raw: null, driver_phone_e164: null, vehicle_reg: null,
    status: 'suggested', covered_legs: [], notes: null, created_at: NOW, updated_at: NOW, ...over,
  };
}

describe('isChaseable', () => {
  const base = reg().legs.find((l) => l.direction === 'arrival')!;
  const mk = (o: Partial<TransportLeg>): TransportLeg => ({ ...base, ...o });

  it('a complete flight leg is not chaseable', () => {
    expect(isChaseable(mk({ travel_date: '2026-10-16', carrier_type: 'flight', carrier_ref: '6E1' }))).toBe(false);
  });
  it('missing date or TBC is chaseable', () => {
    expect(isChaseable(mk({ travel_date: null }))).toBe(true);
    expect(isChaseable(mk({ date_tbc: true }))).toBe(true);
  });
  it('flight/train with no carrier ref is chaseable', () => {
    expect(isChaseable(mk({ carrier_type: 'train', carrier_ref: null }))).toBe(true);
  });
  it('own-car with no carrier ref is NOT chaseable (no flight number to ask for)', () => {
    expect(isChaseable(mk({ carrier_type: 'own', carrier_ref: null }))).toBe(false);
  });
  it('a leg with transport not needed is never chaseable', () => {
    expect(isChaseable(mk({ transport_needed: false, travel_date: null }))).toBe(false);
  });
});

describe('computeJobs', () => {
  it('counts submitted registrations as to-review', () => {
    const a = reg({}, 'BDAY-2026-0001'); a.status = 'submitted';
    const b = reg({}, 'BDAY-2026-0002'); b.status = 'in_review';
    const jobs = computeJobs([a, b], []);
    expect(jobs.find((j) => j.key === 'review')!.n).toBe(1);
  });

  it('book counts live planner suggestions; driverless bookings need-driver; assigned+driver to-confirm', () => {
    const families = [reg({}, 'BDAY-2026-0007')]; // 2 unbooked dated transport legs -> 2 suggestions
    const bookings = [
      booking({ id: 'V2', status: 'booked', driver_name: null }),                   // needs driver
      booking({ id: 'V3', status: 'assigned', driver_name: 'Ravi', covered_legs: [{ registration_ref: 'R1', leg_id: 'L1', family_name: 'X', people: 2 }] }), // to-confirm (leg not confirmed)
      booking({ id: 'V4', status: 'cancelled', driver_name: null }),                // ignored
    ];
    const jobs = computeJobs(families, bookings);
    expect(jobs.find((j) => j.key === 'book')!.n).toBe(2);     // arrival + departure clusters
    expect(jobs.find((j) => j.key === 'driver')!.n).toBe(1);   // V2 (cancelled excluded)
    expect(jobs.find((j) => j.key === 'confirm')!.n).toBe(1);
  });

  it('counts chaseable legs across families', () => {
    const good = reg({}, 'BDAY-2026-0001');                                  // both legs complete
    const bad = reg({ arr_ref: '', dep_date: '' }, 'BDAY-2026-0002');        // arrival no flight no, departure no date
    const jobs = computeJobs([good, bad], []);
    expect(jobs.find((j) => j.key === 'chase')!.n).toBe(2);
    expect(chaseLegs([good, bad])).toHaveLength(2);
  });
});

describe('needsYouItems', () => {
  it('returns only outstanding jobs with friendly labels', () => {
    const jobs = computeJobs(
      [Object.assign(reg(), { status: 'submitted' })],
      [booking({ status: 'assigned', driver_name: 'R', covered_legs: [{ registration_ref: 'R1', leg_id: 'L1', family_name: 'X', people: 2 }] })],
    );
    const items = needsYouItems(jobs);
    expect(items.some((i) => i.label === 'to review' && i.n === 1)).toBe(true);
    expect(items.some((i) => i.label === 'to confirm' && i.n === 1)).toBe(true);
    expect(items.every((i) => i.n > 0)).toBe(true);
  });
});
