// POST /api/pickups/save: set one pickup's driver name / phone / car reg. Allowed for the
// organiser (admin session) or the driver company (driver session). CSRF-checked. Leaving all
// three fields blank clears the driver back to TBC. Every save stamps who + when.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { editorRole } from '../../../lib/driver-auth';
import { cleanDriver, DRIVERS_KEY, type DriverMap } from '../../../lib/pickups';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const now = new Date();
  const role = editorRole(cookies, now);
  if (!role) return redirect('/driver', 303);

  const form = await request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid form session. Please reload.', { status: 403 });
  }

  const c = cleanDriver(form.get('id'), form.get('name'), form.get('phone'), form.get('reg'));
  if (!c) return new Response('Unknown pickup.', { status: 400 });

  const map = (await store.getSystem<DriverMap>(DRIVERS_KEY)) ?? {};
  if (!c.name && !c.phone && !c.reg) delete map[c.id];
  else map[c.id] = { name: c.name, phone: c.phone, reg: c.reg, updated_at: now.toISOString(), by: role };
  await store.putSystem(DRIVERS_KEY, map);
  return redirect(`/pickups#${c.id}`, 303);
};
