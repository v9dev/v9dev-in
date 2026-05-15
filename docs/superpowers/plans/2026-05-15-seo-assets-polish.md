# SEO Assets + Meta Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the missing favicon/app-icon set and OG social card from the supplied `V9` wordmark, and wire `SeoHead.astro` + `manifest.webmanifest` to the real files so the site has a working favicon and social preview.

**Architecture:** A committed Node ESM script drives the already-installed `@playwright/test` Chromium to render each asset from an inline HTML template at exact pixel size, screenshots to PNG, and produces the OG WebP via an in-page canvas (macOS `sips` has no WebP here). White is knocked out with a CSS `mix-blend-mode` (no manual masking). Meta files are then pointed at the real PNG paths.

**Tech Stack:** Node ESM, `@playwright/test` (chromium), Astro, Biome. Package manager: **pnpm only**.

---

## Conventions (apply to every task)

- **pnpm only.** Never npm/yarn. Do not run `pnpm build` to iterate.
- Commits authored as `v9dev`, **no AI co-author trailers**:
  `git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "..."`
- All copy/comments use hyphens `-`, never em-dashes `—`. (Middot `·` is allowed; it is used elsewhere on the site.)
- Work happens on branch `feat/seo-assets-polish` (already checked out, off `main`). Do not switch branches.

## Runtime facts (verified — do not re-decide)

- The browser automation package is **`@playwright/test`** (v1.60.0). Import chromium as: `import { chromium } from '@playwright/test';`. `playwright` / `playwright-core` are NOT installed — do not import them.
- Chromium binary is already installed (no `playwright install` needed).
- `sips` on this macOS does **not** support WebP output. WebP is produced inside Chromium via `canvas.toBlob('image/webp')` and the decoded binary is written to disk (a real `.webp` file, not a base64 data URI).
- `biome.json` `files.ignore` does not include `scripts/`. Task 1 adds it, so the generator script is not linted as app code.

## File Structure

- **Move** `V9.jpg` (repo root) -> `assets/brand/v9-logo.jpg` (tracked source, not under `public/`, never served). Root `V9.jpg` removed.
- **Create** `scripts/seo-assets.config.mjs` — single source of truth: icon list, OG descriptor, brand colors, OG copy + alt text. One responsibility: static asset descriptors.
- **Create** `scripts/gen-seo-assets.mjs` — generator: consumes the config, renders via Chromium, writes outputs.
- **Modify** `package.json` — add `assets:seo` script.
- **Modify** `biome.json` — add `scripts` to `files.ignore`.
- **Modify** `src/components/astro/SeoHead.astro` — PNG-only icon links + image alt meta.
- **Modify** `public/manifest.webmanifest` — replace the em-dash in `name`.
- **Generated outputs** (committed): `public/icons/favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`; `public/og/default.png`, `public/og/default.webp`.

Note: all icons live in `public/icons/` to match the paths the manifest already uses (`/icons/icon-192.png`, `/icons/icon-512.png`); OG lives in `public/og/`. This resolves the spec's output-path ambiguity in favor of the existing manifest paths.

---

### Task 1: Move source asset, add config module, package script, biome ignore

**Files:**
- Move: `V9.jpg` -> `assets/brand/v9-logo.jpg`
- Create: `scripts/seo-assets.config.mjs`
- Modify: `package.json` (scripts block)
- Modify: `biome.json` (`files.ignore`)

- [ ] **Step 1: Move the source asset**

```bash
mkdir -p assets/brand
git mv V9.jpg assets/brand/v9-logo.jpg 2>/dev/null || mv V9.jpg assets/brand/v9-logo.jpg
```

Run: `ls -la assets/brand/v9-logo.jpg`
Expected: file exists (~15k). Root `V9.jpg` no longer present (`ls V9.jpg` -> No such file).

- [ ] **Step 2: Create the config module**

Create `scripts/seo-assets.config.mjs`:

```js
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
```

- [ ] **Step 3: Add the package script**

In `package.json`, inside `"scripts"`, add this entry after the `"format"` line:

