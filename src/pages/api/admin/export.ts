// GET /api/admin/export — session-guarded "Export all" JSON backup download (PRD §17 / A8).
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { requireSession } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);
  const dump = await store.exportAll();
  return new Response(JSON.stringify(dump, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="family-travel-backup.json"',
    },
  });
};
