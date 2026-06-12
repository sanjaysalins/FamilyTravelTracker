// Shared guard for admin POST endpoints: re-check the session (slides the idle window) and verify
// the CSRF token, then hand back the parsed form. Returns a Response to short-circuit on failure.
import type { APIContext } from 'astro';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from './csrf';
import { requireSession } from './auth';

export async function adminPost(ctx: APIContext): Promise<{ form: FormData } | Response> {
  if (!requireSession(ctx.cookies, new Date())) return ctx.redirect('/admin/login', 303);
  const form = await ctx.request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(ctx.cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid form session. Please reload.', { status: 403 });
  }
  return { form };
}
