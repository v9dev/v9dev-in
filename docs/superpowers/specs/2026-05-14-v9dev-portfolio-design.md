# v9dev.in — Portfolio Site Design Spec

**Author:** JP Singh
**Date:** 2026-05-14
**Status:** Approved, ready for implementation planning
**Domain:** v9dev.in

## 1. Goal & positioning

A single-page portfolio for **JP Singh**, a Forward Deployed Engineer working across cloud infrastructure, DevOps, and full-stack product. The site has two jobs:

1. **Convert** — when a prospective client or employer lands on the page, they leave convinced JP can ship cloud + product end to end, and they reach out.
2. **Showcase craft** — the site itself is a portfolio piece. Visual and interaction quality is non-negotiable; "best portfolio I've seen" is the target, not "professional".

Aesthetic direction: **Bold Maximalist** — strong color, heavy motion, a hero centerpiece that's the first thing people remember, alive everywhere.

## 2. Scope

**In scope (v1):**
- Single-page scrolling site with 7 acts (Nav, Hero, Manifesto, Skill Constellation, Services, Work, Contact, Footer).
- Kinetic typography hero.
- Skill section as an animated SVG path-draw constellation.
- Worker-backed contact form with Turnstile + Resend + KV backup.
- Full responsive support (desktop, tablet, mobile).
- Reduced-motion fallback that keeps the site fully usable.
- SEO, sitemap, OG image, JSON-LD Person schema.
- Cloudflare Pages deployment with Pages Functions.

**Out of scope (v1):**
- Blog / MDX content.
- Dedicated `/work/<slug>` case study pages (case studies live in cards on the homepage).
- Internationalization.
- CMS — content lives in TypeScript files.
- Light mode (site is dark by design).
- Calendly / Cal.com inline embed (`Book a call` opens mailto for v1).
- Authenticated areas of any kind.

## 3. Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 5** + `@astrojs/react` + `@astrojs/cloudflare` | Static-first, island architecture, smallest JS payload, native Cloudflare adapter, best SEO. |
| UI runtime (islands only) | **React 19** | Needed for interactive/animated components. |
| Styling | **Tailwind 4** (CSS-first via `@tailwindcss/vite`) | Tokens in CSS via `@theme`, no JS config. |
| Component motion | **Motion (Framer Motion v11)** | Enter/exit, hover, layout, AnimatePresence. |
| Scroll-linked motion | **GSAP** + `ScrollTrigger` + `MotionPathPlugin` | Path-draw, pin-and-scrub, motion-along-path. |
| Smooth scroll | **Lenis** + `@studio-freight/hamo` | Smooth scroll + utility hooks. |
| Edge backend | **Cloudflare Pages Functions** (`functions/api/contact.ts`) | Same repo, same deploy, edge-local. |
| Email | **Resend** HTTPS API | Simple, reliable, free tier covers expected volume. |
| Spam protection | **Cloudflare Turnstile** | Free, no captcha UX hit. |
| Storage | **Cloudflare KV** (2 namespaces: messages, rate-limit) | Cheap, edge-local, sufficient for write rate. |
| Package manager | **pnpm** | User preference. |
| Lint + format | **Biome** | Single tool, fast. |
| Type checking | **TypeScript strict** | |
| Pre-commit | **Husky + lint-staged** (typecheck + lint) | |
| Analytics | **Cloudflare Web Analytics** | Free, privacy-friendly, no cookie banner. |
| CI | **GitHub Actions** (typecheck + lint + build on PR) + Cloudflare Pages auto-deploy on `main`. | |

## 4. Page architecture — the scroll journey

Seven acts, top to bottom:

### 00. Nav (sticky)
Floating glass pill, top-center, magnetic links. Contents: section anchors (Work, Stack, Services, Contact), "Book a call" CTA. A persistent scroll progress bar sits flush under the nav. A small `03 / 07` section counter tracks position in the corner.

### 01. Hero
- Display: kinetic `JP SINGH` filling the viewport. Variable-font weight + width axes are scroll-linked; letters distort on cursor proximity.
- Subtitle types out: `Forward Deployed Engineer — I ship cloud infra that doesn't fall over, and the products that run on top.`
- Two CTAs: `See work ↓` · `Book a call →`
- Scroll indicator at the bottom.

### 02. Manifesto
One oversized paragraph (~60 words), word-by-word scroll reveal, highlighted phrases pop in accent color:

