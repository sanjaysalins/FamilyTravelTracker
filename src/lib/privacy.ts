// Privacy / retention helpers (plan Phase 7). Deleting a family's document removes its embedded
// audit + email log too — no residual PII — but we also scrub the family out of any shared vehicle
// booking's covered_legs so nothing dangles. isRetentionDue is pure + unit-tested.

import { store } from './store';

/** Delete a registration and remove it from any shared booking's covered legs. */
export async function deleteRegistrationCascade(ref: string, now: string): Promise<void> {
  const bookings = await store.listBookings();
  await Promise.all(bookings.map(async (b) => {
    const kept = b.covered_legs.filter((c) => c.registration_ref !== ref);
    if (kept.length !== b.covered_legs.length) {
      b.covered_legs = kept;
      b.updated_at = now;
      await store.putBooking(b);
    }
  }));
  await store.deleteRegistration(ref);
}

/** True once the event has been over for `retentionDays` — the cue to delete all data (PRD §17). */
export function isRetentionDue(eventEndIso: string, retentionDays: number, now: Date): boolean {
  const end = new Date(`${eventEndIso}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return false;
  return now.getTime() > end + retentionDays * 86400000;
}