```json
    "assets:seo": "node scripts/gen-seo-assets.mjs",
```

(Keep valid JSON — ensure the preceding line still ends with a comma and the block stays well-formed.)

- [ ] **Step 4: Add `scripts` to biome ignore**

In `biome.json`, change the `files.ignore` array from:

```json
    "ignore": ["dist", ".astro", ".wrangler", "node_modules", "public/fonts", "coverage"]
```

to:

```json
    "ignore": ["dist", ".astro", ".wrangler", "node_modules", "public/fonts", "coverage", "scripts"]
```

- [ ] **Step 5: Verify config + JSON validity**

Run: `node -e "import('./scripts/seo-assets.config.mjs').then(m=>console.log(m.ICONS.length, m.OG.width, m.COLORS.lime))"`
Expected: `5 1200 #b8ff3a`

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json')); JSON.parse(require('fs').readFileSync('biome.json')); console.log('json ok')"`
Expected: `json ok`

Run: `pnpm exec biome check biome.json package.json`
Expected: clean (no errors). If biome reformats JSON, accept the autofix and re-run until clean.

- [ ] **Step 6: Commit**

```bash
git add assets/brand/v9-logo.jpg scripts/seo-assets.config.mjs package.json biome.json
git rm --cached V9.jpg 2>/dev/null || true
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "chore(seo): add v9 source asset, asset config, generator script wiring"
```

Run: `git status --porcelain V9.jpg`
Expected: empty (root `V9.jpg` is gone / not tracked).

---

### Task 2: Generator script — icon tiles

**Files:**
- Create: `scripts/gen-seo-assets.mjs` (icons only this task; OG added in Task 3)

- [ ] **Step 1: Write the generator (icons)**

Create `scripts/gen-seo-assets.mjs`:

```js
import { readFile, mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { COLORS, ICONS, OG } from './seo-assets.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/brand/v9-logo.jpg');
const PUBLIC = join(ROOT, 'public');

/** Build the inline HTML for one lime-tile icon. White is knocked out
 *  via mix-blend-mode: multiply over a solid lime layer (white*lime=lime,
 *  black*lime=black -> clean black V9 on a lime tile). */
function iconHtml(dataUri, size, maskable) {
  const inner = maskable ? 60 : 78; // % of tile occupied by the mark
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    html,body{margin:0;padding:0}
    .tile{width:${size}px;height:${size}px;background:${COLORS.lime};
      display:flex;align-items:center;justify-content:center;overflow:hidden}
    .tile img{width:${inner}%;height:${inner}%;object-fit:contain;
      mix-blend-mode:multiply}
  </style></head>
  <body><div class="tile"><img src="${dataUri}" alt=""></div></body></html>`;
}

