// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// Server-rendered app deployed to Netlify Functions. Data lives in Netlify Blobs.
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  srcDir: './src',
});
