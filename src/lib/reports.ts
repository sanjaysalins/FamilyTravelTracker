// Reports the organiser runs the event from (plan Phase 6, PRD §10). All PURE over the in-memory
// document list (+ bookings for the vehicle label). Excel-safe CSV: UTF-8 BOM, DD-MM-YYYY text,
// `+…` phones, and NEVER any edit token or health/mobility note (run sheets get forwarded to drivers).

import type { Registration, TransportLeg, VehicleBooking } from './types';
import { toDDMMYYYY } from './dates';
import { isChaseable } from './tasks';
import { vehicleLabel } from './planner';

const sortTime = (l: TransportLeg): string => l.pickup_time_confirmed || l.travel_time || (l.direction === 'departure' ? '00:00' : '99:99');
const guestName = (r: Registration): string => [r.main_contact_first, r.main_contact_surname].filter(Boolean).join(' ').trim();
const guestPhone = (r: Registration): string => r.phone_e164 || r.phone_raw || '';

export interface ScheduleRow {
  date: string;            // ISO
  time: string;
  guest: string;
  people: number;
  route: string;
  carrier: string;
  driver: string;
  vehicle: string;
  pickup: string;
  status: TransportLeg['status'];
}

function vehicleMap(bookings: VehicleBooking[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of bookings) m.set(b.id, vehicleLabel(b.vehicle_type));
  return m;
}

/** Arrivals (+ internal) or departures schedule, transport-needed legs grouped by date, sorted by time. */
export function schedule(regs: Registration[], bookings: VehicleBooking[], kind: 'arrival' | 'departure'): ScheduleRow[] {
  const veh = vehicleMap(bookings);
  const dirs = kind === 'arrival' ? ['arrival', 'internal'] : ['departure'];
  const rows: ScheduleRow[] = [];
  for (const r of regs) {
    for (const l of r.legs) {
      if (!l.transport_needed || !dirs.includes(l.direction)) continue;
      rows.push({
        date: l.travel_date ?? '',
        time: l.pickup_time_confirmed || l.travel_time || '',
        guest: guestName(r),
        people: l.people_on_this_leg,
        route: `${l.from_location} → ${l.to_location}`,
        carrier: l.carrier_ref ?? '',
        driver: l.driver_name ?? '',
        vehicle: l.vehicle_booking_id ? (veh.get(l.vehicle_booking_id) ?? '') : '',
        pickup: l.pickup_point ?? '',
        status: l.status,
      });
    }
  }
  return rows.sort((a, b) => (a.date + sortKey(a.time)).localeCompare(b.date + sortKey(b.time)));
}
const sortKey = (t: string): string => (t && /^\d/.test(t) ? t : '99:99');

