// POST /api/admin/vehicles/update — edit a booking's organiser-internal fields (vehicle, operator,
// quote, notes, status). These are NEVER family-facing (PRD §11). Reads `id` from the body.
import type { APIRoute } from 'astro';
import type { BookingStatus, VehicleBooking, VehicleType } from '../../../../lib/types';
import { adminPost } from '../../../../lib/admin-api';
import { updateBookingFields } from '../../../../lib/vehicles';

export const prerender = false;

const VEHICLE_TYPES: VehicleType[] = ['car', 'suv_innova', 'tempo_traveller', 'minibus', 'other'];
const STATUSES: BookingStatus[] = ['suggested', 'to_book', 'booked', 'assigned', 'completed', 'cancelled'];

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;
  const form = g.form;
  const str = (k: string) => (form.get(k) ?? '').toString().trim();

  const id = str('id');
  if (!id) return ctx.redirect('/admin/vehicles', 303);

  const vehicleType = str('vehicle_type') as VehicleType;
  const status = str('status') as BookingStatus;
  const seats = Number(str('seats'));
  const quote = str('quote_amount');

  const patch: Partial<VehicleBooking> = {
    vehicle_type: VEHICLE_TYPES.includes(vehicleType) ? vehicleType : undefined,
    seats: Number.isFinite(seats) && seats > 0 ? seats : undefined,
    operator_name: str('operator_name') || null,
    operator_contact: str('operator_contact') || null,
    quote_amount: quote ? Number(quote) : null,
    notes: str('notes') || null,
    status: STATUSES.includes(status) ? status : undefined,
  };
  // Drop undefined keys so we don't overwrite with undefined.
  for (const k of Object.keys(patch) as Array<keyof VehicleBooking>) if (patch[k] === undefined) delete patch[k];

  await updateBookingFields(id, patch, new Date().toISOString());
  return ctx.redirect(`/admin/vehicles/${encodeURIComponent(id)}`, 303);
};
