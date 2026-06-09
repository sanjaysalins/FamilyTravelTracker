// POST /api/register — the guest submit handler (plan Phase 2a).
// CSRF-checked; validates + builds the document via the pure builder; seeds legs; generates
// the edit token (stores hash only); idempotent on the submission nonce (double-tap / refresh
// creates ONE record); hands the raw token to the success page via a short-lived cookie.
import type { APIRoute } from 'astro';
import type { CountryCode } from 'libphonenumber-js';
import { store } from '../../lib/store';
import { config } from '../../lib/config';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../lib/csrf';
import { nextReference } from '../../lib/reference';
import { generateToken } from '../../lib/tokens';
import { buildRegistration } from '../../lib/registration-form';

export const prerender = false;

// Checkboxes that must be echoed explicitly (present='on', absent='') so error re-renders
// don't fall back to their default-checked state.
const CHECKBOXES = ['wa_same', 'consent', 'arr_tbc', 'dep_tbc', 'final_ok', 'int1_transport', 'int2_transport'];

const NONCE_KEY = 'submit_nonces';

function isoPlusDays(now: Date, days: number): string {
  const d = new Date(now.getTime() + days * 86400000);
  return d.toISOString();
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [k, val] of form.entries()) {
    if (typeof val === 'string') fields[k] = val;
  }

  // ---- CSRF ----
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, fields[CSRF_FIELD])) {
    return new Response('Invalid or expired form session. Please reload the page and try again.', { status: 403 });
  }

  // ---- submission nonce: idempotent on double-submit / refresh ----
  const nonce = fields.submit_nonce ?? '';
  const seen = (await store.getSystem<Record<string, string>>(NONCE_KEY)) ?? {};
  if (nonce && seen[nonce]) {
    return redirect(`/success/${encodeURIComponent(seen[nonce])}`, 303);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const year = config.event.start.slice(0, 4);
  const region = (fields.phone_region || config.phoneRegion) as CountryCode;

  const existing = await store.listRegistrations();
  const reference = nextReference(existing.map((r) => r.reference_number), year);
  const rawToken = generateToken();

  const result = buildRegistration({
    fields,
    reference,
    rawToken,
    now: nowIso,
    expiresAt: isoPlusDays(now, config.editTokenExpiryDays),
    phoneRegion: region,
  });

  if (!result.ok) {
    // Flash the errors + submitted values back to /register for inline re-render.
    const values: Record<string, string> = { ...fields };
    delete values[CSRF_FIELD];
    delete values.submit_nonce;
    for (const cb of CHECKBOXES) values[cb] = form.has(cb) ? 'on' : '';
    cookies.set('ftc_form', JSON.stringify({ errors: result.errors, values }), {
      path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 300,
    });
    return redirect('/register', 303);
  }

  await store.putRegistration(result.doc);

  // record the nonce -> reference so a repeat POST is idempotent
  if (nonce) {
    seen[nonce] = reference;
    await store.putSystem(NONCE_KEY, seen);
  }

  // hand the RAW token to the success page (out of the URL) via a short-lived cookie
  cookies.set('ftc_new', JSON.stringify({ ref: reference, token: rawToken }), {
    path: '/', httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: 600,
  });
  cookies.delete('ftc_form', { path: '/' });

  return redirect(`/success/${encodeURIComponent(reference)}`, 303);
};