> I design cloud platforms, build full-stack products, and keep them running in production. From a single VPS to multi-region Kubernetes. From a quick Next.js MVP to a hardened, observed, automated stack. Boring infra. Beautiful interfaces. Real outcomes. If you can describe it, I can ship it.

### 03. Skill Constellation
A single SVG path snakes vertically down the section, branching into clusters: Frontend → Backend → Cloud → DevOps → Databases → Languages. The path **draws itself** as the user scrolls into the section (`stroke-dasharray` + `stroke-dashoffset` driven by ScrollTrigger). Tool logos sit as **waypoints** on the path; each pops in with a spring scale + glow pulse the moment the drawing pen reaches it. Connector lines retain a subtle traveling-dot effect after drawing (looks like packets flowing).

- Hover a node: it lifts, casts a colored shadow matching the tool's brand color, shows a tooltip with role and years. Connected lines pulse brighter.
- Mobile: tighter zig-zag path, larger touch targets, same draw-on-scroll.
- Source of truth: `src/content/skills.ts` (30+ entries). Adding a tool is a 1-line change.

### 04. Services (What I do)
Four cards in a sticky-scroll stack. Each card pins as the user scrolls past, reveals deliverables, then unpins as the next card pins in.

1. **Cloud Architecture** — AWS · GCP · Azure · DigitalOcean · Hetzner. Designs that scale and stay cheap.
2. **Self-hosted Platforms** — Coolify, Dokploy, Portainer, Homarr, Uptime Kuma, Grafana. Your own PaaS on your hardware.
3. **Full-stack Builds** — Next.js · React · Node · Bun · Python. From idea to live URL.
4. **DevOps & Automation** — Terraform, Docker, Kubernetes, GitHub Actions. CI/CD that just works.

### 05. Work
Horizontal-scroll carousel inside a sticky section: scrolling down the page translates the carousel to the right. Four placeholder case-study cards with big screenshots, stack chips, outcome metric, and live/repo links. Cards swap content later by editing `src/content/projects.ts`.

Placeholder seed:
1. **Multi-region SaaS platform on Kubernetes** — *99.98% uptime, sub-200ms p95 globally.*
2. **Self-hosted lab** — *12 services, one dashboard, zero cloud bill.*
3. **Real-time analytics pipeline** — *Bun + Postgres + ClickHouse, 10k events/s.*
4. **Internal developer portal** — *⌘K to deploy, rollback, tail logs.*

### 06. Contact
Split layout. **Left:** "Let's build something that lasts." + sub "Reply within 24h, anywhere on Earth." + your email + socials. **Right:** form (name, email, message, Turnstile widget, `Send →`). Button morphs into `Sent ✓` on success; contextual error messages on failure (rate limited / spam check failed / send failed).

### 07. Footer
Giant outlined `V9DEV` lockup spanning full viewport width. Microcopy: `Designed and built by JP Singh · Deployed on Cloudflare · 2026 →`. Socials: GitHub, LinkedIn, X, Email. Back-to-top.

### Mobile adaptation
- Nav becomes a bottom dock.
- All horizontal scrolls become vertical stacks.
- Marquees stay but slow down.
- Constellation path is tighter zig-zag; same draw-on-scroll behavior.
- Custom cursor is disabled; magnetic effect still applies to buttons (button moves toward touch on press).

## 5. Motion + visual language

### Color system
```
Base
  #0A0A0F  bg-canvas        near-black, warm undertone
  #14141C  bg-elevated      cards, nav pill, form
  #F5F5F0  text-primary     warm off-white
  #8B8B95  text-muted

Section-rotating accents
  #B8FF3A  lime             Hero, Stack, Contact CTA       (energy)
  #FF3A8C  fuchsia          Manifesto, Work hovers          (impact)
  #3AE0FF  cyan             Services, terminal moments     (cool/technical)
```

A `~3%` opacity grain overlay sits over the whole page. Soft-light gradient blobs drift slowly behind content; the active section's dominant accent bleeds through.

### Typography
- **Display** (hero, section titles) — **Bricolage Grotesque** (variable width + weight, free, Google Fonts → self-hosted).
- **Body / UI** — **Geist** (Vercel, free, variable).
- **Mono** (code, terminal, metrics) — **Geist Mono**.
- Self-hosted from `/public/fonts` as `.woff2`. `font-display: swap` + `size-adjust` to prevent CLS. Hero display face is `<link rel="preload">`-ed.

