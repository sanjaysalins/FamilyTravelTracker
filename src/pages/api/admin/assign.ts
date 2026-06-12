// POST /api/admin/assign — save a driver on a booking (one-at-a-time assign flow) and advance.
import type { APIRoute } from 'astro';
import { adminPost } from '../../../lib/admin-api';
import { assignDriver } from '../../../lib/vehicles';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;
  const form = g.form;
  const str = (k: string) => (form.get(k) ?? '').toString().trim();

  const id = str('id');
  if (id) {
    await assignDriver(id, {
      driver_name: str('driver_name'),
      driver_phone: str('driver_phone'),
      vehicle_reg: str('vehicle_reg'),
    }, new Date().toISOString());
  }
  const skip = str('skip');
  const total = str('total');
  const qs = [total && `total=${encodeURIComponent(total)}`, skip && `skip=${encodeURIComponent(skip)}`].filter(Boolean).join('&');
  return ctx.redirect(`/admin/assign${qs ? `?${qs}` : ''}`, 303);
};
