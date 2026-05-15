# SEO Assets + Meta Polish — Design

Generate the missing SEO binary assets (favicon set, app icons, OG/social
card) from the supplied `V9` wordmark, and align `SeoHead.astro` +
`manifest.webmanifest` to the real files. Closes pending item #2 in
HANDOFF.md ("real OG image, favicon set"). The meta layer itself
(OpenGraph/Twitter/JSON-LD/canonical/sitemap/robots) already exists and
is correct - this work supplies what those tags point to and fixes a few
gaps. No new dependencies. Outputs are real `.png`/`.webp` files in
`public/` (never base64 / data URIs).

## Source asset

- User-supplied `V9.jpg` (~500x500, solid black "V9" wordmark on a white
  background, raster JPG, no transparency).
- It will be moved into the repo as a tracked, non-served source:
  `assets/brand/v9-logo.jpg` (the root `V9.jpg` is removed). `assets/`
  is not under `public/`, so it is never shipped.

## Goals

- Every asset referenced by `SeoHead.astro` and `manifest.webmanifest`
  exists at the referenced path; no broken icon/OG references.
- Favicon and app icons are on-brand: solid lime `#b8ff3a` tile with the
  black V9 mark (chosen treatment), maskable-safe for 192/512.
- A real 1200x630 OG/social card (`png` + `webp`) on the dark brand
  canvas with the V9 mark + name/title/tagline.
- Asset generation is a committed, repeatable script - regenerable if
  the logo or copy changes.

## Non-goals

- No vector assets (`icon.svg`, `mask-icon.svg`): the source is raster
  JPG and no SVG tracer / ImageMagick is available. The SVG/mask-icon
  `<link>`s are removed in favor of universally-supported PNG favicons.
- No `.ico`: no ICO encoder available locally; PNG favicons (16/32) plus
  apple-touch + manifest icons fully cover modern + legacy browsers. The
  `favicon.ico` `<link>` is removed.
- No copy rewrite of the (already good) `seo.ts` title/description or the
  JSON-LD Person schema. Only additive/fix meta changes below.
- No Lighthouse automation or broader a11y sweep (separate HANDOFF item).

## Generation pipeline

A single Node ESM script `scripts/gen-seo-assets.mjs`, run via a new
`package.json` script `assets:seo` (`node scripts/gen-seo-assets.mjs`),
using the **already-installed Playwright** (`playwright` is a devDep) to
drive headless Chromium:

1. For each target, build an inline HTML document sized to the exact
   output pixel dimensions and `page.setViewportSize` to match.
2. Render the V9 source with the white knocked out and recolored using a
   deterministic CSS blend - **no manual masking**:
   - Icon tiles: a full-bleed lime `#b8ff3a` layer, with the logo
     `<img>` over it using `mix-blend-mode: multiply`. Multiply maps
     white->lime (white * lime = lime) and black->black, yielding a
     clean lime tile with a crisp black V9.
   - OG card: dark `#0a0a0f` canvas; the V9 rendered in lime via an
     inverted/`screen` blend (black-on-white source -> lime mark on
     dark) so the mark reads on the dark card.
3. `page.screenshot({ type: 'png', omitBackground: false })` clipped to
   the exact box -> write the `.png` to `public/`.
4. WebP variants (OG only) via macOS `sips -s format webp` on the
   produced PNG.
5. The script is idempotent: re-running overwrites the outputs
   deterministically.

The HTML templates live inline in the script (small, single-purpose) -
not shipped to the site.

## Outputs (all into `public/`)

Icons (lime `#b8ff3a` tile, black V9, transparent only where noted):

| File | Size | Notes |
|---|---|---|
| `favicon-16.png` | 16x16 | tab favicon |
| `favicon-32.png` | 32x32 | tab favicon |
| `apple-touch-icon.png` | 180x180 | iOS home screen, ~12% padding |
| `icon-192.png` | 192x192 | manifest, maskable safe zone (~20% padding) |
| `icon-512.png` | 512x512 | manifest, maskable safe zone (~20% padding) |

Social card:

| File | Size | Notes |
|---|---|---|
| `og/default.png` | 1200x630 | dark canvas, lime V9 mark, name + title + tagline |
| `og/default.webp` | 1200x630 | `sips` WebP of the PNG |

OG card content (from `src/lib/seo.ts`, no new copy invented):
- Mark: V9 (lime).
- Line 1: `JP Singh` (off-white `#f5f5f0`, bold).
- Line 2: `Forward Deployed Engineer - Cloud + Full-stack` (muted).
- Line 3: tagline from `SITE.description`, lime accent rule.
- All copy uses hyphens, never em-dashes.

## Meta changes

`src/components/astro/SeoHead.astro` - replace the `<!-- Icons -->`
block with PNG-only references and add OG/Twitter image alt:

- Remove: `favicon.ico`, `icons/icon.svg`, `icons/mask-icon.svg` links.
- Add: `rel="icon"` PNG links for 16 and 32; `apple-touch-icon` ->
  `/apple-touch-icon.png`; keep `manifest` link.
- Add `<meta property="og:image:alt" content={...} />` and
  `<meta name="twitter:image:alt" content={...} />` using a static
  descriptive string (e.g. `JP Singh - v9dev - Forward Deployed
  Engineer`).
- `og:image`/`twitter:image` already resolve to `/og/default.png`
  (default prop) - unchanged; the file now exists.

`public/manifest.webmanifest`:
- Replace the em-dash in `name` (`v9dev.in — JP Singh`) with a hyphen:
  `v9dev.in - JP Singh` (project convention: hyphens only).
- Keep the `icon-192.png` / `icon-512.png` entries (now real files);
  `purpose: "any maskable"` retained (generator pads for safe zone).

`public/robots.txt`: unchanged (already correct, sitemap present).

## Verification

- `pnpm assets:seo` exits 0; all 7 files exist in `public/`
  (+ `og/default.webp`).
- `sips -g pixelWidth -g pixelHeight <file>` confirms exact dimensions
  for every output.
- `git grep` / build of the head shows no reference to removed assets
  (`favicon.ico`, `icon.svg`, `mask-icon.svg`) and the new PNG links
  present.
- `pnpm run typecheck` (astro check) - 0 errors. `pnpm exec biome check`
  clean on changed source files (the `.mjs` script either passes biome
  or is added to biome ignore if its style conflicts - decided in the
  plan, not left ambiguous).
- Manual: open `public/og/default.png` and each icon, eyeball the V9
  mark renders correctly (white fully knocked out, crisp edges).
- `manifest.webmanifest` contains no `—` (em-dash) anywhere.

## Conventions

- pnpm only; review via dev HMR; do not run `pnpm build` per iteration.
- All copy/comments use hyphens, never em-dashes.
- Commits authored as `v9dev`, no AI co-author trailers.
- This work is on its own branch `feat/seo-assets-polish` (off `main`),
  independent of the in-flight constellation PR.
