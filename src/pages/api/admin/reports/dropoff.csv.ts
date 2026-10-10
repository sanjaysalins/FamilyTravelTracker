// GET /api/admin/reports/dropoff.csv — Excel-safe drop-off group sheet (session-guarded).
import type { APIRoute } from 'astro';
import { store } from '../../../../lib/store';
import { requireSession } from '../../../../lib/auth';
import { dropoffSheet, dropoffCsv } from '../../../../lib/reports';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);
  const [regs, bookings] = await Promise.all([store.listRegistrations(), store.listBookings()]);
  return new Response(dropoffCsv(dropoffSheet(regs, bookings)), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="dropoff.csv"' },
  });
};
