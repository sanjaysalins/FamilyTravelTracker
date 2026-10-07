// POST /api/pickups/set-password: organiser (admin session only) sets or changes the
// driver-company password. Stored bcrypt-hashed in the `system` store; never echoed back.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { requireSession } from '../../../lib/auth';
import { DRIVER_PW_KEY, hashDriverPassword } from '../../../lib/driver-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);
  const form = await request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid form session. Please reload.', { status: 403 });
  }
  const pw = (form.get('password') ?? '').toString();
  if (pw.length < 8) return new Response('Password must be at least 8 characters.', { status: 400 });
  await store.putSystem(DRIVER_PW_KEY, hashDriverPassword(pw));
  return redirect('/pickups?pw=set', 303);
};
