# v9dev.in — Handoff

Single-page bold-maximalist portfolio for **JP Singh**. Astro 5 + React
islands + Tailwind 4, deploying to Cloudflare Pages with a Worker-backed
contact form.

## Run it

```bash
pnpm install
pnpm dev            # Astro + HMR on :4321  (primary review loop)
pnpm pages:dev      # Wrangler + Pages Functions on :8788 (contact API)
pnpm build          # only when needed — dev HMR is the review surface
pnpm test           # vitest (Worker libs)
pnpm lint           # biome
```

Full design + decisions: `docs/superpowers/specs/2026-05-14-v9dev-portfolio-design.md`.

## What's done

- **Toolchain**: Astro 5, React 19 islands, Tailwind 4 (CSS-first), Biome,
  Vitest, Playwright, Husky/lint-staged, Fontsource (Bricolage Grotesque /
  Geist / Geist Mono).
- **Sections** (single page, in order): Nav · Hero (kinetic type,
  stroke↔fill + 3D tilt, click-wave, rotating status) · Manifesto
  (scroll-scrubbed reveal) · Skill Constellation (scroll-drawn SVG path,
  36 nodes, chip rides the path, brand-color hover) · Services (sticky
  stack) · Work (horizontal scroll, 6 real projects, no fake live links) ·
  Notes (single creative line, no blog) · Contact (Worker form) · Footer
  (interactive V9DEV wordmark).
- **Mobile nav**: shadcn-style `Sheet` (Radix Dialog) in
  `src/components/ui/sheet.tsx` + `MobileMenu.tsx`. Portal-rendered,
  opaque panel, full a11y.
- **Contact Worker**: `functions/api/contact.ts` + `functions/_lib/*`
  (validate / turnstile / rate-limit / resend). Unit tests written.
- **Content** is data-driven: `src/content/skills.ts`,
  `services.ts`, `projects.ts`. Site/social copy in `src/lib/seo.ts`.
- **SEO basics**: `SeoHead.astro` (OG, Twitter, JSON-LD Person,
  theme-color), sitemap integration, `robots.txt`, web manifest,
  `public/_headers` cache rules.

## What's pending

1. **SEO/perf polish** — real OG image at `/public/og/default.png`,
   favicon set in `/public/icons/`, Lighthouse pass, reduced-motion +
   a11y sweep.
2. **CI + deploy** — GitHub Actions (typecheck/lint/test/build on PR),
   Cloudflare Pages project, env vars, custom domain. KV namespaces
   (`v9dev-CONTACT_MESSAGES`, `v9dev-RATE_LIMIT`) already exist and are
   wired in `wrangler.toml`. Steps documented in `README.md`.
3. **Email accounts** — create Resend account (verify v9dev.in, get
   `RESEND_API_KEY`) and enable Cloudflare Email Routing so
   `hello@v9dev.in` forwards to a real inbox. Decision: Resend sends,
   Email Routing receives - no send_email Worker (binding is
   Workers-only, can't email the form submitter).
4. **Content swaps JP still owns** — real project screenshots
   (`/public/work/*.svg` are placeholders), final social handles +
   email if different from `hello@v9dev.in`, real years if any need
   tweaking (all currently capped at 5).

## Conventions (please keep)

- **pnpm only**, never npm/yarn.
- Commits authored as `v9dev`; **no AI co-author trailers**.
- Don't run `pnpm build` every iteration — review via dev HMR; build
  only when explicitly needed or for deploy.
- Utility UI (mobile nav, modals, forms) = standard/boring patterns.
  Creativity lives in the showpiece sections only.
- Motion: restrained — stroke↔fill, variable-font axes, 3D tilt,
  animated underlines. No loud per-letter color rotation.
- All copy uses hyphens `-`, never em-dashes.

## Deploy quickstart (Cloudflare Pages)

1. Create Pages project from this repo. Build `pnpm build`, output `dist`,
   `NODE_VERSION=20`, `PNPM_VERSION=9`.
2. `pnpm exec wrangler kv namespace create CONTACT_MESSAGES` and
   `... RATE_LIMIT`; paste IDs into `wrangler.toml`.
3. Set env in Pages → Settings: `RESEND_API_KEY`,
   `TURNSTILE_SECRET_KEY`, `PUBLIC_TURNSTILE_SITE_KEY`, `IP_HASH_SALT`,
   `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`.
4. Add custom domain `v9dev.in` (DNS already on Cloudflare).
