// POST /api/admin/vehicles/delete — delete a booking and release all its legs.
import type { APIRoute } from 'astro';
import { adminPost } from '../../../../lib/admin-api';
import { deleteBooking } from '../../../../lib/vehicles';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;
  const id = (g.form.get('id') ?? '').toString();
  if (id) await deleteBooking(id, new Date().toISOString());
  return ctx.redirect('/admin/vehicles', 303);
};
