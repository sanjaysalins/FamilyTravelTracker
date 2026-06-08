// TEMPORARY Phase 0.5 de-risk endpoint — proves a Netlify Blob survives a redeploy.
// Token-guarded with SESSION_SECRET so it isn't public. REMOVE after the test passes.
//
//   GET /api/blobtest?token=<SESSION_SECRET>&set=<value>   -> write, then read back
//   GET /api/blobtest?token=<SESSION_SECRET>               -> read the stored value
import type { APIRoute } from 'astro';
import { store } from '../../lib/store';
import { config } from '../../lib/config';

export const prerender = false;

const KEY = 'redeploy_test';
const VERSION = 'v2'; // bumped to force a new deploy; confirms we're reading from Deploy B

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!config.sessionSecret || token !== config.sessionSecret) {
    return new Response('forbidden', { status: 403 });
  }

  const set = url.searchParams.get('set');
  if (set !== null) {
    await store.putSystem(KEY, { value: set, written_at: new Date().toISOString() });
  }

  const stored = await store.getSystem<{ value: string; written_at: string }>(KEY);
  return new Response(JSON.stringify({ version: VERSION, key: KEY, stored }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
