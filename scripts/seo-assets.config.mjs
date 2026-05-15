// Single source of truth for SEO asset generation. Static descriptors
// only - no logic. Consumed by scripts/gen-seo-assets.mjs.

/** Brand palette (mirrors the site tokens). */
export const COLORS = {
  lime: '#b8ff3a',
  canvas: '#0a0a0f',
  text: '#f5f5f0',
  muted: 'rgba(245,245,240,0.62)',
};

/**
 * Icon tiles. `maskable: true` reserves a safe zone (logo at 60% of the
 * tile) so Android/iOS can crop the full-bleed lime background.
 * Non-maskable icons render the logo larger (78%).
 */
export const ICONS = [
  { file: 'icons/favicon-16.png', size: 16, maskable: false },
  { file: 'icons/favicon-32.png', size: 32, maskable: false },
  { file: 'icons/apple-touch-icon.png', size: 180, maskable: false },
  { file: 'icons/icon-192.png', size: 192, maskable: true },
  { file: 'icons/icon-512.png', size: 512, maskable: true },
];

/** OG / social card. Copy mirrors src/lib/seo.ts (keep in sync by hand). */
export const OG = {
  png: 'og/default.png',
  webp: 'og/default.webp',
  width: 1200,
  height: 630,
  label: 'v9dev.in',
  name: 'JP Singh',
  role: 'Forward Deployed Engineer - Cloud + Full-stack',
  tagline:
    'I design cloud platforms, build full-stack products, and keep them alive in production. From a single VPS to multi-region Kubernetes. Available for work.',
  alt: 'JP Singh - v9dev - Forward Deployed Engineer',
};