### Motion stack & roles
- **Motion (Framer Motion v11)** — component-level enter/exit, hover, tap, layout, `AnimatePresence`.
- **GSAP + ScrollTrigger** — scroll-linked timelines, path-draw, pin-and-scrub (Services stack, Work carousel).
- **GSAP MotionPathPlugin** — motion along path.
- **Lenis** — site-wide smooth scroll, wheel/touch normalization.
- **@studio-freight/hamo** — `useRect`, `useMediaQuery` etc., keeps Lenis & GSAP in sync.

### Easing & timing (shared)
- **Entry reveals** — `cubic-bezier(0.2, 0.8, 0.2, 1)`, 600–900ms.
- **State changes** — `cubic-bezier(0.65, 0, 0.35, 1)`, 350ms.
- **Hover/tap** — spring `{ stiffness: 400, damping: 30 }`.
- **Scroll-linked** — linear (driven by progress).
- **Stagger** — `0.06s` between siblings.

All easings, springs, and shared variants live in `src/lib/motion.ts`.

### Custom cursor
Single `<CustomCursor />` React island, GPU-transformed div + sibling label div.
- **Default** — 8px dot, `mix-blend-mode: difference`.
- **Over text** — vertical bar (caret).
- **Over link/button** — 40px pill with label (`"open ↗"`, `"send"`, `"drag"`).
- **Magnetic** — buttons pull cursor toward their center within a ~60px radius.
- **Over Work carousel** — horizontal drag indicator (`← drag →`).
- **Touch devices** — disabled; magnetic effect still applies to buttons.
- Native cursor `none` only when `(pointer: fine)`.

### Ambient motion (the "alive everywhere" mandate)
Every section runs ≥ 3 of:
1. Drifting gradient blobs behind content (CSS-only, 30s loops).
2. Word-by-word scroll-reveal on every paragraph > 1 line.
3. Magnetic CTAs site-wide.
4. Variable-font weight oscillation on section headings (±50 weight, 6s loop).
5. Counter animations for numbers (count up on enter view).
6. Image/screenshot reveals via animated `clip-path`.
7. Idle pulse on primary CTAs every ~7s after inactivity.

### Reduced motion
`@media (prefers-reduced-motion: reduce)`:
- All scroll-linked + ambient motion disabled.
- Entry animations collapse to 200ms opacity fade.
- Lenis disabled, native scroll restored.
- Custom cursor falls back to native.
- Site remains fully functional and visually intact.

## 6. Technical architecture

### Repository layout
```
v9dev-in/
├── public/
│   ├── fonts/                  # self-hosted .woff2
│   ├── og/                     # OG image(s) — 1200x630
│   └── icons/                  # favicons
├── src/
│   ├── pages/
│   │   └── index.astro         # the single page
│   ├── components/
│   │   ├── astro/              # server-rendered, zero JS
│   │   │   ├── Nav.astro
│   │   │   ├── SeoHead.astro
│   │   │   ├── GrainOverlay.astro
│   │   │   └── ScrollProgress.astro
│   │   ├── sections/           # the 7 acts
│   │   │   ├── Hero/
│   │   │   ├── Manifesto/
│   │   │   ├── SkillConstellation/
│   │   │   │   ├── SkillConstellation.astro
│   │   │   │   ├── Constellation.tsx
│   │   │   │   ├── path.ts
│   │   │   │   └── skills.ts
│   │   │   ├── Services/
│   │   │   ├── Work/
│   │   │   ├── Contact/
│   │   │   │   ├── Contact.astro
│   │   │   │   └── ContactForm.tsx
│   │   │   └── Footer/
│   │   └── ui/                 # cross-section primitives
│   │       ├── MagneticButton.tsx
│   │       ├── CustomCursor.tsx
│   │       ├── SmoothScroll.tsx
│   │       ├── RevealText.tsx
│   │       ├── Marquee.tsx
│   │       └── Counter.tsx
│   ├── lib/
│   │   ├── motion.ts           # shared easings, springs, variants
│   │   ├── analytics.ts        # CF Web Analytics loader
│   │   └── seo.ts              # meta tag builder
│   ├── content/
│   │   ├── skills.ts           # SSOT
│   │   ├── services.ts
│   │   └── projects.ts
│   ├── styles/
│   │   ├── global.css          # Tailwind 4 @theme + base layer
│   │   └── fonts.css
│   └── env.d.ts
├── functions/
│   └── api/
│       └── contact.ts          # Pages Function (POST)
├── astro.config.mjs            # @astrojs/cloudflare + @astrojs/react
├── tsconfig.json
├── wrangler.toml               # KV bindings + env vars declaration
├── biome.json
├── .dev.vars                   # LOCAL secrets (gitignored)
├── .env.example                # documented env vars
├── .gitignore
├── package.json
└── README.md
```

