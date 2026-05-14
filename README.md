# v9dev.in

Portfolio site of **JP Singh** — Forward Deployed Engineer · Cloud + Full-stack.

Single-page bold-maximalist build. Astro 5 + React islands + Tailwind 4 on Cloudflare Pages with a Worker-backed contact form (Resend + Turnstile + KV).

## Quick start

```bash
pnpm install
pnpm dev              # Astro on :4321
pnpm pages:dev        # Wrangler + Functions on :8788
pnpm build            # → dist/
pnpm preview
pnpm typecheck
pnpm lint
pnpm test             # vitest
pnpm e2e              # playwright
```

## Required env

Copy `.env.example` → `.env` (gitignored) for the build. For local Worker dev, copy/edit `.dev.vars` (also gitignored).

| Variable | Where | Purpose |
|---|---|---|
| `PUBLIC_SITE_URL` | both | Used for canonical/OG |
| `PUBLIC_TURNSTILE_SITE_KEY` | both | Client-side Turnstile widget |
| `RESEND_API_KEY` | server only | Outbound email |
| `TURNSTILE_SECRET_KEY` | server only | Token verification |
| `IP_HASH_SALT` | server only | Salts IP hash for rate-limit key |
| `CONTACT_FROM_EMAIL` | server | Resend `from` address (must be verified) |
| `CONTACT_TO_EMAIL` | server | Where messages land |

## KV namespaces

Before first deploy:
```bash
pnpm exec wrangler kv namespace create CONTACT_MESSAGES
pnpm exec wrangler kv namespace create RATE_LIMIT
```
Paste the printed IDs into `wrangler.toml`.

## Cloudflare Pages setup

1. Create new Pages project, connect this GitHub repo.
2. Build command: `pnpm build`. Output dir: `dist`.
3. Build env: `NODE_VERSION=20`, `PNPM_VERSION=9`.
4. Set all server-side env vars + the two KV bindings in Pages → Settings.
5. Add custom domain `v9dev.in` via CNAME (DNS already on Cloudflare).

## Stack

| | |
|---|---|
| Framework | Astro 5 (`@astrojs/cloudflare`, `@astrojs/react`) |
| UI | React 19 islands |
| Styling | Tailwind 4 (CSS-first, `@tailwindcss/vite`) |
| Motion | Motion (Framer v12) + GSAP (ScrollTrigger, MotionPath) + Lenis |
| Backend | Cloudflare Pages Functions |
| Email | Resend |
| Spam | Cloudflare Turnstile |
| Storage | Cloudflare KV (2 namespaces) |
| Tooling | pnpm · Biome · Vitest · Playwright · Husky · lint-staged |
| Analytics | Cloudflare Web Analytics |

See `docs/superpowers/specs/2026-05-14-v9dev-portfolio-design.md` for the full design.
