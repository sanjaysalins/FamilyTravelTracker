// Fake-family seed data for UAT / AI-agent testing.
// Deterministic (no Date.now / Math.random) so tests are stable and reruns are identical.
// Produces realistic, VARIED registrations: international + domestic arrivals, own-transport,
// multi-leg journeys, date-TBC cases, mixed party sizes and stay types — the shapes the admin
// flows must cope with. NOT for production data; clearly marked with a TEST- email domain.

import type { Registration, TransportLeg, VehicleBooking } from './types';

const BASE_TS = '2026-06-01T09:00:00.000Z'; // fixed "submitted at" so seeds are reproducible

interface Scenario {
  first: string;
  surname: string;
  country: string;
  city: string;
  relationship: string;
  party: Array<{ name: string; age_band: 'adult' | 'child' | 'elderly' }>;
  stay_type: Registration['stay_type'];
  stay_location: string | null;
  special?: string | null;
  // legs described compactly; expanded into full TransportLeg objects below
  legs: Array<{
    direction: TransportLeg['direction'];
    from: string;
    to: string;
    date: string | null;
    tbc?: boolean;
    time?: string | null;
    time_meaning?: TransportLeg['time_meaning'];
    carrier?: TransportLeg['carrier_type'];
    ref?: string | null;
    transport_needed?: boolean;
    notes?: string | null;
  }>;
}