### Routing & nav
- Single page at `/`, no router.
- Nav links are smooth-scroll anchors intercepted by Lenis.
- IntersectionObserver updates the browser URL hash on section change so deep links and `back` work.

### Contact Worker (Pages Function)

**`POST /api/contact`**

**Request body**
```ts
{ name: string; email: string; message: string; turnstileToken: string }
```

**Flow**
1. Parse & validate (name 1–80, valid email, message 10–2000, token present). Return `400 ValidationError` on failure.
2. Verify Turnstile token against `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Return `400 TurnstileFailed` on failure.
3. Rate-limit: KV key `rl:<hash(ip + IP_HASH_SALT)>`, TTL 1h, max 5/hour. Return `429 RateLimited` if exceeded. IPs are **hashed**, never stored raw.
4. Send email via Resend (from `CONTACT_FROM_EMAIL`, to `CONTACT_TO_EMAIL`). Return `502 ResendFailed` on send error.
5. Persist message to KV `msg:<uuid>` with 90-day TTL (backup if email pipeline fails).
6. Return `200 { ok: true }`.

**Errors are typed** so the form can render contextual messages (not a generic "something broke").

### Secrets & bindings
| Name | Type | Used in |
|---|---|---|
| `RESEND_API_KEY` | secret | Worker |
| `TURNSTILE_SECRET_KEY` | secret | Worker |
| `PUBLIC_TURNSTILE_SITE_KEY` | public env | Form island |
| `CONTACT_TO_EMAIL` | plain | Worker |
| `CONTACT_FROM_EMAIL` | plain | Worker |
| `IP_HASH_SALT` | secret | Worker |
| `CONTACT_MESSAGES` | KV namespace | Worker |
| `RATE_LIMIT` | KV namespace | Worker |

Local dev values live in `.dev.vars` (gitignored). `.env.example` documents the full list.

### Deploy
1. Push to `main` on GitHub.
2. Cloudflare Pages project, preset Astro, build `pnpm build`, output `dist`. Build env `NODE_VERSION=20`, `PNPM_VERSION=9`.
3. Custom domain `v9dev.in` via CNAME on existing Cloudflare DNS.
4. Preview deploys auto-created for every branch/PR.
5. GitHub Actions runs `typecheck + lint + build` on PRs (fails fast before deploy).

### Local dev commands
```
pnpm install
pnpm dev               # Astro on :4321 (UI only)
pnpm pages:dev         # wrangler pages dev → site + Functions on :8788
pnpm build
pnpm preview
pnpm typecheck
pnpm lint
pnpm format
```

## 7. SEO & metadata

- **Title** — `JP Singh — Forward Deployed Engineer · Cloud + Full-stack`
- **Meta description** (~155 chars) — `I design cloud platforms, build full-stack products, and keep them alive in production. From a single VPS to multi-region Kubernetes. Available for work.`
- **Canonical** — `https://v9dev.in/`
- **OpenGraph + Twitter card** — `summary_large_image`. Static OG image at `/og/default.png` (1200×630, dark + kinetic "JP SINGH" + tagline + lime accent stroke).
- **JSON-LD `Person` schema** in `<head>` — `name`, `jobTitle`, `url`, `sameAs` (GitHub, LinkedIn, X, email), `knowsAbout` pulled from `skills.ts`.
- **`<html lang="en">`**, semantic landmarks, one `<h1>` (your name), correct `h2/h3` hierarchy.
- **`sitemap.xml`** via `@astrojs/sitemap`.
- **`robots.txt`** — allow all, points at sitemap.
- **`theme-color`** meta — `#0A0A0F` dark / `#B8FF3A` accent.
- **Favicon set** — `favicon.ico`, `apple-touch-icon.png`, `mask-icon.svg`, `manifest.webmanifest` with maskable PWA icons.

## 8. Performance budget

