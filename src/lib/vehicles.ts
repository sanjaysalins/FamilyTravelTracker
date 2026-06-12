// Vehicle-booking operations (plan Phase 5.4). The hire workflow the Action-Centre flows write into:
// accept a planner cluster -> booking, assign a driver (copied onto the covered legs), confirm &
// email each family the cost-free details, and auto-confirm a registration once all its transport is
// confirmed. All store I/O lives here; the pure clustering/auto-confirm logic is in planner.ts.

import type { CountryCode } from 'libphonenumber-js';
import type { Registration, TransportLeg, VehicleBooking } from './types';
import { store } from './store';
import { config } from './config';
import { normalizePhone } from './phone';
import { sendEmail, eventInfo } from './email';
import { confirmationEmail } from './email-templates';
import { allTransportLegsConfirmed, isPlannable, makeCluster, vehicleLabel, type Cluster } from './planner';

function nextBookingId(existing: string[], year: string): string {
  const prefix = `VEH-${year}-`;
  let max = 0;
  for (const id of existing) {
    if (id.startsWith(prefix)) { const n = parseInt(id.slice(prefix.length), 10); if (Number.isFinite(n) && n > max) max = n; }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/** Run a mutation over each registration referenced by a booking's covered legs (grouped, one save each). */
async function eachCoveredReg(
  refs: string[],
  fn: (reg: Registration) => void,
): Promise<Registration[]> {
  const unique = [...new Set(refs)];
  const out: Registration[] = [];
  for (const ref of unique) {
    const reg = await store.getRegistration(ref);
    if (!reg) continue;
    fn(reg);
    out.push(reg);
  }
  return out;
}

/** Accept a planner cluster: create a `to_book` booking and attach its legs to it. */
export async function createBookingFromCluster(cluster: Cluster, now: string): Promise<VehicleBooking> {
  const ids = (await store.listBookings()).map((b) => b.id);
  const id = nextBookingId(ids, config.event.start.slice(0, 4));
  const legIds = new Set(cluster.legs.map((l) => l.leg_id));

  const booking: VehicleBooking = {
    id,
    date: cluster.date,
    purpose: cluster.direction,
    route_from: cluster.from,
    route_to: cluster.to,
    depart_time: cluster.depart,
    vehicle_type: cluster.vehicle_type,
    seats: cluster.seats,
    operator_name: null, operator_contact: null, quote_amount: null, currency: 'INR',
    driver_name: null, driver_phone_raw: null, driver_phone_e164: null, vehicle_reg: null,
    status: 'to_book',
    covered_legs: cluster.legs.map((l) => ({
      registration_ref: l.registration_ref, leg_id: l.leg_id, family_name: l.family_name, people: l.people,
    })),
    notes: null,
    created_at: now,
    updated_at: now,
  };

  const regs = await eachCoveredReg(cluster.legs.map((l) => l.registration_ref), (reg) => {
    for (const leg of reg.legs) if (legIds.has(leg.id)) leg.vehicle_booking_id = id;
    reg.updated_at = now;
  });
  await Promise.all([store.putBooking(booking), ...regs.map((r) => store.putRegistration(r))]);
  return booking;
}

/**
 * Create a booking from a set of leg IDs the admin accepted (a suggested cluster). Rebuilds the
 * cluster server-side from the actual legs — only legs that are still plannable + same date/route are
 * used, so a stale or tampered form can't attach the wrong legs. Returns null if nothing valid remains.
 */
export async function createBookingFromLegIds(legIds: string[], now: string): Promise<VehicleBooking | null> {
  const wanted = new Set(legIds);
  const regs = await store.listRegistrations();
  const items: Array<{ reg: Registration; leg: TransportLeg }> = [];
  for (const reg of regs) for (const leg of reg.legs) if (wanted.has(leg.id) && isPlannable(leg)) items.push({ reg, leg });
  if (items.length === 0) return null;

  // Only keep legs that share the first leg's date + route (defends against a mixed selection).
  const first = items[0].leg;
  const run = items.filter((x) =>
    x.leg.direction === first.direction && x.leg.travel_date === first.travel_date &&
    x.leg.from_location === first.from_location && x.leg.to_location === first.to_location);
  return createBookingFromCluster(makeCluster(run), now);
}

/** Assign a driver to a booking and copy the driver onto its covered legs (the family email cache). */
export async function assignDriver(
  bookingId: string,
  input: { driver_name: string; driver_phone: string; vehicle_reg: string; phoneRegion?: CountryCode },
  now: string,
): Promise<void> {
  const booking = await store.getBooking(bookingId);
  if (!booking) return;
  const phone = normalizePhone(input.driver_phone, input.phoneRegion ?? (config.phoneRegion as CountryCode));

  booking.driver_name = input.driver_name || null;
  booking.driver_phone_raw = input.driver_phone || null;
  booking.driver_phone_e164 = phone.e164;
  booking.vehicle_reg = input.vehicle_reg || null;
  booking.status = input.driver_name ? 'assigned' : booking.status;
  booking.updated_at = now;

  const legIds = new Set(booking.covered_legs.map((c) => c.leg_id));
  const regs = await eachCoveredReg(booking.covered_legs.map((c) => c.registration_ref), (reg) => {
    for (const leg of reg.legs) {
      if (!legIds.has(leg.id)) continue;
      leg.driver_name = booking.driver_name;
      leg.driver_phone_e164 = booking.driver_phone_e164;
      if (booking.driver_name && (leg.status === 'requested' || leg.status === 'needs_clarification')) leg.status = 'planned';
    }
    reg.updated_at = now;
  });
  await Promise.all([store.putBooking(booking), ...regs.map((r) => store.putRegistration(r))]);
}

/** The cost-free family-facing detail for one booking (used by the preview + the WhatsApp twin). */
export function bookingFamilyMessage(booking: VehicleBooking, familyFirst: string): string {
  const when = booking.date;
  const verb = booking.purpose === 'departure'
    ? `Your car will leave ${booking.route_from} at ${booking.depart_time ?? ''} IST`
    : `You'll be picked up around ${booking.depart_time ?? ''} IST`;
  return [
    `Hello ${familyFirst || 'there'},`,
    '',
    'Your local transport is taken care of — there is nothing to pay.',
    '',
    `${booking.route_from} → ${booking.route_to} · ${when}`,
    `${verb}.`,
    booking.driver_name ? `Driver: ${booking.driver_name}${booking.driver_phone_e164 ? ` · ${booking.driver_phone_e164}` : ''}` : '',
    `Vehicle: ${vehicleLabel(booking.vehicle_type)}${booking.vehicle_reg ? ` · ${booking.vehicle_reg}` : ''}`,
    '',
    'If your plans change, just use your edit link or "Find my registration" on the site.',
  ].filter((l) => l !== '').join('\n');
}

/** wa.me link (digits only) for a family, pre-filled with the cost-free confirmation text. */
export function whatsappLink(phoneE164: string | null, message: string): string | null {
  const digits = (phoneE164 ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export interface ConfirmResult { emailed: number; families: string[] }

/**
 * Confirm a booking: mark its covered legs confirmed, copy pickup/driver onto them, auto-confirm any
 * registration whose transport is now fully confirmed, and email each family the cost-free details.
 * A failed email never blocks the others (sendEmail logs + never throws).
 */
export async function confirmBooking(bookingId: string, now: string): Promise<ConfirmResult> {
  const booking = await store.getBooking(bookingId);
  if (!booking) return { emailed: 0, families: [] };

  const findUrl = `${config.appBaseUrl.replace(/\/+$/, '')}/find`;
  const byRef = new Map<string, Set<string>>();
  for (const c of booking.covered_legs) (byRef.get(c.registration_ref) ?? byRef.set(c.registration_ref, new Set()).get(c.registration_ref)!).add(c.leg_id);

  const families: string[] = [];
  for (const [ref, legIds] of byRef) {
    const reg = await store.getRegistration(ref);
    if (!reg) continue;
    for (const leg of reg.legs) {
      if (!legIds.has(leg.id)) continue;
      leg.status = 'confirmed';
      leg.confirmation_sent_at = now;
      leg.pickup_point = leg.pickup_point ?? booking.route_from;
      leg.pickup_time_confirmed = leg.pickup_time_confirmed ?? booking.depart_time;
      leg.driver_name = leg.driver_name ?? booking.driver_name;
      leg.driver_phone_e164 = leg.driver_phone_e164 ?? booking.driver_phone_e164;
    }
    if (allTransportLegsConfirmed(reg)) { reg.status = 'confirmed'; reg.confirmed_at = now; }
    else if (reg.status === 'submitted') reg.status = 'in_review'; // organiser is now working on it
    reg.audit.push({ at: now, actor: 'admin', action: 'confirmation_sent', details: booking.id });

    const content = confirmationEmail(reg, findUrl, eventInfo());
    const sent = await sendEmail(reg, 'confirmation', content, now);
    await store.putRegistration(sent.doc);
    families.push(reg.main_contact_surname || reg.main_contact_first || ref);
  }

  booking.updated_at = now;
  await store.putBooking(booking);
  return { emailed: families.length, families };
}

/** Detach one leg from a booking (back to unbooked/requested). */
export async function detachLeg(bookingId: string, legId: string, now: string): Promise<void> {
  const booking = await store.getBooking(bookingId);
  if (!booking) return;
  const covered = booking.covered_legs.find((c) => c.leg_id === legId);
  booking.covered_legs = booking.covered_legs.filter((c) => c.leg_id !== legId);
  booking.updated_at = now;
  if (covered) {
    const reg = await store.getRegistration(covered.registration_ref);
    if (reg) {
      const leg = reg.legs.find((l) => l.id === legId);
      if (leg) { leg.vehicle_booking_id = null; leg.driver_name = null; leg.driver_phone_e164 = null; if (leg.status === 'planned') leg.status = 'requested'; }
      reg.updated_at = now;
      await store.putRegistration(reg);
    }
  }
  await store.putBooking(booking);
}

/** Delete a booking and release all its legs. */
export async function deleteBooking(bookingId: string, now: string): Promise<void> {
  const booking = await store.getBooking(bookingId);
  if (!booking) return;
  const regs = await eachCoveredReg(booking.covered_legs.map((c) => c.registration_ref), (reg) => {
    const ids = new Set(booking.covered_legs.map((c) => c.leg_id));
    for (const leg of reg.legs) if (ids.has(leg.id)) { leg.vehicle_booking_id = null; leg.driver_name = null; leg.driver_phone_e164 = null; if (leg.status === 'planned') leg.status = 'requested'; }
    reg.updated_at = now;
  });
  await Promise.all([store.deleteBooking(bookingId), ...regs.map((r) => store.putRegistration(r))]);
}

/** Edit a booking's organiser-internal fields (vehicle, operator, quote, notes, status). */
export async function updateBookingFields(bookingId: string, patch: Partial<VehicleBooking>, now: string): Promise<void> {
  const booking = await store.getBooking(bookingId);
  if (!booking) return;
  Object.assign(booking, patch, { id: booking.id, updated_at: now });
  await store.putBooking(booking);
}

/* ---- queues for the one-at-a-time flows ---- */

/** Bookings still waiting for a driver (PRD A0 driver job). */
export function needDriverBookings(bookings: VehicleBooking[]): VehicleBooking[] {
  return bookings.filter((b) => b.status !== 'cancelled' && !b.driver_name);
}

/** Bookings with a driver whose families haven't all been emailed yet (some covered leg not confirmed). */
export function confirmableBookings(bookings: VehicleBooking[], regs: Registration[]): VehicleBooking[] {
  const legStatus = new Map<string, TransportLeg['status']>();
  for (const r of regs) for (const l of r.legs) legStatus.set(l.id, l.status);
  return bookings.filter((b) =>
    b.status === 'assigned' && !!b.driver_name && b.covered_legs.some((c) => legStatus.get(c.leg_id) !== 'confirmed'),
  );
}
