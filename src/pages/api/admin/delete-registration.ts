// POST /api/admin/delete-registration — cancel (keep, mark cancelled) or delete (remove all data)
// one family. Session-guarded + CSRF. Deleting cascades into shared bookings (no dangling refs).
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { adminPost } from '../../../lib/admin-api';
import { deleteRegistrationCascade } from '../../../lib/privacy';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await adminPost(ctx);
  if (g instanceof Response) return g;

  const ref = (g.form.get('ref') ?? '').toString();
  const action = (g.form.get('action') ?? '').toString();
  if (!ref) return ctx.redirect('/admin/registrations', 303);
  const now = new Date().toISOString();

  if (action === 'delete') {
    await deleteRegistrationCascade(ref, now);
    return ctx.redirect('/admin/registrations', 303);
  }

  // cancel: keep the record but mark it withdrawn
  const reg = await store.getRegistration(ref);
  if (reg && reg.status !== 'cancelled') {
    reg.status = 'cancelled';
    reg.updated_at = now;
    reg.audit.push({ at: now, actor: 'admin', action: 'cancelled', details: null });
    await store.putRegistration(reg);
  }
  return ctx.redirect(`/admin/registrations/${encodeURIComponent(ref)}`, 303);
};