// A curated set of distinct, realistic scenarios. Cycled (with suffixes) if more are requested.
const SCENARIOS: Scenario[] = [
  {
    first: 'Maria', surname: 'Pereira', country: 'GB', city: 'London', relationship: 'daughter',
    party: [
      { name: 'Maria Pereira', age_band: 'adult' },
      { name: 'Tom Pereira', age_band: 'adult' },
      { name: 'Ella Pereira', age_band: 'child' },
    ],
    stay_type: 'hotel', stay_location: 'Bidar – Krishna Regency',
    legs: [
      { direction: 'arrival', from: 'London Heathrow (LHR)', to: 'Hyderabad (HYD)', date: '2026-10-15', time: '23:40', time_meaning: 'arrival_at_destination', carrier: 'flight', ref: 'BA275', transport_needed: true, notes: 'Landing late, will need pickup to Bidar next morning' },
      { direction: 'departure', from: 'Bidar', to: 'Hyderabad (HYD)', date: '2026-10-20', time: '06:15', time_meaning: 'departure_from_origin', carrier: 'flight', ref: 'BA276', transport_needed: true },
    ],
  },
  {
    first: 'Anil', surname: 'Kumar', country: 'IN', city: 'Bengaluru', relationship: 'nephew',
    party: [
      { name: 'Anil Kumar', age_band: 'adult' },
      { name: 'Sunita Kumar', age_band: 'adult' },
    ],
    stay_type: 'family_home', stay_location: 'With the Rao family, Bidar',
    legs: [
      { direction: 'arrival', from: 'Bengaluru', to: 'Bidar', date: '2026-10-16', time: '07:30', time_meaning: 'arrival_at_destination', carrier: 'train', ref: '16571 Bidar Exp', transport_needed: true, notes: 'Arriving by train direct to Bidar' },
    ],
  },
  {
    first: 'Joseph', surname: 'Fernandes', country: 'AE', city: 'Dubai', relationship: 'son',
    party: [
      { name: 'Joseph Fernandes', age_band: 'adult' },
      { name: 'Rita Fernandes', age_band: 'adult' },
      { name: 'Baby Fernandes', age_band: 'child' },
      { name: 'Grandma Fernandes', age_band: 'elderly' },
    ],
    stay_type: 'hotel', stay_location: 'Bidar – Krishna Regency',
    special: 'Elderly traveller needs wheelchair assistance and a ground-floor room.',
    legs: [
      { direction: 'arrival', from: 'Dubai (DXB)', to: 'Hyderabad (HYD)', date: '2026-10-16', time: '13:10', time_meaning: 'arrival_at_destination', carrier: 'flight', ref: 'EK524', transport_needed: true },
      { direction: 'departure', from: 'Bidar', to: 'Hyderabad (HYD)', date: '2026-10-19', time: '16:00', time_meaning: 'departure_from_origin', carrier: 'flight', ref: 'EK525', transport_needed: true },
    ],
  },
  {
    first: 'Priya', surname: 'Nair', country: 'IN', city: 'Mumbai', relationship: 'niece',
    party: [{ name: 'Priya Nair', age_band: 'adult' }],
    stay_type: 'own', stay_location: null,
    legs: [
      { direction: 'arrival', from: 'Mumbai', to: 'Hyderabad (HYD)', date: '2026-10-16', time: '10:25', time_meaning: 'arrival_at_destination', carrier: 'flight', ref: '6E512', transport_needed: false, notes: 'Have my own car from Hyderabad, no transport needed' },
    ],
  },
  {
    first: 'David', surname: 'Lobo', country: 'IN', city: 'Hyderabad', relationship: 'cousin',
    party: [
      { name: 'David Lobo', age_band: 'adult' },
      { name: 'Sheila Lobo', age_band: 'adult' },
      { name: 'Ryan Lobo', age_band: 'child' },
      { name: 'Nina Lobo', age_band: 'child' },
    ],
    stay_type: 'family_home', stay_location: 'Own house in Hyderabad, day-trip to Bidar',
    legs: [
      { direction: 'arrival', from: 'Hyderabad', to: 'Bidar', date: '2026-10-17', time: '11:00', time_meaning: 'arrival_at_destination', carrier: 'own', ref: null, transport_needed: false, notes: 'Driving ourselves from Hyderabad' },
    ],
  },
  {
    first: 'Grace', surname: 'DSouza', country: 'CA', city: 'Toronto', relationship: 'sister',
    party: [
      { name: 'Grace DSouza', age_band: 'elderly' },
      { name: 'Albert DSouza', age_band: 'elderly' },
    ],
    stay_type: 'hotel', stay_location: 'Bidar – Krishna Regency',
    special: 'Both senior citizens, prefer to travel together and avoid late-night drives.',
    legs: [
      { direction: 'arrival', from: 'Toronto (YYZ)', to: 'Hyderabad (HYD)', date: '2026-10-14', tbc: true, time: null, carrier: 'flight', ref: null, transport_needed: true, notes: 'Flights not booked yet — will confirm dates soon' },
    ],
  },
  {
    first: 'Suresh', surname: 'Patil', country: 'IN', city: 'Pune', relationship: 'brother-in-law',
    party: [
      { name: 'Suresh Patil', age_band: 'adult' },
      { name: 'Lata Patil', age_band: 'adult' },
      { name: 'Aaji Patil', age_band: 'elderly' },
    ],
    stay_type: 'unsure', stay_location: null,
    legs: [
      { direction: 'arrival', from: 'Pune', to: 'Bidar', date: '2026-10-16', tbc: true, time: 'morning (approx)', time_meaning: 'arrival_at_destination', carrier: 'bus', ref: null, transport_needed: true, notes: 'Likely overnight bus, exact time TBC' },
      { direction: 'departure', from: 'Bidar', to: 'Pune', date: '2026-10-19', tbc: true, carrier: 'bus', ref: null, transport_needed: true },
    ],
  },
  {
    first: 'Naomi', surname: 'Mathew', country: 'SG', city: 'Singapore', relationship: 'granddaughter',
    party: [
      { name: 'Naomi Mathew', age_band: 'adult' },
      { name: 'Kevin Mathew', age_band: 'adult' },
    ],
    stay_type: 'hotel', stay_location: 'Bidar – Krishna Regency',
    legs: [
      { direction: 'arrival', from: 'Singapore (SIN)', to: 'Hyderabad (HYD)', date: '2026-10-16', time: '21:55', time_meaning: 'arrival_at_destination', carrier: 'flight', ref: 'SQ508', transport_needed: true, notes: 'Late arrival, happy to share a vehicle with others on the same flight day' },
      { direction: 'departure', from: 'Bidar', to: 'Hyderabad (HYD)', date: '2026-10-19', time: '19:30', time_meaning: 'departure_from_origin', carrier: 'flight', ref: 'SQ509', transport_needed: true },
    ],
  },
];

function pad(n: number): string {
  return String(n).padStart(4, '0');
}

