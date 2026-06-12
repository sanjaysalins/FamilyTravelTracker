// POST /api/admin/confirm — confirm a booking: mark its legs confirmed, auto-confirm any fully-done
// registration, and email each family the cost-free details (Phase-4 confirmation template). Advance.
import type { APIRoute } from 'astro';
import { config } from '../../../lib/config';
import { store } from '../../../lib/store';
import { adminPost } from '../../../lib/admin-api';
import { confirmBooking } from '../../../lib/vehicles';

export const prerender = false;

const flash = (ctx: Parameters<APIRoute>[0], msg: string) =>
  ctx.cookies.set('ftc_admin_flash', msg, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 30 });

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;
  const id = (g.form.get('id') ?? '').toString().trim();
  const skip = (g.form.get('skip') ?? '').toString().trim();
  const total = (g.form.get('total') ?? '').toString().trim();
  const qs = [total && `total=${encodeURIComponent(total)}`, skip && `skip=${encodeURIComponent(skip)}`].filter(Boolean).join('&');
  const back = `/admin/confirm${qs ? `?${qs}` : ''}`;

  if (id) {
    // Capacity guard (defence in depth — the UI also blocks): never email a vehicle over its seats.
    const booking = await store.getBooking(id);
    const people = booking ? booking.covered_legs.reduce((s, c) => s + c.people, 0) : 0;
    if (booking && people > booking.seats) {
      flash(ctx, `⚠ ${booking.id.split('-').pop()} is over capacity (${people} people, ${booking.seats} seats) — not sent. Fix the booking first.`);
      return ctx.redirect(back, 303);
    }
    const res = await confirmBooking(id, new Date().toISOString());
    const who = res.families.join(', ');
    flash(ctx, res.failed > 0
      ? `⚠ ${res.failed} email(s) could not be sent for ${who} — check the email log.`
      : res.emailed > 0 ? `Emailed ${who} ✓` : 'Nothing to email on that booking.');
  }
  return ctx.redirect(back, 303);
};