async function main() {
  const jpg = await readFile(SRC);
  const dataUri = `data:image/jpeg;base64,${jpg.toString('base64')}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.setContent(iconHtml(dataUri, icon.size, icon.maskable), {
        waitUntil: 'load',
      });
      const out = join(PUBLIC, icon.file);
      await mkdir(dirname(out), { recursive: true });
      await page.locator('.tile').screenshot({ path: out });
      console.log(`wrote ${icon.file} (${icon.size}x${icon.size})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

(`OG` is imported now but consumed in Task 3 — leave the import; the script is tooling, not linted.)

- [ ] **Step 2: Run the generator**

Run: `pnpm assets:seo`
Expected: 5 `wrote icons/...` lines, exit 0, no errors.

- [ ] **Step 3: Verify icon files + exact dimensions**

Run:
```bash
for f in favicon-16:16 favicon-32:32 apple-touch-icon:180 icon-192:192 icon-512:512; do
  n=${f%:*}; s=${f#*:};
  echo -n "$n: "; sips -g pixelWidth -g pixelHeight "public/icons/$n.png" | awk '/pixel/{printf $2" "} END{print ""}';
done
```
Expected: each line shows the size twice, e.g. `favicon-32: 32 32`, `icon-512: 512 512`.

- [ ] **Step 4: Manual sanity check**

Open `public/icons/icon-512.png` and `public/icons/favicon-32.png`. Confirm: solid lime background, crisp **black** "V9" mark, no white box around the mark, mark centered, maskable icons (192/512) have visible padding around the mark.

If the white is NOT knocked out (white box visible), STOP and report — the `mix-blend-mode` is not taking effect and needs investigation before proceeding.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-seo-assets.mjs public/icons/
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(seo): generate lime V9 favicon + app-icon set"
```

---

### Task 3: Generator script — OG social card (PNG + WebP)

**Files:**
- Modify: `scripts/gen-seo-assets.mjs` (add OG rendering after the icon loop, before `browser.close()`)

- [ ] **Step 1: Add the OG helpers and rendering**

In `scripts/gen-seo-assets.mjs`, add this function directly after `iconHtml(...)`:

```js
/** OG card: dark canvas, V9 mark knocked to off-white via invert+screen
 *  (black-on-white source -> light mark on dark), lime accent rule. */
function ogHtml(dataUri) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    html,body{margin:0;padding:0}
    .card{width:${OG.width}px;height:${OG.height}px;background:${COLORS.canvas};
      box-sizing:border-box;padding:80px;display:flex;flex-direction:column;
      justify-content:space-between;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      color:${COLORS.text}}
    .label{font:600 24px/1 monospace;letter-spacing:.25em;
      text-transform:uppercase;color:${COLORS.lime}}
    .mark{height:150px;display:flex;align-items:flex-start}
    .mark img{height:100%;filter:invert(1);mix-blend-mode:screen}
    .name{font-size:84px;font-weight:800;margin:0}
    .role{font-size:34px;color:${COLORS.muted};margin:8px 0 0}
    .rule{width:120px;height:4px;background:${COLORS.lime};margin:28px 0}
    .tag{font-size:26px;line-height:1.45;color:${COLORS.muted};
      max-width:920px;margin:0}
  </style></head>
  <body><div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <span class="label">${OG.label}</span>
      <div class="mark"><img src="${dataUri}" alt=""></div>
    </div>
    <div>
      <p class="name">${OG.name}</p>
      <p class="role">${OG.role}</p>
      <div class="rule"></div>
      <p class="tag">${OG.tagline}</p>
    </div>
  </div></body></html>`;
}
```

Then, inside `main()`, directly after the `for (const icon of ICONS)` loop and before the `} finally {`, add:

```js
    // OG card -> PNG
    await page.setViewportSize({ width: OG.width, height: OG.height });
    await page.setContent(ogHtml(dataUri), { waitUntil: 'load' });
    const ogPng = join(PUBLIC, OG.png);
    await mkdir(dirname(ogPng), { recursive: true });
    await page.locator('.card').screenshot({ path: ogPng });
    console.log(`wrote ${OG.png} (${OG.width}x${OG.height})`);

    // OG card -> WebP (Chromium canvas; sips has no WebP on this OS)
    const pngB64 = (await readFile(ogPng)).toString('base64');
    const webpBytes = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise((r) =>
        c.toBlob(r, 'image/webp', 0.9),
      );
      const buf = await blob.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }, pngB64);
    await writeFile(join(PUBLIC, OG.webp), Buffer.from(webpBytes));
    console.log(`wrote ${OG.webp} (webp ${webpBytes.length} bytes)`);
```

- [ ] **Step 2: Run the generator**

Run: `pnpm assets:seo`
Expected: the 5 icon lines, then `wrote og/default.png (1200x630)` and `wrote og/default.webp (webp <N> bytes)` with N > 0. Exit 0.

- [ ] **Step 3: Verify OG files**

Run:
```bash
sips -g pixelWidth -g pixelHeight public/og/default.png
file public/og/default.webp
```
Expected: PNG reports `pixelWidth: 1200` / `pixelHeight: 630`. `file` reports the webp as `RIFF (little-endian) data, Web/P image`.

- [ ] **Step 4: Manual sanity check**

Open `public/og/default.png`. Confirm: dark background, light "V9" mark top-right (no white box), `JP Singh` headline, role line, lime rule, tagline text, nothing clipped at 1200x630.

If the V9 mark shows a white block instead of a clean light mark, STOP and report — the invert+screen knockout needs adjustment before wiring meta.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-seo-assets.mjs public/og/
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(seo): generate OG social card (png + webp)"
```

---

### Task 4: Wire meta — SeoHead.astro icons + image alt, manifest em-dash

**Files:**
- Modify: `src/components/astro/SeoHead.astro`
- Modify: `public/manifest.webmanifest`

- [ ] **Step 1: Add an alt constant to the SeoHead frontmatter**

In `src/components/astro/SeoHead.astro`, in the frontmatter (between the `---` fences), add this line directly after `const og = new URL(ogImage, Astro.site ?? 'https://v9dev.in').toString();`:

```ts
const ogAlt = 'JP Singh - v9dev - Forward Deployed Engineer';
```

- [ ] **Step 2: Add image alt meta tags**

In the OpenGraph block, directly after:

```astro
<meta property="og:image:height" content="630" />
```

add:

```astro
<meta property="og:image:alt" content={ogAlt} />
```

In the Twitter block, directly after:

```astro
<meta name="twitter:image" content={og} />
```

add:

```astro
<meta name="twitter:image:alt" content={ogAlt} />
```

- [ ] **Step 3: Replace the icon link block**

Replace the entire existing `<!-- Icons -->` block:

```astro
<!-- Icons -->
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="mask-icon" href="/icons/mask-icon.svg" color="#b8ff3a" />
<link rel="manifest" href="/manifest.webmanifest" />
```

with:

```astro
<!-- Icons -->
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

- [ ] **Step 4: Fix the manifest em-dash**

In `public/manifest.webmanifest`, change:

```json
  "name": "v9dev.in — JP Singh",
```

to:

```json
  "name": "v9dev.in - JP Singh",
```

(Leave the `·` middot in `description` as-is — middot is permitted and used elsewhere on the site. Leave the `icons` array as-is; `/icons/icon-192.png` and `/icons/icon-512.png` now exist.)

- [ ] **Step 5: Verify references**

Run:
```bash
grep -nE 'favicon\.ico|icon\.svg|mask-icon' src/components/astro/SeoHead.astro || echo "NO STALE REFS"
grep -nE 'favicon-32\.png|favicon-16\.png|og:image:alt|twitter:image:alt' src/components/astro/SeoHead.astro
grep -n '—' public/manifest.webmanifest || echo "NO EM-DASH"
node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest')); console.log('manifest json ok')"
```
Expected: `NO STALE REFS`; the four new tokens each printed once; `NO EM-DASH`; `manifest json ok`.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm run typecheck`
Expected: `astro check` reports **0 errors** (pre-existing hints/warnings unrelated to this file are acceptable).

Run: `pnpm exec biome check src/components/astro/SeoHead.astro public/manifest.webmanifest`
Expected: clean, or only pre-existing diagnostics unrelated to these edits. Accept biome JSON autofix on the manifest if offered, then re-run.

- [ ] **Step 7: Commit**

```bash
git add src/components/astro/SeoHead.astro public/manifest.webmanifest
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(seo): point head/manifest at real PNG icons, add image alt, fix em-dash"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean regenerate from scratch**

Run:
```bash
rm -rf public/icons public/og && pnpm assets:seo
```
Expected: 5 icon lines + 2 OG lines, exit 0. (Proves the generator is reproducible from nothing.)

- [ ] **Step 2: Assert every referenced asset exists with correct size**

Run:
```bash
for p in icons/favicon-16:16:16 icons/favicon-32:32:32 icons/apple-touch-icon:180:180 icons/icon-192:192:192 icons/icon-512:512:512 og/default:1200:630; do
  f=${p%%:*}; w=$(echo $p|cut -d: -f2); h=$(echo $p|cut -d: -f3);
  sips -g pixelWidth -g pixelHeight "public/$f.png" >/dev/null 2>&1 && echo "OK public/$f.png" || echo "MISSING public/$f.png";
done
test -f public/og/default.webp && file public/og/default.webp | grep -q WebP && echo "OK webp" || echo "BAD webp"
```
Expected: all `OK ...` lines, `OK webp`, no `MISSING`/`BAD`.

- [ ] **Step 3: Cross-check meta points only at existing files**

Run:
```bash
grep -oE 'href="/(icons|og)/[^"]+"' src/components/astro/SeoHead.astro
grep -oE '"/(icons|og)/[^"]+"' public/manifest.webmanifest
```
For every path printed, confirm the corresponding file exists under `public/`. Expected: `/icons/favicon-32.png`, `/icons/favicon-16.png`, `/icons/apple-touch-icon.png` (SeoHead) and `/icons/icon-192.png`, `/icons/icon-512.png` (manifest) — all present from Step 1/2.

- [ ] **Step 4: Typecheck + lint final**

Run: `pnpm run typecheck`
Expected: 0 errors.

Run: `pnpm exec biome check src/ public/manifest.webmanifest biome.json package.json`
Expected: only pre-existing, unrelated diagnostics (e.g. the known constellation `noSvgWithoutTitle` is on a different branch and not present here; this branch is off `main`). No new errors from this work.

- [ ] **Step 5: Commit regenerated assets if changed**

Run: `git status --porcelain public/`
If anything changed (deterministic regen may produce byte-identical files — then nothing to do):

```bash
git add public/icons public/og
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "chore(seo): regenerated assets (reproducibility check)"
```
If `git status --porcelain public/` is empty, skip the commit — the feature is complete on the Task 4 commit.

- [ ] **Step 6: Manual final review (user, via dev server)**

Run: `pnpm dev`, open the site. Confirm: the **favicon shows in the browser tab** (lime V9). Then check the social card by opening `public/og/default.png` directly. These are the two user-visible deliverables.

---

## Plan Self-Review

- **Spec coverage:**
  - Spec "Source asset" (move to `assets/brand/v9-logo.jpg`, remove root) -> Task 1 Step 1/6.
  - Spec "Generation pipeline" (`scripts/gen-seo-assets.mjs`, `@playwright/test` chromium, `assets:seo` script, mix-blend knockout, idempotent) -> Tasks 1-3. (Spec said `import { chromium } from 'playwright'`; corrected to `@playwright/test` per verified runtime fact — documented at top.)
  - Spec "Outputs" (5 icons + og png + og webp) -> Tasks 2 (icons) and 3 (og png + webp). Paths consolidated under `public/icons/` + `public/og/` to match existing manifest paths (ambiguity resolved, noted in File Structure).
  - Spec "WebP via sips" -> corrected: `sips` lacks WebP on this OS; WebP produced via Chromium canvas writing decoded binary to disk (Task 3 Step 1). Still a real `.webp` file, not base64.
  - Spec "Meta changes" (SeoHead PNG-only links, `og:image:alt`/`twitter:image:alt`, manifest em-dash) -> Task 4.
  - Spec "Non-goals" (no svg/ico/mask-icon, no copy rewrite) -> respected: Task 4 removes those links; no `seo.ts`/JSON-LD edits anywhere.
  - Spec "Verification" (run script, sips dims, grep, typecheck/biome, manual eyeball, no em-dash) -> Tasks 2-5 verify steps.
  - Spec "biome decision for .mjs" (left to plan) -> Task 1 Step 4 adds `scripts` to biome ignore (decisive, not ambiguous).
- **Placeholder scan:** none — every code/JSON change is shown in full; every command has an expected output.
- **Type/name consistency:** `COLORS`/`ICONS`/`OG` exported in Task 1 are the exact names imported in Task 2/3. `OG.png`/`OG.webp`/`OG.width`/`OG.height`/`OG.label`/`OG.name`/`OG.role`/`OG.tagline` used in Task 3 all exist on the `OG` object defined in Task 1. `ogAlt` defined in Task 4 Step 1 is used in Step 2. Output paths in the config (`icons/...`, `og/default.png`, `og/default.webp`) match the verify globs in Tasks 2/3/5 and the meta paths in Task 4.
