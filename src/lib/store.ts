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

/* ---- typed data access ---- */
const registrations = () => kv('registrations');
const vehicles = () => kv('vehicle_bookings');
const system = () => kv('system');

export const store = {
  // registrations
  getRegistration: (ref: string) => registrations().get<Registration>(ref),
  putRegistration: (doc: Registration) => registrations().set(doc.reference_number, doc),
  deleteRegistration: (ref: string) => registrations().delete(ref),
  async listRegistrations(): Promise<Registration[]> {
    const keys = await registrations().list();
    const docs = await Promise.all(keys.map((k) => registrations().get<Registration>(k)));
    return docs.filter((d): d is Registration => d !== null);
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
};
