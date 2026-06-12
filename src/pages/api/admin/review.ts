// POST /api/admin/review — mark a family "reviewed" (status submitted -> in_review, PRD §9.1 A3).
// Session-guarded + CSRF. Reads `ref` from the body. Idempotent: a non-submitted doc is left as-is.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { requireSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);

  const form = await request.formData();
  const csrfField = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof csrfField === 'string' ? csrfField : null)) {
    return new Response('Invalid form session. Please reload.', { status: 403 });
  }

  const ref = (form.get('ref') ?? '').toString();
  const doc = ref ? await store.getRegistration(ref) : null;
  if (doc && doc.status === 'submitted') {
    const now = new Date().toISOString();
    doc.status = 'in_review';
    doc.updated_at = now;
    doc.audit.push({ at: now, actor: 'admin', action: 'marked_reviewed', details: null });
    await store.putRegistration(doc);
  }
  return redirect(`/admin/registrations/${encodeURIComponent(ref)}`, 303);
};
