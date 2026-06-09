// Data layer over Netlify Blobs, with a local-file fallback for `astro dev` (no Netlify needed).
// One document per family in store "registrations"; cross-family bookings in "vehicle_bookings";
// small operational keys (login_attempts, settings) in "system".
//
// All Blobs access goes through here — nothing else touches Blobs directly (PRD §6).

import type { Registration, VehicleBooking } from './types';

/** A tiny key/value interface both backends implement. */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

const useBlobs = () =>
  !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);

/* ---- Netlify Blobs backend (prod + `netlify dev`) ---- */
function blobKV(name: string): KV {
  // Lazy import so local dev without the context never touches it.
  const getStorePromise = import('@netlify/blobs').then((m) => m.getStore({ name, consistency: 'strong' }));
  return {
    async get<T>(key: string) {
      const store = await getStorePromise;
      return (await store.get(key, { type: 'json' })) as T | null;
    },
    async set(key, value) {
      const store = await getStorePromise;
      await store.setJSON(key, value);
    },
    async delete(key) {
      const store = await getStorePromise;
      await store.delete(key);
    },
    async list() {
      const store = await getStorePromise;
      const res = await store.list();
      return res.blobs.map((b: { key: string }) => b.key);
    },
  };
}

/* ---- Local-file backend (.data/<store>/<key>.json) for `astro dev` ---- */
function localKV(name: string): KV {
  const dirPromise = (async () => {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const dir = path.resolve('.data', name);
    await fs.mkdir(dir, { recursive: true });
    return { dir, path, fs };
  })();
  const file = async (key: string) => {
    const { dir, path } = await dirPromise;
    return path.join(dir, encodeURIComponent(key) + '.json');
  };
  return {
    async get<T>(key: string) {
      const { fs } = await dirPromise;
      try {
        return JSON.parse(await fs.readFile(await file(key), 'utf8')) as T;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      const { fs } = await dirPromise;
      await fs.writeFile(await file(key), JSON.stringify(value, null, 2), 'utf8');
    },
    async delete(key) {
      const { fs } = await dirPromise;
      try { await fs.unlink(await file(key)); } catch { /* already gone */ }
    },
    async list() {
      const { dir, fs } = await dirPromise;
      try {
        const names = await fs.readdir(dir);
        return names.filter((n) => n.endsWith('.json')).map((n) => decodeURIComponent(n.slice(0, -5)));
      } catch {
        return [];
      }
    },
  };
}

const kv = (name: string): KV => (useBlobs() ? blobKV(name) : localKV(name));

/* ---- forward-compatible read (our "migration" story, plan Phase 1.3) ----
   A document written before a field existed must never crash a newer screen.
   On read we additively fill any ABSENT field with a safe default; present
   values (including legitimate false/0/"") are kept untouched. This is a no-op
   for an already-complete document. */

function normalizeLeg(raw: Partial<TransportLeg>, idx: number): TransportLeg {
  return {
    id: raw.id ?? `leg-${idx + 1}`,
    leg_order: raw.leg_order ?? idx + 1,
    direction: raw.direction ?? 'arrival',
    from_location: raw.from_location ?? '',
    to_location: raw.to_location ?? '',
    travel_date: raw.travel_date ?? null,
    date_tbc: raw.date_tbc ?? false,
    travel_time: raw.travel_time ?? null,
    time_meaning: raw.time_meaning ?? null,
    carrier_type: raw.carrier_type ?? null,
    carrier_ref: raw.carrier_ref ?? null,
    people_on_this_leg: raw.people_on_this_leg ?? 0,
    transport_needed: raw.transport_needed ?? false,
    guest_notes: raw.guest_notes ?? null,
    status: raw.status ?? 'requested',
    vehicle_booking_id: raw.vehicle_booking_id ?? null,
    pickup_point: raw.pickup_point ?? null,
    pickup_time_confirmed: raw.pickup_time_confirmed ?? null,
    driver_name: raw.driver_name ?? null,
    driver_phone_e164: raw.driver_phone_e164 ?? null,
    admin_notes: raw.admin_notes ?? null,
    confirmation_sent_at: raw.confirmation_sent_at ?? null,
  };
}

function normalizeRegistration(raw: Partial<Registration>): Registration {
  return {
    reference_number: raw.reference_number ?? '',
    edit_token_hash: raw.edit_token_hash ?? '',
    edit_token_created_at: raw.edit_token_created_at ?? '',
    edit_token_expires_at: raw.edit_token_expires_at ?? null,
    edit_token_revoked_at: raw.edit_token_revoked_at ?? null,
    main_contact_first: raw.main_contact_first ?? '',
    main_contact_surname: raw.main_contact_surname ?? '',
    email: raw.email ?? '',
    phone_raw: raw.phone_raw ?? '',
    phone_e164: raw.phone_e164 ?? null,
    whatsapp_same_as_phone: raw.whatsapp_same_as_phone ?? false,
    whatsapp_e164: raw.whatsapp_e164 ?? null,
    home_city: raw.home_city ?? null,
    home_country: raw.home_country ?? '',
    relationship: raw.relationship ?? null,
    party_size: raw.party_size ?? 1,
    party_members: raw.party_members ?? [],
    special_requirements: raw.special_requirements ?? null,
    stay_type: raw.stay_type ?? null,
    stay_location: raw.stay_location ?? null,
    consent_given: raw.consent_given ?? false,
    consent_at: raw.consent_at ?? null,
    status: raw.status ?? 'submitted',
    confirmed_at: raw.confirmed_at ?? null,
    edited_after_confirm: raw.edited_after_confirm ?? false,
    admin_notes: raw.admin_notes ?? null,
    created_at: raw.created_at ?? '',
    updated_at: raw.updated_at ?? '',
    legs: (raw.legs ?? []).map((l, i) => normalizeLeg(l, i)),
    audit: raw.audit ?? [],
    emails: raw.emails ?? [],
  };
}

/* ---- typed data access ---- */
const registrations = () => kv('registrations');
const vehicles = () => kv('vehicle_bookings');
const system = () => kv('system');
const snapshots = () => kv('snapshots');

/** A point-in-time copy of all family data (registrations + bookings). */
export interface Snapshot {
  name: string;
  created_at: string;
  counts: { registrations: number; vehicle_bookings: number };
  data: { registrations: Registration[]; vehicle_bookings: VehicleBooking[] };
}

export const store = {
  // registrations (reads normalised so older docs gain new fields' safe defaults)
  async getRegistration(ref: string): Promise<Registration | null> {
    const raw = await registrations().get<Registration>(ref);
    return raw ? normalizeRegistration(raw) : null;
  },
  putRegistration: (doc: Registration) => registrations().set(doc.reference_number, doc),
  deleteRegistration: (ref: string) => registrations().delete(ref),
  async listRegistrations(): Promise<Registration[]> {
    const keys = await registrations().list();
    const docs = await Promise.all(keys.map((k) => registrations().get<Registration>(k)));
    return docs.filter((d): d is Registration => d !== null).map(normalizeRegistration);
  },

  // vehicle bookings
  getBooking: (id: string) => vehicles().get<VehicleBooking>(id),
  putBooking: (b: VehicleBooking) => vehicles().set(b.id, b),
  deleteBooking: (id: string) => vehicles().delete(id),
  async listBookings(): Promise<VehicleBooking[]> {
    const keys = await vehicles().list();
    const docs = await Promise.all(keys.map((k) => vehicles().get<VehicleBooking>(k)));
    return docs.filter((b): b is VehicleBooking => b !== null);
  },

  // system / operational
  getSystem: <T>(key: string) => system().get<T>(key),
  putSystem: (key: string, value: unknown) => system().set(key, value),

  // export-all backup (PRD §17)
  async exportAll() {
    return {
      registrations: await this.listRegistrations(),
      vehicle_bookings: await this.listBookings(),
      exported_for: 'family-travel-coordinator',
    };
  },

  // --- snapshot / restore / reset (data safety + UAT) ---

  /** Delete every registration and vehicle booking. Does NOT touch snapshots or system keys. */
  async wipeAll(): Promise<void> {
    const regKeys = await registrations().list();
    const vehKeys = await vehicles().list();
    await Promise.all([
      ...regKeys.map((k) => registrations().delete(k)),
      ...vehKeys.map((k) => vehicles().delete(k)),
    ]);
  },

  /** Replace all live data with the given dump (wipe, then write). */
  async importAll(dump: { registrations?: Registration[]; vehicle_bookings?: VehicleBooking[] }): Promise<void> {
    await this.wipeAll();
    await Promise.all([
      ...(dump.registrations ?? []).map((r) => this.putRegistration(r)),
      ...(dump.vehicle_bookings ?? []).map((b) => this.putBooking(b)),
    ]);
  },

  /** Save a named, point-in-time copy of all family data. Overwrites a snapshot of the same name. */
  async snapshot(name: string, now: string): Promise<Snapshot> {
    const data = {
      registrations: await this.listRegistrations(),
      vehicle_bookings: await this.listBookings(),
    };
    const snap: Snapshot = {
      name,
      created_at: now,
      counts: { registrations: data.registrations.length, vehicle_bookings: data.vehicle_bookings.length },
      data,
    };
    await snapshots().set(name, snap);
    return snap;
  },

  getSnapshot: (name: string) => snapshots().get<Snapshot>(name),

  /** List snapshot metadata (name/created_at/counts), without the heavy data payloads. */
  async listSnapshots(): Promise<Array<Omit<Snapshot, 'data'>>> {
    const keys = await snapshots().list();
    const snaps = await Promise.all(keys.map((k) => snapshots().get<Snapshot>(k)));
    return snaps
      .filter((s): s is Snapshot => s !== null)
      .map(({ name, created_at, counts }) => ({ name, created_at, counts }));
  },

  deleteSnapshot: (name: string) => snapshots().delete(name),

  /** Roll live data back to a saved snapshot. Throws if the snapshot is missing. */
  async restoreSnapshot(name: string): Promise<Snapshot['counts']> {
    const snap = await snapshots().get<Snapshot>(name);
    if (!snap) throw new Error(`Snapshot not found: ${name}`);
    await this.importAll(snap.data);
    return snap.counts;
  },
};
