// GET /api/admin/reports/export.csv — flattened all-registrations export (session-guarded).
// One row per leg. Excludes edit tokens and health/special-requirements (PRD §10).
import type { APIRoute } from 'astro';
import { store } from '../../../../lib/store';
import { requireSession } from '../../../../lib/auth';
import { exportCsv } from '../../../../lib/reports';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);
  const regs = await store.listRegistrations();
  return new Response(exportCsv(regs), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="registrations-export.csv"' },
  });
};