/** Seat demand per date: SUM OF PEOPLE (not leg count) needing transport, so vehicles are sized right. */
export interface SeatDemandRow { date: string; arrival: number; departure: number; internal: number; total: number }
export function seatDemand(regs: Registration[]): SeatDemandRow[] {
  const byDate = new Map<string, SeatDemandRow>();
  for (const r of regs) {
    for (const l of r.legs) {
      if (!l.transport_needed || !l.travel_date) continue;
      const row = byDate.get(l.travel_date) ?? { date: l.travel_date, arrival: 0, departure: 0, internal: 0, total: 0 };
      row[l.direction] += l.people_on_this_leg;
      row.total += l.people_on_this_leg;
      byDate.set(l.travel_date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Per-driver run sheet (print). One group per driver, grouped by day, sorted by pickup time.
 *  Deliberately carries NO guest free-text (`guest_notes`) and NO health/special requirements — run
 *  sheets get forwarded to hired drivers over WhatsApp, so only operational fields appear. */
export interface RunStop { date: string; time: string; pickup: string; guest: string; phone: string; people: number; route: string; vehicle: string }
export interface RunSheet { driver: string; phone: string; stops: RunStop[] }
export function runSheets(regs: Registration[], bookings: VehicleBooking[]): RunSheet[] {
  const veh = vehicleMap(bookings);
  const byDriver = new Map<string, RunSheet>();
  for (const r of regs) {
    for (const l of r.legs) {
      if (!l.transport_needed || !l.driver_name) continue;
      const key = l.driver_name;
      const sheet = byDriver.get(key) ?? { driver: l.driver_name, phone: l.driver_phone_e164 ?? '', stops: [] };
      sheet.stops.push({
        date: l.travel_date ?? '',
        time: l.pickup_time_confirmed || l.travel_time || '',
        pickup: l.pickup_point ?? `${l.from_location}`,
        guest: guestName(r),
        phone: guestPhone(r),
        people: l.people_on_this_leg,
        route: `${l.from_location} → ${l.to_location}`,
        vehicle: l.vehicle_booking_id ? (veh.get(l.vehicle_booking_id) ?? '') : '',
      });
      byDriver.set(key, sheet);
    }
  }
  // Sort each driver's stops by day, then by pickup time, so a multi-day driver gets a per-day plan.
  for (const s of byDriver.values()) s.stops.sort((a, b) => (a.date + sortKey(a.time)).localeCompare(b.date + sortKey(b.time)));
  return [...byDriver.values()].sort((a, b) => a.driver.localeCompare(b.driver));
}

/** Chase list: legs missing a date or a flight/train carrier ref. */
export interface ChaseRow { guest: string; contact: string; whatsapp: string | null; direction: string; missing: string }
export function chaseList(regs: Registration[]): ChaseRow[] {
  const out: ChaseRow[] = [];
  for (const r of regs) {
    for (const l of r.legs) {
      if (!isChaseable(l)) continue;
      const missing = (l.date_tbc || !l.travel_date) ? 'travel date' : 'flight / train number';
      const digits = (r.whatsapp_e164 || r.phone_e164 || '').replace(/[^0-9]/g, '');
      out.push({
        guest: guestName(r),
        contact: `${r.email} · ${r.phone_raw}`,
        whatsapp: digits ? `https://wa.me/${digits}` : null,
        direction: l.direction,
        missing,
      });
    }
  }
  return out;
}

/** Headcount: total confirmed people + people arriving per date. */
export interface Headcount { confirmedPeople: number; totalPeople: number; perArrivalDate: Array<{ date: string; people: number }> }
export function headcount(regs: Registration[]): Headcount {
  let confirmedPeople = 0;
  let totalPeople = 0;
  const byDate = new Map<string, number>();
  for (const r of regs) {
    totalPeople += r.party_size;
    if (r.status === 'confirmed') confirmedPeople += r.party_size;
    const arr = r.legs.find((l) => l.direction === 'arrival');
    if (arr?.travel_date) byDate.set(arr.travel_date, (byDate.get(arr.travel_date) ?? 0) + r.party_size);
  }
  return {
    confirmedPeople,
    totalPeople,
    perArrivalDate: [...byDate.entries()].map(([date, people]) => ({ date, people })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ---- Excel-safe CSV (UTF-8 BOM, CRLF, quoted fields) ---- */

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvField).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM so Excel reads UTF-8 + keeps `+` and Indian names
}

/** A schedule as CSV. Dates DD-MM-YYYY text, phones already `+…`; no tokens, no health notes. */
export function scheduleCsv(rows: ScheduleRow[]): string {
  const headers = ['Date', 'Time (IST)', 'Guest', 'People', 'Route', 'Carrier ref', 'Driver', 'Vehicle', 'Pickup point', 'Status'];
  return toCsv(headers, rows.map((r) => [toDDMMYYYY(r.date), r.time, r.guest, String(r.people), r.route, r.carrier, r.driver, r.vehicle, r.pickup, r.status]));
}

/** Flattened all-registrations export — one row per leg. Excludes tokens + special requirements. */
export function exportCsv(regs: Registration[]): string {
  const headers = ['Reference', 'Surname', 'First name', 'Email', 'Phone', 'Country', 'Party size', 'Status',
    'Leg', 'Direction', 'Date', 'Time', 'From', 'To', 'Carrier ref', 'People on leg', 'Transport needed', 'Leg status', 'Driver'];
  const rows: string[][] = [];
  for (const r of regs) {
    for (const l of r.legs) {
      rows.push([
        r.reference_number, r.main_contact_surname, r.main_contact_first, r.email, guestPhone(r), r.home_country,
        String(r.party_size), r.status,
        String(l.leg_order), l.direction, toDDMMYYYY(l.travel_date), l.travel_time ?? '', l.from_location, l.to_location,
        l.carrier_ref ?? '', String(l.people_on_this_leg), l.transport_needed ? 'yes' : 'no', l.status, l.driver_name ?? '',
      ]);
    }
  }
  return toCsv(headers, rows);
}
