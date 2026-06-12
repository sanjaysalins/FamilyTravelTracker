// POST /api/admin/confirm — confirm a booking: mark its legs confirmed, auto-confirm any fully-done
// registration, and email each family the cost-free details (Phase-4 confirmation template). Advance.
import type { APIRoute } from 'astro';
import { adminPost } from '../../../lib/admin-api';
import { confirmBooking } from '../../../lib/vehicles';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;
  const id = (g.form.get('id') ?? '').toString().trim();
  if (id) await confirmBooking(id, new Date().toISOString());
  const skip = (g.form.get('skip') ?? '').toString().trim();
  return ctx.redirect(`/admin/confirm${skip ? `?skip=${encodeURIComponent(skip)}` : ''}`, 303);
};
