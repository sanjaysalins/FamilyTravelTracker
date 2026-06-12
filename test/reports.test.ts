// Phase 6 — report builders + Excel-safe CSV (pure).

import { describe, expect, it } from 'vitest';
import { schedule, seatDemand, runSheets, chaseList, headcount, toCsv, exportCsv, scheduleCsv } from '../src/lib/reports';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import type { Registration, VehicleBooking } from '../src/lib/types';

const NOW = '2026-06-12T10:00:00.000Z';

function reg(extra: Record<string, string>, ref: string): Registration {
  const fields: Record<string, string> = {
    first: 'Rashid', surname: 'Khan', email: 'rashid@x.com', phone: '98765 43210', phone_region: 'IN',
    wa_same: 'on', home_country: 'India', party_size: '4', consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_time: '10:15', arr_mode: 'flight', arr_ref: '6E7123', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_time: '07:00', dep_mode: 'flight', dep_ref: '6E7124', dep_transport: 'yes',
    ...extra,
  };
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: NOW, expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.doc;
}

describe('seatDemand', () => {
  it('sums PEOPLE per date, not leg count', () => {
    const a = reg({ party_size: '4' }, 'BDAY-2026-0001');
    const b = reg({ party_size: '3' }, 'BDAY-2026-0002'); // same arrival date 16th
    const rows = seatDemand([a, b]);
    const oct16 = rows.find((r) => r.date === '2026-10-16')!;
    expect(oct16.arrival).toBe(7);   // 4 + 3 people, not 2 legs
    expect(oct16.total).toBe(7);
  });
});

describe('schedule', () => {
  it('lists arrival + internal legs, sorted, with transport needed only', () => {
    const a = reg({ arr_time: '12:00' }, 'BDAY-2026-0001');
    const b = reg({ arr_time: '08:00' }, 'BDAY-2026-0002');
    const rows = schedule([a, b], [], 'arrival');
    expect(rows).toHaveLength(2);
    expect(rows[0].time).toBe('08:00'); // sorted by time
    expect(rows.every((r) => r.route.includes('→'))).toBe(true);
  });

  it('departures schedule only has departure legs', () => {
    const rows = schedule([reg({}, 'BDAY-2026-0001')], [], 'departure');
    expect(rows).toHaveLength(1);
    expect(rows[0].route).toBe('Bidar → Hyderabad');
  });
});

describe('runSheets', () => {
  it('groups by driver, carries no health note or guest free-text, and dates each stop', () => {
    const r = reg({ special_requirements: 'wheelchair access needed' }, 'BDAY-2026-0001');
    const arr = r.legs.find((l) => l.direction === 'arrival')!;
    arr.driver_name = 'Ravi'; arr.driver_phone_e164 = '+919000000000'; arr.pickup_point = 'Gate 3'; arr.pickup_time_confirmed = '11:00';
    arr.guest_notes = 'has a heart condition'; // guest free-text must never reach a forwarded run sheet
    const sheets = runSheets([r], []);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].driver).toBe('Ravi');
    const json = JSON.stringify(sheets[0]);
    expect(json).not.toContain('wheelchair');        // special requirements excluded
    expect(json).not.toContain('heart condition');   // guest_notes excluded
    expect(sheets[0].stops[0].date).toBe('2026-10-16'); // each stop is dated for per-day grouping
  });
});

describe('chaseList', () => {
  it('flags legs missing a date or a flight number', () => {
    const r = reg({ arr_ref: '', dep_date: '' }, 'BDAY-2026-0001');
    const rows = chaseList([r]);
    expect(rows.length).toBe(2);
    expect(rows.some((x) => x.missing === 'flight / train number')).toBe(true);
    expect(rows.some((x) => x.missing === 'travel date')).toBe(true);
    expect(rows[0].whatsapp).toMatch(/^https:\/\/wa\.me\/\d+/);
  });
});

describe('headcount', () => {
  it('counts confirmed people and people per arrival date', () => {
    const a = reg({ party_size: '4' }, 'BDAY-2026-0001'); a.status = 'confirmed';
    const b = reg({ party_size: '2' }, 'BDAY-2026-0002'); b.status = 'submitted';
    const h = headcount([a, b]);
    expect(h.confirmedPeople).toBe(4);
    expect(h.totalPeople).toBe(6);
    expect(h.perArrivalDate.find((d) => d.date === '2026-10-16')!.people).toBe(6);
  });
});

describe('Excel-safe CSV', () => {
  it('starts with a UTF-8 BOM, uses CRLF, and quotes fields with commas/quotes', () => {
    const csv = toCsv(['A', 'B'], [['plain', 'has, comma'], ['quote "x"', 'last']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);           // BOM
    expect(csv).toContain('\r\n');                    // CRLF
    expect(csv).toContain('"has, comma"');            // comma field quoted
    expect(csv).toContain('"quote ""x"""');           // inner quotes doubled
  });

  it('export has no edit token or special-requirements columns and keeps +phones; dates DD-MM-YYYY', () => {
    const r = reg({ special_requirements: 'dietary: none' }, 'BDAY-2026-0001');
    const csv = exportCsv([r]);
    expect(csv.toLowerCase()).not.toContain('token');
    expect(csv).not.toContain('dietary');
    expect(csv).not.toContain(r.edit_token_hash);
    expect(csv).toContain('+919876543210');           // phone kept as +… text
    expect(csv).toContain('16-10-2026');              // DD-MM-YYYY text
  });

  it('scheduleCsv writes the expected header row', () => {
    const csv = scheduleCsv(schedule([reg({}, 'BDAY-2026-0001')], [], 'arrival'));
    expect(csv).toContain('Date,Time (IST),Guest,People,Route,Carrier ref,Driver,Vehicle,Pickup point,Status');
  });
});
