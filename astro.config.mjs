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
});
