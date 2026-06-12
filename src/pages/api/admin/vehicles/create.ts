// POST /api/admin/vehicles/create — accept a planner suggestion (leg_ids) into a real booking.
import type { APIRoute } from 'astro';
import { adminPost } from '../../../../lib/admin-api';
import { createBookingFromLegIds } from '../../../../lib/vehicles';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;

  const legIds = (g.form.get('leg_ids') ?? '').toString().split(',').map((s) => s.trim()).filter(Boolean);
  const booking = legIds.length ? await createBookingFromLegIds(legIds, new Date().toISOString()) : null;
  return ctx.redirect(booking ? `/admin/vehicles/${booking.id}` : '/admin/vehicles', 303);
};
