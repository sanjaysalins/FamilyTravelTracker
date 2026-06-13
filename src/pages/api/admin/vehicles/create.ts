// POST /api/admin/vehicles/create — accept a planner suggestion (leg_ids) into a real booking.
import type { APIRoute } from 'astro';
import { adminPost } from '../../../../lib/admin-api';
import { createBookingFromLegIds } from '../../../../lib/vehicles';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;

  // Accepts either one comma-joined `leg_ids` (Vehicles "accept suggestion") or many `leg_ids`
  // checkbox fields (Dispatch board "book selected together"). Flatten + split handles both.
  const legIds = g.form.getAll('leg_ids').flatMap((v) => v.toString().split(',')).map((s) => s.trim()).filter(Boolean);
  const booking = legIds.length ? await createBookingFromLegIds(legIds, new Date().toISOString()) : null;
  return ctx.redirect(booking ? `/admin/vehicles/${booking.id}` : '/admin/vehicles', 303);
};
