// POST /api/admin/logout. CSRF-checked; clears the session cookie and returns to the login page.
import type { APIRoute } from 'astro';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { clearSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const csrfField = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof csrfField === 'string' ? csrfField : null)) {
    return new Response('Invalid session. Please reload.', { status: 403 });
  }
  clearSession(cookies);
  return redirect('/admin/login', 303);
};
