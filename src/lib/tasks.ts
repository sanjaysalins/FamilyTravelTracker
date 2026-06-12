// Action Centre job computation (plan Phase 5.2, PRD §9.1 A0). The admin is one busy person on a
// phone — this turns the raw data into "what needs you, one thing at a time": five prioritised jobs
// with live counts. computeJobs/isChaseable are PURE (unit-tested); loadJobs is the thin store wrapper.

import type { Registration, TransportLeg, VehicleBooking } from './types';
import { store } from './store';

export type JobKey = 'review' | 'book' | 'driver' | 'confirm' | 'chase';

export interface Job {
  key: JobKey;
  n: number;
  title: string;
  sub: string;
  href: string;
  icon: string;
}

/**
 * A leg the organiser should chase the family about: transport is needed, it's an arrival/departure
 * (internal legs aren't chased), and a key detail is missing — no date / date TBC, or a flight/train
 * leg with no carrier reference. (Own-car/bus legs are NOT chased for a flight number.)
 */
export function isChaseable(leg: TransportLeg): boolean {
  if (!leg.transport_needed || leg.direction === 'internal') return false;
  if (leg.date_tbc || !leg.travel_date) return true;
  if ((leg.carrier_type === 'flight' || leg.carrier_type === 'train') && !leg.carrier_ref) return true;
  return false;
}

/** Every chaseable leg across all families, with its registration for context (chase view + count). */
export function chaseLegs(regs: Registration[]): Array<{ reg: Registration; leg: TransportLeg }> {
  const out: Array<{ reg: Registration; leg: TransportLeg }> = [];
  for (const reg of regs) for (const leg of reg.legs) if (isChaseable(leg)) out.push({ reg, leg });
  return out;
}

/** The five Action-Centre jobs with live counts, in priority order. */
export function computeJobs(regs: Registration[], bookings: VehicleBooking[]): Job[] {
  const toReview = regs.filter((r) => r.status === 'submitted').length;
  const toBook = bookings.filter((b) => b.status === 'suggested').length;
  const needDriver = bookings.filter((b) => b.status !== 'cancelled' && !b.driver_name).length;
  const toConfirm = bookings.filter((b) => b.status === 'assigned' && !!b.driver_name).length;
  const toChase = chaseLegs(regs).length;

  return [
    { key: 'review', n: toReview, icon: '📝', title: 'New registrations to review', sub: 'Check details look complete', href: '/admin/registrations' },
    { key: 'book', n: toBook, icon: '🚐', title: 'Pickups ready to book a vehicle', sub: 'Accept the suggested groupings', href: '/admin/vehicles' },
    { key: 'driver', n: needDriver, icon: '🧑‍✈️', title: 'Vehicles need a driver', sub: 'Assign driver, phone and reg', href: '/admin/assign' },
    { key: 'confirm', n: toConfirm, icon: '✉️', title: 'Families ready to confirm', sub: 'Send the pickup details (no cost)', href: '/admin/confirm' },
    { key: 'chase', n: toChase, icon: '🔎', title: 'Missing flight / date info', sub: 'Ask the family to fill it in', href: '/admin/registrations?filter=chase' },
  ];
}

/** The short outstanding-only summary for the 'Needs you' strip (PRD §9.1) on advanced pages. */
export function needsYouItems(jobs: Job[]): Array<{ n: number; label: string }> {
  const labels: Record<JobKey, string> = {
    review: 'to review', book: 'to book', driver: 'need a driver', confirm: 'to confirm', chase: 'to chase',
  };
  return jobs.filter((j) => j.n > 0).map((j) => ({ n: j.n, label: labels[j.key] }));
}

/** Load both stores and compute the jobs (the I/O wrapper around the pure computeJobs). */
export async function loadJobs(): Promise<Job[]> {
  const [regs, bookings] = await Promise.all([store.listRegistrations(), store.listBookings()]);
  return computeJobs(regs, bookings);
}
