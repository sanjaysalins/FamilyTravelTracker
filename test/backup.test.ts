// Phase 7 — backup is RESTORE-TESTED (export -> wipe -> import round-trips and a known family opens),
// the raw edit token never appears in an export, and delete-all leaves no operational PII (IPs).
// Runs against the local-file store in an isolated temp cwd (same pattern as seed-snapshot.test).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { store } from '../src/lib/store';
import { purgeOperationalPII } from '../src/lib/privacy';
import { generateFamilies, generateBookings } from '../src/lib/seed';
import { buildRegistration, type BuildInput } from '../src/lib/registration-form';
import { hashToken } from '../src/lib/tokens';

let tmp: string;
const origCwd = process.cwd();

beforeAll(async () => {
  delete process.env.NETLIFY;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
  tmp = await mkdtemp(join(tmpdir(), 'ftt-backup-'));
  process.chdir(tmp);
});
afterAll(async () => { process.chdir(origCwd); await rm(tmp, { recursive: true, force: true }); });
beforeEach(async () => { await rm(join(tmp, '.data'), { recursive: true, force: true }); });

describe('export -> wipe -> import (restore-tested backup, PRD §17)', () => {
  it('restores the exact counts and a known family opens after a full wipe', async () => {
    const families = generateFamilies(6);
    await store.importAll({ registrations: families, vehicle_bookings: generateBookings(families) });

    const backup = await store.exportAll();          // "Export all" JSON
    const knownRef = backup.registrations[2].reference_number;
    const knownEmail = backup.registrations[2].email;

    await store.wipeAll();                            // simulate disaster / fresh deploy
    expect(await store.listRegistrations()).toHaveLength(0);

    await store.importAll(backup);                   // restore from the backup file

    const after = await store.exportAll();
    expect(after.registrations).toHaveLength(backup.registrations.length);
    expect(after.vehicle_bookings).toHaveLength(backup.vehicle_bookings.length);
    const reopened = await store.getRegistration(knownRef);
    expect(reopened).not.toBeNull();
    expect(reopened!.email).toBe(knownEmail);
  });

  it('the raw edit token NEVER appears in an export — only its hash is stored', async () => {
    const RAW = 'SUPER-SECRET-RAW-TOKEN-xyz';
    const res = buildRegistration({
      fields: {
        first: 'A', surname: 'B', email: 'a@b.c', phone: '98765 43210', phone_region: 'IN',
        wa_same: 'on', home_country: 'India', party_size: '1', consent: 'on',
        arr_from: 'Hyderabad', arr_to: 'Bidar', arr_date: '2026-10-16', arr_mode: 'flight', arr_ref: '6E1', arr_transport: 'yes',
        dep_from: 'Bidar', dep_to: 'Hyderabad', dep_date: '2026-10-19', dep_mode: 'flight', dep_ref: '6E2', dep_transport: 'yes',
      },
      reference: 'BDAY-2026-0001', rawToken: RAW, now: '2026-06-12T10:00:00Z', expiresAt: null,
    } as BuildInput);
    if (!res.ok) throw new Error('build failed');
    await store.putRegistration(res.doc);

    const json = JSON.stringify(await store.exportAll());
    expect(json).not.toContain(RAW);                 // raw token never persisted/exported
    expect(json).toContain(hashToken(RAW));          // only the sha256 hash is stored
  });

  it('purgeOperationalPII clears the login-attempt IP records', async () => {
    await store.putSystem('login_attempts', { '203.0.113.7': { count: 3, resetAt: 1 } });
    await purgeOperationalPII();
    expect(await store.getSystem('login_attempts')).toEqual({});
  });
});
