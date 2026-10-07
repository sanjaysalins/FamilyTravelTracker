// POST /api/pickups/logout: ends the driver-company session.
import type { APIRoute } from 'astro';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { clearDriverSession } from '../../../lib/driver-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid session. Please reload.', { status: 403 });
  }
  clearDriverSession(cookies);
  return redirect('/pickups', 303);
};
