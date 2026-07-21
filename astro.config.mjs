// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// No Cloudflare adapter on purpose: the site is fully static, and the
// adapter's _worker.js would make Pages ignore the functions/ directory
// (the contact API). Pages Functions are deployed from functions/ as-is.
export default defineConfig({
  site: 'https://v9dev.in',
  output: 'static',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  experimental: {
    clientPrerender: true,
  },
});