| Metric | Target |
|---|---|
| Lighthouse Performance (desktop / mobile) | ≥ 95 / ≥ 90 |
| Lighthouse Best Practices / SEO / A11y | 100 / 100 / ≥ 95 |
| LCP | < 2.0s |
| INP | < 200ms |
| CLS | < 0.05 |
| TTFB (edge) | < 200ms |
| First-paint transfer | ≤ 600 KB |
| Full-page transfer | ≤ 1.2 MB |
| JS bundle (gzip) | ≤ 250 KB |

How we hit it:
- Hero text is server-rendered HTML — LCP is text, not an image.
- Hero display font preloaded + `size-adjust` to prevent CLS.
- GSAP core + only the 2 plugins we need, tree-shaken.
- Each section is `client:visible` — animations don't initialize until near.
- All images via Astro `<Image>` → AVIF / WebP / JPEG fallback, responsive `srcset`, lazy loading, explicit dimensions.
- Static assets served with `Cache-Control: public, max-age=31536000, immutable` via `public/_headers`.

## 9. Accessibility (WCAG 2.1 AA)

- Visible focus rings in accent color, 2px offset, never removed.
- Skip-to-content link at top of `<body>`.
- `prefers-reduced-motion` fully honored (see §5).
- Keyboard nav: tab order matches reading order; Work carousel responds to `←/→`; Constellation nodes are tabbable with roles + labels.
- All icon-only buttons have `aria-label`. Form has live-region status announcements.
- Contrast: body text ≥ 7:1 (AAA); accent on dark ≥ 4.5:1 (AA).
- `cursor: none` only when `(pointer: fine)`; touch keeps native cursor.

## 10. Content data shapes

```ts
// src/content/skills.ts
export type Cluster = 'frontend' | 'backend' | 'database' | 'cloud' | 'devops' | 'language';

export interface Skill {
  id: string;              // 'docker'
  name: string;            // 'Docker'
  role: string;            // 'Containerization'
  cluster: Cluster;
  icon: string;            // simple-icons slug; custom SVG fallback by id
  brand: string;           // hex, for hover glow
  years?: number;
}

export const skills: Skill[] = [/* 30+ entries seeded from JP's tool list */];
```

```ts
// src/content/services.ts
export interface Service {
  id: string;
  num: `0${number}`;            // '01' .. '04'
  title: string;
  blurb: string;
  deliverables: string[];
  accent: 'lime' | 'fuchsia' | 'cyan';
}
```

```ts
// src/content/projects.ts
import type { ImageMetadata } from 'astro';

export interface Project {
  slug: string;
  title: string;
  subtitle: string;
  outcome: string;              // headline metric
  stack: string[];              // skill ids
  links: { live?: string; repo?: string };
  cover: ImageMetadata;
  year: number;
}
```

All section components read from these three files. Adding/editing content is a 1-file change.

## 11. Initial content (seeded by Claude, swappable by JP)

**Hero**
- Display: `JP SINGH`
- Subtitle: `Forward Deployed Engineer — I ship cloud infra that doesn't fall over, and the products that run on top.`
- CTAs: `See work ↓` · `Book a call →`

**Manifesto** — see §4.02 above.

**Services** — see §4.04 above.

**Work placeholders** — see §4.05 above. Screenshots and links are placeholders to be swapped by JP.

**Contact**
- Heading: `Let's build something that lasts.`
- Sub: `Reply within 24h, anywhere on Earth.`

**Footer**
- Microcopy: `Designed and built by JP Singh · Deployed on Cloudflare · 2026 →`
- Socials: GitHub, LinkedIn, X, Email.

## 12. Open items / decisions deferred to implementation

- Final list of social handles + email address (JP to supply).
- Final OG image render — generated as a one-off static asset; copy to be finalized when JP supplies handles.
- Husky setup details (which hook events) — pre-commit only is the default.
- Whether to ship a tiny ~3KB analytics-event helper or rely on raw `beacon` calls — implementation call.

## 13. Success criteria

- Lighthouse score targets in §8 met on production.
- Working contact form submitting through the Worker into JP's inbox with Turnstile + rate-limit functioning.
- Site fully usable with `prefers-reduced-motion` on.
- Keyboard-only nav reaches every interactive element.
- Mobile (≤ 375px wide) renders without horizontal overflow and stays at ≥ 90 Lighthouse Performance.
- Deploy pipeline: a `git push` to `main` results in a live deploy at `v9dev.in` within 3 minutes.
