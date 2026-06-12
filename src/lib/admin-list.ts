// All-registrations list view-model (plan Phase 5.3, PRD §9.1 A2). Pure + unit-tested: turns the
// raw documents into table rows with the organiser's flags (New, possible duplicate, edited-since-
// confirmation, needs-work, needs-chase) and supports server-side search + filter (works with no JS).

import type { Registration } from './types';
import { isChaseable } from './tasks';
import { humanDate } from './dates';

export interface RegRow {
  ref: string;
  shortRef: string;
  family: string;
  contact: string;         // "email · phone" for the sub-line
  people: number;
  arrivalLabel: string;    // arrival date, or "Not booked"
  status: Registration['status'];
  isNew: boolean;          // status === 'submitted' (not yet opened)
  isDuplicate: boolean;    // shares an email or phone with another family
  editedAfterConfirm: boolean;
  needsWork: boolean;      // a transport-needed leg isn't confirmed / not_required yet
  needsChase: boolean;     // a chaseable leg (missing date / flight no.)
}

export type ListFilter = 'all' | 'new' | 'chase' | 'needswork' | 'confirmed';

const shortRef = (ref: string): string => ref.split('-').pop() ?? ref;
const key = (s: string): string => s.trim().toLowerCase();

export function buildRows(regs: Registration[]): RegRow[] {
  // Count emails + phones across all families so we can flag possible duplicates (flag, never block).
  const emails = new Map<string, number>();
  const phones = new Map<string, number>();
  for (const r of regs) {
    const e = key(r.email);
    const p = key(r.phone_e164 ?? r.phone_raw);
    if (e) emails.set(e, (emails.get(e) ?? 0) + 1);
    if (p) phones.set(p, (phones.get(p) ?? 0) + 1);
  }

  return regs.map((r) => {
    const arr = r.legs.find((l) => l.direction === 'arrival');
    const e = key(r.email);
    const p = key(r.phone_e164 ?? r.phone_raw);
    const family = [r.main_contact_surname, r.main_contact_first].filter(Boolean).join(', ');
    return {
      ref: r.reference_number,
      shortRef: shortRef(r.reference_number),
      family: family || '(no name)',
      contact: [r.email, r.phone_raw].filter(Boolean).join(' · '),
      people: r.party_size,
      arrivalLabel: !arr ? '—' : (arr.date_tbc || !arr.travel_date) ? 'Not booked' : humanDate(arr.travel_date),
      status: r.status,
      isNew: r.status === 'submitted',
      isDuplicate: (!!e && (emails.get(e) ?? 0) > 1) || (!!p && (phones.get(p) ?? 0) > 1),
      editedAfterConfirm: r.edited_after_confirm,
      needsWork: r.legs.some((l) => l.transport_needed && l.status !== 'confirmed' && l.status !== 'not_required'),
      needsChase: r.legs.some(isChaseable),
    };
  });
}

/** Server-side search (ref / family / contact) + a single status filter. */
export function filterRows(rows: RegRow[], q: string, filter: ListFilter): RegRow[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === 'new' && !row.isNew) return false;
    if (filter === 'chase' && !row.needsChase) return false;
    if (filter === 'needswork' && !row.needsWork) return false;
    if (filter === 'confirmed' && row.status !== 'confirmed') return false;
    if (needle && !`${row.ref} ${row.family} ${row.contact}`.toLowerCase().includes(needle)) return false;
    return true;
  });
}
