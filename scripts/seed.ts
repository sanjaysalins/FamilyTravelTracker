// CLI: fill the data store with fake families + bookings for local UAT.
//   npm run seed          # default scenario set
//   npm run seed 20       # 20 families (scenarios cycle, refs stay unique)
//
// Uses the SAME store.ts data layer as the app: targets Netlify Blobs when the
// NETLIFY context is present, otherwise the local .data/ file store (npm run dev).
// Like the admin `seed` action, this REPLACES existing data (wipe, then write).

import { store } from '../src/lib/store';
import { generateSeed } from '../src/lib/seed';

const count = process.argv[2] ? Number(process.argv[2]) : undefined;
const seed = generateSeed(count);

await store.importAll(seed);

console.log(
  `Seeded ${seed.registrations.length} families + ${seed.vehicle_bookings.length} vehicle booking(s).`,
);
