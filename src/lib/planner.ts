// Vehicle planner (plan Phase 5.4, PRD §9.1 A5). PURE + unit-tested: clusters unbooked transport
// legs that share a date + route into a suggested vehicle, within a 60-minute window, and picks the
// smallest vehicle that seats the group. The admin accepts a suggestion to create a real booking.

import type { Registration, TransportLeg, VehicleType } from './types';

export const VEHICLES: Array<{ type: VehicleType; label: string; seats: number }> = [
  { type: 'car', label: 'Car', seats: 4 },
  { type: 'suv_innova', label: 'Innova', seats: 7 },
  { type: 'tempo_traveller', label: 'Tempo Traveller', seats: 12 },
  { type: 'minibus', label: 'Minibus', seats: 20 },
];

const CLUSTER_WINDOW_MIN = 60; // PRD open question — 60 min for now

export function vehicleLabel(t: VehicleType): string {
  return VEHICLES.find((v) => v.type === t)?.label ?? 'Other';
}

/** Smallest vehicle that seats the group; falls back to the largest for big groups. */
export function pickVehicle(people: number): { type: VehicleType; seats: number } {
  for (const v of VEHICLES) if (v.seats >= people) return { type: v.type, seats: v.seats };
  const last = VEHICLES[VEHICLES.length - 1];
  return { type: last.type, seats: last.seats };
}

function mins(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
/** A leg's sort time: departures cluster on the leave time, arrivals on landing time. */
function sortTime(l: TransportLeg): string {
  return l.travel_time || (l.direction === 'departure' ? '00:00' : '12:00');
}

export interface ClusterLeg {
  registration_ref: string;
  leg_id: string;
  family_name: string;
  people: number;
  phone_e164: string | null;
}

export interface Cluster {
  date: string;
  direction: TransportLeg['direction'];
  from: string;
  to: string;
  depart: string;            // suggested "leave/pickup by" time
  people: number;
  vehicle_type: VehicleType;
  seats: number;
  legs: ClusterLeg[];
}

/** A leg we can actually plan a vehicle for: transport needed, not already on a booking, real date. */
export function isPlannable(l: TransportLeg): boolean {
  return l.transport_needed && !l.vehicle_booking_id && !l.date_tbc && !!l.travel_date && l.direction !== 'internal';
}

/** Build a single cluster (vehicle suggestion) from a run of legs that should share a vehicle. */
export function makeCluster(run: Array<{ reg: Registration; leg: TransportLeg }>): Cluster {
  const people = run.reduce((s, x) => s + x.leg.people_on_this_leg, 0);
  const v = pickVehicle(people);
  const dir = run[0].leg.direction;
  const depart = dir === 'departure' ? sortTime(run[0].leg) : sortTime(run[run.length - 1].leg);
  return {
    date: run[0].leg.travel_date!,
    direction: dir,
    from: run[0].leg.from_location,
    to: run[0].leg.to_location,
    depart,
    people,
    vehicle_type: v.type,
    seats: v.seats,
    legs: run.map((x) => ({
      registration_ref: x.reg.reference_number,
      leg_id: x.leg.id,
      family_name: x.reg.main_contact_surname || x.reg.main_contact_first || x.reg.reference_number,
      people: x.leg.people_on_this_leg,
      phone_e164: x.reg.phone_e164,
    })),
  };
}

/** Group unbooked legs into suggested vehicles. Sorted by date then departure time. */
export function suggestClusters(regs: Registration[]): Cluster[] {
  // Flatten plannable legs with their family context.
  const flat: Array<{ reg: Registration; leg: TransportLeg }> = [];
  for (const reg of regs) for (const leg of reg.legs) if (isPlannable(leg)) flat.push({ reg, leg });

  // Bucket by direction + date + route.
  const buckets = new Map<string, Array<{ reg: Registration; leg: TransportLeg }>>();
  for (const item of flat) {
    const k = [item.leg.direction, item.leg.travel_date, item.leg.from_location, item.leg.to_location].join('||');
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(item);
  }

  const clusters: Cluster[] = [];
  for (const group of buckets.values()) {
    group.sort((a, b) => sortTime(a.leg).localeCompare(sortTime(b.leg)));
    // Split a bucket wherever the time gap exceeds the window.
    let run: Array<{ reg: Registration; leg: TransportLeg }> = [group[0]];
    for (let i = 1; i < group.length; i++) {
      if (mins(sortTime(group[i].leg)) - mins(sortTime(run[run.length - 1].leg)) <= CLUSTER_WINDOW_MIN) {
        run.push(group[i]);
      } else {
        clusters.push(makeCluster(run));
        run = [group[i]];
      }
    }
    clusters.push(makeCluster(run));
  }

  return clusters.sort((a, b) => (a.date + a.depart).localeCompare(b.date + b.depart));
}

/** A registration's transport is fully confirmed (auto-confirm trigger, PRD §9.2). */
export function allTransportLegsConfirmed(reg: Registration): boolean {
  const needed = reg.legs.filter((l) => l.transport_needed);
  return needed.length > 0 && needed.every((l) => l.status === 'confirmed');
}
