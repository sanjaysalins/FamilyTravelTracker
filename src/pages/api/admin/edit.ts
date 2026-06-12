// POST /api/admin/edit — admin full-edit of any registration (PRD §9.1 A4). Session-guarded + CSRF.
// Reuses the guest builder + applyEdit cascade (so an admin edit of a confirmed doc re-opens it for
// review and resets only the touched legs), but authorises by session — no edit token needed.
import type { APIRoute } from 'astro';
import type { CountryCode } from 'libphonenumber-js';
import { store } from '../../../lib/store';
import { config } from '../../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { requireSession } from '../../../lib/auth';
import { applyEdit, buildRegistration } from '../../../lib/registration-form';

export const prerender = false;

const CHECKBOXES = ['wa_same', 'consent', 'arr_tbc', 'dep_tbc', 'final_ok', 'int1_transport', 'int2_transport'];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);

  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [k, val] of form.entries()) if (typeof val === 'string') fields[k] = val;

  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, fields[CSRF_FIELD])) {
    return new Response('Invalid form session. Please reload.', { status: 403 });
  }

  const ref = fields.ref ?? '';
  const existing = ref ? await store.getRegistration(ref) : null;
  if (!existing) return redirect('/admin/registrations', 303);

  const nowIso = new Date().toISOString();
  const region = (fields.phone_region || config.phoneRegion) as CountryCode;
  const result = buildRegistration({
    fields,
    reference: ref,
    rawToken: 'admin-edit-placeholder', // discarded by applyEdit (token preserved from existing)
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
    return redirect(`/admin/registrations/${encodeURIComponent(ref)}/edit`, 303);
  }

  const updated = applyEdit(existing, result.doc, nowIso);
  // Mark the edit as admin-made in the audit trail (applyEdit logs a generic 'edited').
  updated.audit.push({ at: nowIso, actor: 'admin', action: 'admin_edited', details: null });
  await store.putRegistration(updated);

  return redirect(`/admin/registrations/${encodeURIComponent(ref)}`, 303);
};
