// Phase 5.4 — vehicle planner clustering + vehicle pick + auto-confirm (all pure).

import { describe, expect, it } from 'vitest';
import { pickVehicle, suggestClusters, allTransportLegsConfirmed } from '../src/lib/planner';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import type { Registration } from '../src/lib/types';

const NOW = '2026-06-12T10:00:00.000Z';

function reg(extra: Record<string, string>, ref: string): Registration {
  const fields: Record<string, string> = {
    first: 'A', surname: 'Fam', email: 'a@b.c', phone: '98765 43210', phone_region: 'IN',
    wa_same: 'on', home_country: 'India', party_size: '2', consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_time: '10:00', arr_mode: 'flight', arr_ref: '6E1', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_time: '07:00', dep_mode: 'flight', dep_ref: '6E2', dep_transport: 'yes',
    ...extra,
  };
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: NOW, expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.doc;
}

describe('pickVehicle', () => {
  it('picks the smallest vehicle that seats the group', () => {
    expect(pickVehicle(2).type).toBe('car');
    expect(pickVehicle(4).type).toBe('car');
    expect(pickVehicle(5).type).toBe('suv_innova');
    expect(pickVehicle(7).type).toBe('suv_innova');
    expect(pickVehicle(10).type).toBe('tempo_traveller');
    expect(pickVehicle(30).type).toBe('minibus'); // overflow falls back to largest
  });
});

describe('suggestClusters', () => {
  it('clusters same-date same-route arrivals within 60 min into one vehicle', () => {
    const a = reg({ arr_time: '10:00', party_size: '2' }, 'BDAY-2026-0001');
    const b = reg({ arr_time: '10:40', party_size: '3' }, 'BDAY-2026-0002'); // within 60 min of a
    const clusters = suggestClusters([a, b]);
    const arr = clusters.filter((c) => c.direction === 'arrival');
    expect(arr).toHaveLength(1);
    expect(arr[0].people).toBe(5);
    expect(arr[0].vehicle_type).toBe('suv_innova'); // seats 5
    expect(arr[0].legs).toHaveLength(2);
  });

  it('splits arrivals more than 60 min apart into separate vehicles', () => {
    const a = reg({ arr_time: '10:00' }, 'BDAY-2026-0001');
    const b = reg({ arr_time: '14:00' }, 'BDAY-2026-0002');
    const arr = suggestClusters([a, b]).filter((c) => c.direction === 'arrival');
    expect(arr).toHaveLength(2);
  });

  it('skips legs with no date / TBC / already booked', () => {
    const a = reg({ arr_date: '', arr_tbc: 'on' }, 'BDAY-2026-0001'); // arrival TBC -> not plannable
    const arr = suggestClusters([a]).filter((c) => c.direction === 'arrival');
    expect(arr).toHaveLength(0);
  });
});

describe('allTransportLegsConfirmed', () => {
  it('true only when every transport-needed leg is confirmed', () => {
    const r = reg({}, 'BDAY-2026-0001');
    expect(allTransportLegsConfirmed(r)).toBe(false);
    for (const l of r.legs) l.status = 'confirmed';
    expect(allTransportLegsConfirmed(r)).toBe(true);
  });

  it('a not-needed leg does not block confirmation', () => {
    const r = reg({ dep_transport: 'no' }, 'BDAY-2026-0001'); // departure not needed
    const arr = r.legs.find((l) => l.direction === 'arrival')!;
    arr.status = 'confirmed';
    expect(allTransportLegsConfirmed(r)).toBe(true); // only the arrival needed transport
  });
});
