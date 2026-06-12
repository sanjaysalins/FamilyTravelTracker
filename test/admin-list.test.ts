// Phase 5.3 — all-registrations list view-model: flags + search/filter (pure).

import { describe, expect, it } from 'vitest';
import { buildRows, filterRows } from '../src/lib/admin-list';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import type { Registration } from '../src/lib/types';

const NOW = '2026-06-12T10:00:00.000Z';

function reg(extra: Record<string, string>, ref: string): Registration {
  const fields: Record<string, string> = {
    first: 'A', surname: 'Family', email: 'a@b.c', phone: '98765 43210', phone_region: 'IN',
    wa_same: 'on', home_country: 'India', party_size: '3', consent: 'on',
    arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_mode: 'flight', arr_ref: '6E1', arr_transport: 'yes',
    dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_mode: 'flight', dep_ref: '6E2', dep_transport: 'yes',
    ...extra,
  };
  const res = buildRegistration({ fields, reference: ref, rawToken: 'raw', now: NOW, expiresAt: null } as BuildInput);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.doc;
}

describe('buildRows flags', () => {
  it('marks New (submitted), needsWork, and needsChase', () => {
    const r = reg({ surname: 'Khan', arr_ref: '', dep_date: '' }, 'BDAY-2026-0001'); // arrival missing flight, dep missing date
    r.status = 'submitted';
    const [row] = buildRows([r]);
    expect(row.isNew).toBe(true);
    expect(row.needsWork).toBe(true);      // legs requested, not confirmed
    expect(row.needsChase).toBe(true);
    expect(row.shortRef).toBe('0001');
    expect(row.family).toBe('Khan, A');
  });

  it('flags possible duplicates on a shared email (distinct phones)', () => {
    const a = reg({ email: 'same@x.com', phone: '90000 00001' }, 'BDAY-2026-0001');
    const b = reg({ email: 'same@x.com', surname: 'Other', phone: '90000 00002' }, 'BDAY-2026-0002');
    const c = reg({ email: 'unique@x.com', surname: 'Solo', phone: '90000 00003' }, 'BDAY-2026-0003');
    const rows = buildRows([a, b, c]);
    expect(rows[0].isDuplicate).toBe(true);
    expect(rows[1].isDuplicate).toBe(true);
    expect(rows[2].isDuplicate).toBe(false);
  });

  it('reflects edited_after_confirm and confirmed status', () => {
    const r = reg({}, 'BDAY-2026-0001');
    r.status = 'confirmed';
    for (const l of r.legs) l.status = 'confirmed';
    r.edited_after_confirm = true;
    const [row] = buildRows([r]);
    expect(row.editedAfterConfirm).toBe(true);
    expect(row.needsWork).toBe(false);     // all legs confirmed
    expect(row.isNew).toBe(false);
  });
});

describe('filterRows', () => {
  const a = reg({ surname: 'Khan', email: 'rashid@x.com' }, 'BDAY-2026-0001');
  a.status = 'submitted';
  const b = reg({ surname: 'Dsouza', email: 'glen@x.com' }, 'BDAY-2026-0002');
  b.status = 'confirmed'; for (const l of b.legs) l.status = 'confirmed';
  const rows = buildRows([a, b]);

  it('search matches ref / family / contact', () => {
    expect(filterRows(rows, 'khan', 'all')).toHaveLength(1);
    expect(filterRows(rows, '0002', 'all')[0].family).toContain('Dsouza');
    expect(filterRows(rows, 'glen@x.com', 'all')).toHaveLength(1);
    expect(filterRows(rows, 'nomatch', 'all')).toHaveLength(0);
  });

  it('filters by status group', () => {
    expect(filterRows(rows, '', 'new').every((r) => r.isNew)).toBe(true);
    expect(filterRows(rows, '', 'confirmed').every((r) => r.status === 'confirmed')).toBe(true);
    expect(filterRows(rows, '', 'new')).toHaveLength(1);
  });
});
