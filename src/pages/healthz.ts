// GET /healthz — uptime/health probe for external monitors (Plan Phase 8). Confirms the app is up
// AND the Netlify Blobs data store is reachable + writable (a plain homepage ping wouldn't catch a
// broken store). Public, no auth, no PII. Point UptimeRobot / BetterUptime at this URL.
import type { APIRoute } from 'astro';
import { store } from '../lib/store';

export const prerender = false;

export const GET: APIRoute = async () => {
  const time = new Date().toISOString();
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  try {
    // Round-trip a tiny value through the store: proves Blobs is reachable AND writable.
    await store.putSystem('healthz', { at: time });
    const back = await store.getSystem<{ at: string }>('healthz');
    const ok = back?.at === time;
    return new Response(JSON.stringify({ ok, store: ok ? 'ok' : 'stale', time }), { status: ok ? 200 : 503, headers });
  } catch {
    return new Response(JSON.stringify({ ok: false, store: 'error', time }), { status: 503, headers });
  }
};
