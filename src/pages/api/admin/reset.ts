// POST /api/admin/reset — session-guarded "delete all data" (A8). Saves a one-step undo snapshot
// first, then wipes registrations + bookings. Requires the confirm checkbox.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { config } from '../../../lib/config';
import { adminPost } from '../../../lib/admin-api';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;

  if (g.form.get('confirm') !== 'yes') {
    ctx.cookies.set('ftc_admin_flash', 'Tick the box to confirm deletion.', { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 30 });
    return ctx.redirect('/admin/settings', 303);
  }

  const now = new Date().toISOString();
  await store.snapshot('_before_delete_all', now); // one-step undo
  await store.wipeAll();

  ctx.cookies.set('ftc_admin_flash', 'All family data deleted. A "_before_delete_all" snapshot was saved.', { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 30 });
  return ctx.redirect('/admin/settings', 303);
};
