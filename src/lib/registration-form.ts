// The bug-prone seam (plan Phase 2a.3/5/6): turn posted form fields into a Registration.
// Pure and I/O-free so it's fully unit-testable without browser state. The server ALWAYS
// re-derives `direction` and `leg_order` here — client values for those are never trusted.
//
// Wire format: flat scalars for the arrival + departure legs, plus ONE hidden `legs_json`
// field carrying the optional internal transfers (step 4). Caller supplies the reference,
// raw token, timestamps and phone region (all the I/O-bound bits).

import type { CountryCode } from 'libphonenumber-js';
import type { LegStatus, Registration, TransportLeg } from './types';
import { hashToken } from './tokens';
import { normalizePhone } from './phone';

export interface BuildInput {
  fields: Record<string, string>;
  reference: string;
  rawToken: string;
  now: string;
  expiresAt: string | null;
  phoneRegion?: CountryCode;
}

export type BuildResult =
  | { ok: true; doc: Registration }
  | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRANSPORT_ANSWERS = new Set(['yes', 'no', 'not_sure']);

const str = (v: string | undefined): string => (v ?? '').trim();
const orNull = (v: string | undefined): string | null => str(v) || null;
const isOn = (v: string | undefined): boolean => {
  const s = str(v).toLowerCase();
  return s === 'on' || s === 'true' || s === '1' || s === 'yes';
};

function mapCarrier(mode: string): TransportLeg['carrier_type'] {
  switch (str(mode)) {
    case 'flight': return 'flight';
    case 'train': return 'train';
    case 'bus': return 'bus';
    case 'car':
    case 'own': return 'own';
    default: return 'unknown';
  }
}

// PRD §7.4: guest answers yes/no/not_sure only. "Not sure" is treated as "yes"
// (needs transport) on purpose — the model doesn't distinguish them.
function mapTransport(answer: string): { transport_needed: boolean; status: LegStatus } {
  return str(answer) === 'no'
    ? { transport_needed: false, status: 'not_required' }
    : { transport_needed: true, status: 'requested' };
}

interface RawLeg {
  direction: TransportLeg['direction'];
  from: string; to: string;
  date?: string; tbc?: boolean;
  time?: string; mode?: string; ref?: string;
  transport: string; people?: string; notes?: string;
}

function buildLeg(o: RawLeg, order: number, partySize: number): TransportLeg {
  const { transport_needed, status } = mapTransport(o.transport);
  const peopleNum = Number(str(o.people));
  const people = Number.isInteger(peopleNum) && peopleNum > 0 ? peopleNum : partySize;
  const meaning: TransportLeg['time_meaning'] =
    o.direction === 'arrival' ? 'arrival_at_destination' : 'departure_from_origin';
  return {
    id: `leg-${order}`,
    leg_order: order,
    direction: o.direction,
    from_location: str(o.from),
    to_location: str(o.to),
    travel_date: orNull(o.date),
    date_tbc: !!o.tbc,
    travel_time: orNull(o.time),
    time_meaning: orNull(o.time) ? meaning : null,
    carrier_type: mapCarrier(o.mode ?? ''),
    carrier_ref: orNull(o.ref),
    people_on_this_leg: people,
    transport_needed,
    guest_notes: orNull(o.notes),
    status,
    vehicle_booking_id: null,
    pickup_point: null,
    pickup_time_confirmed: null,
    driver_name: null,
    driver_phone_e164: null,
    admin_notes: null,
    confirmation_sent_at: null,
  };
}

/** Parse the optional internal-transfer legs from the hidden `legs_json` field (cap 2). */
function parseInternalLegs(json: string): RawLeg[] {
  if (!str(json)) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 2).map((x): RawLeg => {
    const o = (x ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
    return {
      direction: 'internal',
      from: s('from'),
      to: s('to'),
      date: s('date'),
      tbc: o.tbc === true || o.tbc === 'on',
      transport: s('transport') || 'yes',
      people: s('people'),
      notes: s('notes'),
    };
  });
}

/** No-JS fallback: read up to 2 internal legs from flat int1_/int2_ prefixed fields. */
function parseFlatInternalLegs(f: Record<string, string>): RawLeg[] {
  const out: RawLeg[] = [];
  for (const i of [1, 2]) {
    const from = str(f[`int${i}_from`]);
    const to = str(f[`int${i}_to`]);
    if (!from && !to) continue; // empty card -> skip
    out.push({
      direction: 'internal',
      from,
      to,
      date: f[`int${i}_date`],
      tbc: isOn(f[`int${i}_tbc`]),
      transport: str(f[`int${i}_transport`]) || 'yes',
      people: f[`int${i}_people`],
      notes: f[`int${i}_notes`],
    });
  }
  return out;
}

