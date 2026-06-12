// GET /api/admin/reports/departures.csv — Excel-safe departures schedule (session-guarded).
import type { APIRoute } from 'astro';
import { store } from '../../../../lib/store';
import { requireSession } from '../../../../lib/auth';
import { schedule, scheduleCsv } from '../../../../lib/reports';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!requireSession(cookies, new Date())) return redirect('/admin/login', 303);
  const [regs, bookings] = await Promise.all([store.listRegistrations(), store.listBookings()]);
  return new Response(scheduleCsv(schedule(regs, bookings, 'departure')), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="departures.csv"' },
  });
};
