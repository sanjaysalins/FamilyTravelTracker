// Integration tests for the fake-family seed (src/lib/seed.ts) and the snapshot/restore/reset
// primitives (src/lib/store.ts), against the local-file backend in an isolated temp cwd.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { store } from '../src/lib/store';
import { generateBookings, generateFamilies, generateSeed } from '../src/lib/seed';

let tmp: string;
const origCwd = process.cwd();
const NOW = '2026-06-08T12:00:00.000Z';

beforeAll(async () => {
  delete process.env.NETLIFY;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
  tmp = await mkdtemp(join(tmpdir(), 'ftt-seed-'));
  process.chdir(tmp);
});

afterAll(async () => {
  process.chdir(origCwd);
  await rm(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(join(tmp, '.data'), { recursive: true, force: true });
});

describe('seed generator', () => {
  it('produces the requested count with unique reference numbers', () => {
    const fams = generateFamilies(20);
    expect(fams).toHaveLength(20);
    const refs = new Set(fams.map((f) => f.reference_number));
    expect(refs.size).toBe(20);
    expect(fams[0].reference_number).toBe('BDAY-2026-0001');
  });

  it('keeps every family internally consistent (party_size, leg people, consent)', () => {
    for (const f of generateFamilies(16)) {
      expect(f.party_size).toBe(f.party_members.length);
      expect(f.party_size).toBeGreaterThanOrEqual(1);
      expect(f.consent_given).toBe(true);
      expect(f.legs.length).toBeGreaterThanOrEqual(1);
      for (const leg of f.legs) {
        expect(leg.people_on_this_leg).toBe(f.party_size);
      }
      // test data must be clearly fake
      expect(f.email).toContain('@familytraveltracker.test');
    }
  });

  it('is deterministic — same input gives identical output', () => {
    expect(generateFamilies(8)).toEqual(generateFamilies(8));
  });

  it('covers the varied scenarios the admin flows must handle', () => {
    const fams = generateFamilies();
    expect(fams.some((f) => f.home_country !== 'IN')).toBe(true);           // international
    expect(fams.some((f) => f.home_country === 'IN')).toBe(true);           // domestic
    expect(fams.some((f) => f.legs.some((l) => !l.transport_needed))).toBe(true); // own transport
    expect(fams.some((f) => f.legs.some((l) => l.date_tbc))).toBe(true);    // dates not booked
    expect(fams.some((f) => f.legs.length > 1)).toBe(true);                 // multi-leg
    expect(fams.some((f) => f.legs.some((l) => l.direction === 'internal'))).toBe(true); // side trip
    expect(fams.some((f) => f.party_members.some((m) => m.age_band === 'elderly'))).toBe(true);
  });

  it('generateSeed bundles families and bookings', () => {
    const seed = generateSeed(10);
    expect(seed.registrations).toHaveLength(10);
    expect(seed.vehicle_bookings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('snapshot / restore / reset', () => {
  it('snapshots current data and lists metadata without the heavy payload', async () => {
    await store.importAll(generateSeed(8));
    const snap = await store.snapshot('before-uat', NOW);
    expect(snap.counts.registrations).toBe(8);
    expect(snap.counts.vehicle_bookings).toBe(generateBookings().length);

    const list = await store.listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ name: 'before-uat', created_at: NOW, counts: snap.counts });
    expect((list[0] as any).data).toBeUndefined(); // metadata only
  });

  it('restores live data back to a snapshot after changes', async () => {
    // start with 8 real-ish families, snapshot them
    await store.importAll(generateSeed(8));
    await store.snapshot('safe', NOW);

    // corrupt / change: wipe and load different data
    await store.wipeAll();
    expect(await store.listRegistrations()).toHaveLength(0);
    await store.importAll({ registrations: generateFamilies(3), vehicle_bookings: [] });
    expect(await store.listRegistrations()).toHaveLength(3);

    // roll back
    const counts = await store.restoreSnapshot('safe');
    expect(counts.registrations).toBe(8);
    expect(await store.listRegistrations()).toHaveLength(8);
    expect(await store.listBookings()).toHaveLength(generateBookings().length);
  });

  it('wipeAll clears data but keeps snapshots intact', async () => {
    await store.importAll(generateSeed(5));
    await store.snapshot('keepme', NOW);
    await store.wipeAll();
    expect(await store.listRegistrations()).toHaveLength(0);
    expect(await store.listSnapshots()).toHaveLength(1); // snapshot survived the wipe
  });

  it('importAll replaces, not merges', async () => {
    await store.importAll({ registrations: generateFamilies(6), vehicle_bookings: [] });
    await store.importAll({ registrations: generateFamilies(2), vehicle_bookings: [] });
    expect(await store.listRegistrations()).toHaveLength(2); // not 8
  });

  it('restoreSnapshot throws on a missing snapshot', async () => {
    await expect(store.restoreSnapshot('nope')).rejects.toThrow(/Snapshot not found/);
  });
});
