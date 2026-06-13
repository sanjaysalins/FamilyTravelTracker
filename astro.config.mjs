// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import { loadEnv } from 'vite';

// Local dev/build: load .env into process.env so config.ts (which reads process.env) works.
// On Netlify there's no .env file (gitignored) and real env vars already win.
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
process.env = { ...fileEnv, ...process.env };

// Server-rendered app deployed to Netlify Functions. Data lives in Netlify Blobs.
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  srcDir: './src',
  // Astro's built-in checkOrigin (default-on) misfires behind Netlify's proxy and 403s every form
  // POST with "Cross-site POST form submissions are forbidden". We enforce our own double-submit CSRF
  // token on EVERY POST (src/lib/csrf.ts + admin-api.ts + each endpoint), so this is redundant.
  security: { checkOrigin: false },
});