function buildLeg(s: Scenario['legs'][number], idx: number): TransportLeg {
  return {
    id: `leg-${idx + 1}`,
    leg_order: idx + 1,
    direction: s.direction,
    from_location: s.from,
    to_location: s.to,
    travel_date: s.date,
    date_tbc: s.tbc ?? false,
    travel_time: s.time ?? null,
    time_meaning: s.time_meaning ?? null,
    carrier_type: s.carrier ?? 'unknown',
    carrier_ref: s.ref ?? null,
    people_on_this_leg: 0, // filled to party_size by the caller
    transport_needed: s.transport_needed ?? true,
    guest_notes: s.notes ?? null,
    status: 'requested',
    vehicle_booking_id: null,
    pickup_point: null,
    pickup_time_confirmed: null,
    driver_name: null,
    driver_phone_e164: null,
    admin_notes: null,
    confirmation_sent_at: null,
  };
}

function buildRegistration(scenario: Scenario, n: number): Registration {
  const ref = `BDAY-2026-${pad(n)}`;
  const party_size = scenario.party.length;
  const legs = scenario.legs.map((l, i) => ({ ...buildLeg(l, i), people_on_this_leg: party_size }));
  const surnameKey = scenario.surname.toLowerCase();
  return {
    reference_number: ref,
    edit_token_hash: `seed-token-hash-${pad(n)}`,
    edit_token_created_at: BASE_TS,
    edit_token_expires_at: null,
    edit_token_revoked_at: null,
    main_contact_first: scenario.first,
    main_contact_surname: scenario.surname,
    email: `test+${surnameKey}${n}@familytraveltracker.test`,
    phone_raw: `+9198${pad(n)}00000`,
    phone_e164: `+9198${pad(n)}00000`,
    whatsapp_same_as_phone: true,
    whatsapp_e164: `+9198${pad(n)}00000`,
    home_city: scenario.city,
    home_country: scenario.country,
    relationship: scenario.relationship,
    party_size,
    party_members: scenario.party,
    special_requirements: scenario.special ?? null,
    stay_type: scenario.stay_type,
    stay_location: scenario.stay_location,
    consent_given: true,
    consent_at: BASE_TS,
    status: 'submitted',
    confirmed_at: null,
    edited_after_confirm: false,
    admin_notes: null,
    created_at: BASE_TS,
    updated_at: BASE_TS,
    legs,
    audit: [{ at: BASE_TS, actor: 'guest', action: 'submitted', details: 'seed data' }],
    emails: [],
  };
}

/** Generate `count` fake family registrations (cycles the scenario set, with unique refs). */
export function generateFamilies(count = SCENARIOS.length): Registration[] {
  const out: Registration[] = [];
  for (let n = 1; n <= count; n++) {
    const scenario = SCENARIOS[(n - 1) % SCENARIOS.length];
    out.push(buildRegistration(scenario, n));
  }
  return out;
}

/** A couple of cross-family vehicle bookings, so the admin booking views have data too. */
export function generateBookings(): VehicleBooking[] {
  return [
    {
      id: 'VEH-2026-0001',
      date: '2026-10-16',
      purpose: 'arrival',
      route_from: 'Hyderabad (HYD)',
      route_to: 'Bidar',
      depart_time: '14:00',
      vehicle_type: 'tempo_traveller',
      seats: 12,
      operator_name: 'Deccan Travels (TEST)',
      operator_contact: '+910000000000',
      quote_amount: 9000,
      currency: 'INR',
      driver_name: null,
      driver_phone_raw: null,
      driver_phone_e164: null,
      vehicle_reg: null,
      status: 'suggested',
      covered_legs: [
        { registration_ref: 'BDAY-2026-0003', leg_id: 'leg-1', family_name: 'Fernandes', people: 4 },
        { registration_ref: 'BDAY-2026-0008', leg_id: 'leg-1', family_name: 'Mathew', people: 2 },
      ],
      notes: 'Auto-suggested: clusters two arrivals landing on 16 Oct.',
      created_at: BASE_TS,
      updated_at: BASE_TS,
    },
  ];
}

/** Everything needed to populate a UAT environment in one shot. */
export function generateSeed(familyCount?: number) {
  return {
    registrations: generateFamilies(familyCount),
    vehicle_bookings: generateBookings(),
  };
}
