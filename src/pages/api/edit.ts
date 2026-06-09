// POST /api/edit — save guest edits to an existing registration (Phase 3).
// CSRF-checked; re-verifies the edit token; rebuilds via the same pure builder, then merges onto
// the stored doc (preserving admin leg-planning) and applies the edit-after-confirm cascade.
import type { APIRoute } from 'astro';
import type { CountryCode } from 'libphonenumber-js';
import { store } from '../../lib/store';
import { config } from '../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../lib/csrf';
import { verifyToken } from '../../lib/tokens';
import { applyEdit, buildRegistration } from '../../lib/registration-form';

export const prerender = false;

const CHECKBOXES = ['wa_same', 'consent', 'arr_tbc', 'dep_tbc', 'final_ok', 'int1_transport', 'int2_transport'];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [k, val] of form.entries()) if (typeof val === 'string') fields[k] = val;

  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, fields[CSRF_FIELD])) {
    return new Response('Invalid or expired form session. Please reopen your edit link.', { status: 403 });
  }

  const ref = fields.ref ?? '';
  const token = fields.token ?? '';
  const existing = ref ? await store.getRegistration(ref) : null;
  const nowIso = new Date().toISOString();

  // Re-verify the token at write time. On any problem, send them back to the edit link page
  // (which renders the friendly refusal). Never reveal whether the reference exists.
  if (!existing || verifyToken(token, existing, nowIso) !== 'ok') {
    return redirect(`/edit/${encodeURIComponent(ref)}?token=${encodeURIComponent(token)}`, 303);
  }

  const region = (fields.phone_region || config.phoneRegion) as CountryCode;
  const result = buildRegistration({
    fields,
    reference: ref,
    rawToken: 'edit-placeholder', // discarded by applyEdit (token is preserved from existing)
    now: nowIso,
    expiresAt: existing.edit_token_expires_at,
    phoneRegion: region,
  });

  if (!result.ok) {
    const values: Record<string, string> = { ...fields };
    for (const k of [CSRF_FIELD, 'ref', 'token']) delete values[k];
    for (const cb of CHECKBOXES) values[cb] = form.has(cb) ? 'on' : '';
    cookies.set('ftc_form', JSON.stringify({ errors: result.errors, values }), {
      path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 300,
    });
    return redirect(`/edit/${encodeURIComponent(ref)}?token=${encodeURIComponent(token)}`, 303);
  }

  const updated = applyEdit(existing, result.doc, nowIso);
  await store.putRegistration(updated);

  // Show the success page with the same (still-valid) link the guest used.
  cookies.set('ftc_new', JSON.stringify({ ref, token }), {
    path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 600,
  });
  cookies.delete('ftc_form', { path: '/' });
  return redirect(`/success/${encodeURIComponent(ref)}`, 303);
};
