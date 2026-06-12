// POST /api/admin/vehicles/detach — remove one family's leg from a booking (back to unbooked).
import type { APIRoute } from 'astro';
import { adminPost } from '../../../../lib/admin-api';
import { detachLeg } from '../../../../lib/vehicles';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;
  const id = (g.form.get('id') ?? '').toString();
  const legId = (g.form.get('leg_id') ?? '').toString();
  if (id && legId) await detachLeg(id, legId, new Date().toISOString());
  return ctx.redirect(id ? `/admin/vehicles/${encodeURIComponent(id)}` : '/admin/vehicles', 303);
};