function parsePartyMembers(json: string): Registration['party_members'] {
  if (!str(json)) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const bands = new Set(['adult', 'child', 'elderly']);
  return arr
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      const band = typeof o.age_band === 'string' ? o.age_band : 'adult';
      return { name, age_band: (bands.has(band) ? band : 'adult') as 'adult' | 'child' | 'elderly' };
    })
    .filter((m) => m.name.length > 0);
}

export function buildRegistration(input: BuildInput): BuildResult {
  const f = input.fields;
  const region = input.phoneRegion ?? 'IN';
  const errors: Record<string, string> = {};

  // ---- required (PRD §14) ----
  const first = str(f.first);
  if (!first) errors.first = 'Please enter the main contact’s first name.';

  const email = str(f.email);
  if (!email) errors.email = 'Please enter an email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'That email address doesn’t look right.';

  const phoneRaw = str(f.phone);
  if (!phoneRaw) errors.phone = 'Please enter a mobile number.';

  const homeCountry = str(f.home_country);
  if (!homeCountry) errors.home_country = 'Please enter a home country.';

  const partySizeNum = Number(str(f.party_size));
  const partySize = Number.isInteger(partySizeNum) && partySizeNum >= 1 ? partySizeNum : NaN;
  if (Number.isNaN(partySize)) errors.party_size = 'How many people are coming? (at least 1)';

  if (!isOn(f.consent)) errors.consent = 'Please tick the box to share your details so we can plan your travel.';

  // arrival + departure: from, to, transport-answer block; everything else is lenient
  if (!str(f.arr_from)) errors.arr_from = 'Where do you travel from?';
  if (!str(f.arr_to)) errors.arr_to = 'Where are you travelling to?';
  if (!TRANSPORT_ANSWERS.has(str(f.arr_transport))) errors.arr_transport = 'Do you need a pickup when you arrive?';

  if (!str(f.dep_from)) errors.dep_from = 'Where do you travel from on the way home?';
  if (!str(f.dep_to)) errors.dep_to = 'Where are you travelling to on the way home?';
  if (!TRANSPORT_ANSWERS.has(str(f.dep_transport))) errors.dep_transport = 'Do you need a drop-off?';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // ---- build legs: 1 arrival, then internals, then 1 departure (server-derived order) ----
  // Prefer the JS path's hidden legs_json; fall back to flat int1_/int2_ fields (no-JS).
  const fromJson = parseInternalLegs(f.legs_json);
  const internals = fromJson.length ? fromJson : parseFlatInternalLegs(f);
  const legs: TransportLeg[] = [];
  legs.push(buildLeg(
    { direction: 'arrival', from: f.arr_from, to: f.arr_to, date: f.arr_date, tbc: isOn(f.arr_tbc), time: f.arr_time, mode: f.arr_mode, ref: f.arr_ref, transport: f.arr_transport, people: f.arr_people },
    1, partySize,
  ));
  internals.forEach((leg, i) => legs.push(buildLeg(leg, 2 + i, partySize)));

  // departure: capture the flight/train departure time; fold a preferred "leave Bidar by" into notes
  const depLeaveBy = str(f.dep_leaveby);
  const depNotes = depLeaveBy ? `Prefers to leave by ${depLeaveBy}` : '';
  legs.push(buildLeg(
    { direction: 'departure', from: f.dep_from, to: f.dep_to, date: f.dep_date, tbc: isOn(f.dep_tbc), time: f.dep_time, mode: f.dep_mode, ref: f.dep_ref, transport: f.dep_transport, people: f.dep_people, notes: depNotes },
    2 + internals.length, partySize,
  ));

  // ---- contact + whatsapp ----
  const phone = normalizePhone(phoneRaw, region);
  const waSame = isOn(f.wa_same);
  const wa = waSame ? phone : normalizePhone(str(f.wa_phone), region);

  const doc: Registration = {
    reference_number: input.reference,
    edit_token_hash: hashToken(input.rawToken),
    edit_token_created_at: input.now,
    edit_token_expires_at: input.expiresAt,
    edit_token_revoked_at: null,

    main_contact_first: first,
    main_contact_surname: str(f.surname),
    email,
    phone_raw: phone.raw,
    phone_e164: phone.e164,
    whatsapp_same_as_phone: waSame,
    whatsapp_e164: wa.e164,
    home_city: orNull(f.home_city),
    home_country: homeCountry,
    relationship: orNull(f.relationship),

    party_size: partySize,
    party_members: parsePartyMembers(f.people_json),
    special_requirements: orNull(f.special_requirements),

    stay_type: null,
    stay_location: null,

    consent_given: true,
    consent_at: input.now,
    status: 'submitted',
    confirmed_at: null,
    edited_after_confirm: false,
    admin_notes: null,

    created_at: input.now,
    updated_at: input.now,

    legs,
    audit: [{ at: input.now, actor: 'guest', action: 'submitted', details: null }],
    emails: [],
  };

  return { ok: true, doc };
}
