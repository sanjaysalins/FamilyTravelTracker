// TEMPORARY admin data endpoint — snapshot / restore / reset / seed for UAT + data safety.
// Guarded by the SESSION_SECRET token (header `x-admin-token` or ?token=). Destructive actions
// require `confirm: true`, and auto-save the current data to the `_autosave` snapshot first
// (one-step undo). This is a stopgap until the Phase 5 admin UI wraps store.ts behind real auth.
//
//   GET  ?action=export            -> full JSON dump (download / backup)
//   GET  ?action=list-snapshots    -> snapshot metadata
//   POST {action:'snapshot', name}                 -> save a named snapshot
//   POST {action:'restore', name, confirm:true}    -> roll back to a snapshot
//   POST {action:'seed', familyCount?, confirm:true} -> replace data with fake families
//   POST {action:'reset', confirm:true}            -> wipe all family data
//   POST {action:'import', dump, confirm:true}     -> replace data with an uploaded dump
//   POST {action:'delete-snapshot', name}          -> remove a snapshot
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { config } from '../../../lib/config';
import { generateSeed } from '../../../lib/seed';

export const prerender = false;

function authorized(request: Request, url: URL): boolean {
  const token = request.headers.get('x-admin-token') ?? url.searchParams.get('token');
  return !!config.sessionSecret && token === config.sessionSecret;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const now = () => new Date().toISOString();

export const GET: APIRoute = async ({ request, url }) => {
  if (!authorized(request, url)) return json({ error: 'forbidden' }, 403);
  const action = url.searchParams.get('action');
  switch (action) {
    case 'export':
      return json(await store.exportAll());
    case 'list-snapshots':
      return json({ snapshots: await store.listSnapshots() });
    default:
      return json({ error: 'unknown GET action', allowed: ['export', 'list-snapshots'] }, 400);
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!authorized(request, url)) return json({ error: 'forbidden' }, 403);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const { action } = body ?? {};
  const destructive = ['restore', 'seed', 'reset', 'import'];
  if (destructive.includes(action) && body.confirm !== true) {
    return json({ error: `'${action}' is destructive — pass { "confirm": true }` }, 400);
  }
  // one-step undo: stash current data before anything destructive
  if (destructive.includes(action)) {
    await store.snapshot('_autosave', now());
  }

  switch (action) {
    case 'snapshot': {
      if (!body.name) return json({ error: 'snapshot requires a name' }, 400);
      const snap = await store.snapshot(body.name, now());
      return json({ ok: true, saved: { name: snap.name, created_at: snap.created_at, counts: snap.counts } });
    }
    case 'restore': {
      if (!body.name) return json({ error: 'restore requires a name' }, 400);
      const counts = await store.restoreSnapshot(body.name);
      return json({ ok: true, restored: body.name, counts });
    }
    case 'seed': {
      const seed = generateSeed(body.familyCount);
      await store.importAll(seed);
      return json({ ok: true, seeded: { registrations: seed.registrations.length, vehicle_bookings: seed.vehicle_bookings.length } });
    }
    case 'reset': {
      await store.wipeAll();
      return json({ ok: true, reset: true });
    }
    case 'import': {
      if (!body.dump) return json({ error: 'import requires a dump' }, 400);
      await store.importAll(body.dump);
      return json({ ok: true, imported: { registrations: (body.dump.registrations ?? []).length, vehicle_bookings: (body.dump.vehicle_bookings ?? []).length } });
    }
    case 'delete-snapshot': {
      if (!body.name) return json({ error: 'delete-snapshot requires a name' }, 400);
      await store.deleteSnapshot(body.name);
      return json({ ok: true, deleted: body.name });
    }
    default:
      return json({ error: 'unknown POST action', allowed: ['snapshot', 'restore', 'seed', 'reset', 'import', 'delete-snapshot'] }, 400);
  }
};
