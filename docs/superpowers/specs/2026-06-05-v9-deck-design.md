# v9 Deck - Design

A new flagship interactive experience on its own page (`/deck`): a
split-view "command deck" that pairs a real in-browser terminal with a
live architecture diagram, bound bidirectionally. Visitors type commands
(`load stalwart`, `connect nginx stalwart`, `boot`) to mutate the
diagram, OR wire services by hand (drag, tap, or keyboard) and watch the
equivalent command type itself into the log. The same deck hosts every
interactive idea in one coherent engine: a skill chart, the
connect/disconnect wiring playground, per-node low-level detail, and a
boot sequence over JP's real systems. The homepage gets an entry point
that links in.

Built entirely on the existing stack - React 19 islands, `motion/react`,
Radix (via the hand-authored `ui/sheet.tsx`), Tailwind v4 `@theme`
tokens, `cn()`, and the shared `motion.ts` language. No new heavy
runtime dependencies (no xterm.js, no react-flow, no three.js). Honors
`prefers-reduced-motion`, the custom cursor, and Lenis smooth scroll.

> This spec was adversarially reviewed against the live codebase
> (feasibility, completeness, scope, a11y/perf). The fixes from that
> review are folded in; see "Review corrections applied" at the end.

## Why one engine, not four widgets

Every capability routes through a single `useReducer` over
`{ archSlug, nodes, edges, selectedNodeId, wiring, boot, log }`. The
terminal parser and the manual-wiring handlers dispatch the *same*
actions, so typing, dragging, tapping, keyboard-wiring, and booting are
all just different ways to fire the same events. One SVG-over-DOM render
layer (the proven `Constellation.tsx` pattern: absolutely-positioned DOM
nodes over a single `<svg>` edge layer) draws everything. This is what
keeps "all of it" cohesive instead of a junk drawer of bolted-on toys.

## Decisions (locked for v1; adjustable on review)

- **Placement (locked):** dedicated page `/deck`, plus a Deck teaser as
  a NEW homepage section inserted **before Notes** (between Work and
  Notes) at `data-index=6`; renumber Notes 6->7, Contact 7->8, Footer
  8->9. Notes is kept.
- **Terminal voice:** operational, with a light touch of personality
  (e.g. echoed input `connect nginx stalwart`, then a styled result
  `LINK nginx -> stalwart  OK`; boot lines with a wink).
- **Systems modeled:** Stalwart Mail Server first (flagship). Server
  Cockpit is a stretch preset, only after the engine is proven. Not all
  six projects.
- **Detail depth:** clicking a node opens a read-only detail drawer
  (ports, protocols, config chips, and - for datastores - table list).
  No node creation, no editor, no save/share/export. (There is no
  separate "DB layer" renderer; DB info lives in the drawer.)
- **State:** in-memory only. Resets on reload. No backend/KV.
- **Data fix:** add `php` as a real skill (it appears in the Mautic
  project's stack and is currently a dangling id). Exact edit specified
  under Data fix.

## Placement (locked)

The current Notes section (`src/components/sections/Blog/Blog.astro`, id
`blog`) is kept. A new `DeckTeaser` section is inserted **before Notes**
(between Work `data-index=5` and Notes) at `data-index=6`. Renumber:
Notes 6->7, Contact 7->8, Footer 8->9 (ScrollProgress auto-counts, so
this is just `data-index` attribute edits in `index.astro` and the
section files). Add a `Deck -> /deck` entry to `Nav.astro` (the existing
`Notes -> #blog` link is unchanged). The teaser section id is
`deck-teaser` to avoid any confusion with the `/deck` route.

## Goals

- A visitor can operate one of JP's real architectures hands-on within
  ~30 seconds: load it, wire/unwire services, boot it, break it.
- The type-or-wire bind is real and reciprocal: a manual wire produces
  *literally* the same command string `help` documents.
- All three original wishes are satisfied in one place: skill
  graph/chart, HLD + per-node low-level detail, and the
  connect/disconnect playground.
- Reads as premium and on-brand (lime/dark/mono, same SVG + motion
  language as the constellation), not a generic library demo.
- Ships in phases that each stand alone and look finished.
- Fully operable by keyboard, touch, and pointer; reduced-motion safe.

## Non-goals

- No xterm.js / react-flow / three.js / WebGL (bundle weight, generic
  look, fights Lenis + the custom cursor).
- No persistence, multi-user, sharing, export, or server endpoint.
- No free-form node creation, no detail *editor* (detail is read-only).
- No separate DB/ER renderer (DB tables live in the detail drawer).
- No modeling of superset/mautic/cost/kernel as diagrams (Stalwart, then
  optionally Cockpit).
- No second always-on rAF loop; no change to `path.ts` curve math.

## Page + placement

- **New page:** `src/pages/deck.astro` using `Base.astro`. Base already
  renders `<SeoHead>` internally and takes `title` / `description` /
  `ogImage` props - so `deck.astro` passes page-specific SEO as props to
  `<Base>` (it does NOT mount its own `<SeoHead>`). Suggested copy:
  title `v9 deck - operate the architecture` (final `<title>` resolves
  via the site template), description `An interactive command deck:
  wire, boot, and explore the systems JP builds.` The page renders a
  static shell (mono label, heading, ambient blobs, `container-page`)
  mounting `<Deck client:load />` - it is the page's primary content, so
  eager hydration is appropriate.
- **Homepage entry:** a new static Astro section `DeckTeaser` (id
  `deck-teaser`, `data-index=6`) inserted before Notes - a mini ASCII
  diagram + a `MagneticButton` "launch the deck ->" linking to `/deck`.
  Light on the homepage; no island needed.
- **Nav:** make `Nav.astro` route-aware. It already builds a `links`
  array shared with `MobileMenu`. On the homepage, section links stay as
  `#anchor` (so `SmoothScroll`, which intercepts only `a[href^="#"]`,
  drives smooth scroll). On any other route (e.g. `/deck`), render the
  same section links as `/#anchor` so they navigate home and then anchor
  (a normal cross-page anchor; the interceptor correctly ignores them).
  Compute `const onHome = Astro.url.pathname === '/'` and prefix
  accordingly. Add a `Deck -> /deck` entry. This closes the "dead nav
  links on /deck" gap.

## Data fix - add `php`

`projects.ts` (`mautic-plugins.stack`) references skill id `php`, but
`skills.ts` has no such skill and `icons.ts` has no `php` key (dangling
id). Add it as a real skill:

- `src/content/skills.ts`: append
  `{ id: 'php', name: 'PHP', role: 'Server-side language',
  cluster: 'language', icon: 'php', brand: '#777BB4', years: 5 }`.
  (The `Skill` interface requires `icon`; the lookup is keyed by `id`,
  not by `icon`, but include `icon` for interface completeness.)
- `src/lib/icons.ts`: add `siPhp` to the `simple-icons` import list and
  `php: siPhp` to the id-keyed `map` (verified: `simple-icons` exports
  `siPhp`, hex `777BB4`). After this, `getIconPath('php')` /
  `getIconHex('php')` resolve.

## Data model - `src/content/architectures.ts`

A typed module following the `skills.ts` / `projects.ts` / `services.ts`
export convention, imported via `@content/architectures`. Optionally
zod-validatable (zod is installed).

```ts
export type NodeKind = 'client' | 'edge' | 'service' | 'datastore' | 'external';

export interface ArchPort {
  id: string;            // addressing/label key, unique within the node
  label: string;         // 'SMTP', 'JMAP', '443'
  dir: 'in' | 'out';     // drag/wire eligibility is decided by dir, not id
}

export interface ArchNode {
  id: string;            // 'nginx', 'stalwart', 'sqlite', 'dns'
  label: string;
  kind: NodeKind;
  skillId?: string;      // links skills.ts -> icon (getIconPath) + accent (skill.brand)
  accent?: string;       // explicit accent for non-skill nodes (e.g. 'stalwart')
  abbr?: string;         // fallback glyph text when no icon (else name.slice(0,3))
  hld: string;           // one-line role summary
  detail?: {             // read-only low-level detail (shown in the drawer)
    ports: ArchPort[];
    protocols: string[];
    config: { label: string; value: string }[]; // DKIM/SPF/DMARC, volumes, env
    tables?: { name: string; columns?: string[] }[]; // datastore schema (list only)
    notes?: string;
  };
  col?: number;          // optional layout hint (depth column 0..n)
}

export interface ArchEdge {
  id: string;
  from: string;          // node id
  to: string;            // node id
  protocol?: string;     // edge label
  required: boolean;     // part of the correct reference topology
}

export interface Architecture {
  slug: string;          // 'stalwart-mail'
  title: string;
  subtitle: string;
  projectSlug?: string;  // cross-link to projects.ts
  nodes: ArchNode[];
  edges: ArchEdge[];     // the reference (valid) wiring
}

export const architectures: Architecture[];
export const architectureBySlug: Record<string, Architecture>;
```

Node icon + accent rules (visual parity with the constellation):
- **Icon:** `getIconPath(skillId)` when `skillId` is set and resolves;
  otherwise render a fallback glyph (`abbr` or `label.slice(0, 3)`).
- **Accent:** `skillsById[skillId].brand` when present (this matches how
  `Constellation.tsx` colors nodes - NOT `getIconHex`); otherwise the
  node's explicit `accent`, defaulting to `--color-lime`.
- Non-skill nodes like `stalwart`, `dns` use `accent` + `abbr` (or model
  `stalwart` as a first-class skill later if desired).

### Worked reference (abbreviated) - Stalwart Mail Server

```
nodes:  dns(external) -> nginx(edge) -> stalwart(service) -> sqlite(datastore)
        mailclient(client) ──(SMTP/IMAP/JMAP)── stalwart
edges (required): dns->nginx, nginx->stalwart, stalwart->sqlite,
                  mailclient->stalwart
```

Acceptance: `boot(reference.edges, reference)` must reach all nodes "up"
with zero unreachable warnings (the authored reference is, by
definition, valid). `external` doubles as the DNS/internet origin; no
separate DNS kind is needed.

## Architecture / components

### 1. `Deck.tsx` - the island + state engine

State (single `useReducer`):
```
{
  archSlug: string,
  nodes: Record<id, { x; y }>,            // positions (layout seeds + drag results)
  edges: Edge[],                           // current wiring (may differ from reference)
  selectedNodeId: string | null,           // drawer open == selectedNodeId != null
  wiring: { armedFrom: string | null },    // shared select-source state (click/tap/kbd)
  boot: { running: bool; up: Set<id>; unreachable: Set<id> },
  log: LogLine[],
}
```
Actions (the shared vocabulary both terminal and manual wiring dispatch):
`LOAD` (reset everything to a preset's reference), `RESET` (re-apply the
current preset's reference wiring + positions), `CONNECT`, `DISCONNECT`,
`MOVE_NODE` (commit a drag reposition on pointerup; cosmetic, not
echoed), `ARM` / `DISARM` (select-source for manual wiring),
`SELECT_NODE` (open detail; `SELECT_NODE(null)` closes the drawer / Esc),
`BOOT_START | BOOT_STEP | BOOT_DONE`, `LOG`, `CLEAR`.

- Composes `<Terminal>` + `<Diagram>` side by side (stacked under `md`).
- **Terminal input string is local** to `<Terminal>` (not in the
  reducer), so keystrokes never re-render the diagram.
- Derived geometry is memoized: `useMemo(() => layout(arch, nodes,
  dims), [arch, nodes, dims])` so non-drag dispatches recompute once.

### 2. `Terminal.tsx`

- Controlled `<input>` + scrollable mono log on `bg-elevated/70
  backdrop-blur`, `font-mono` ~12-13px. `data-lenis-prevent` on the
  exact `overflow-y-auto` log element (not a wrapper) so internal scroll
  does not fight the global Lenis singleton (`window.__lenis`).
- Submitting a line calls `parse()` (`commands.ts`) -> an `Action` or a
  friendly error (`command not found - try 'help'`).
- Up/Down history (includes commands echoed by manual wiring, so the
  history is fully replayable); `Tab` completion from `complete()`; a
  clickable hint-chip row (run-by-tap for non-typers and touch).
- Output: `role="log" aria-live="polite"`; input has `aria-label`. Boot
  emits its status lines as a single batched update (not line-by-line)
  so the live region is not flooded.

### 3. `Diagram.tsx` + `ServiceNode.tsx` + wiring

- One `<svg>` edge layer (cubic-bezier `<path>` per edge, cyan->lime->
  fuchsia `linearGradient`, drop-shadow, `stroke-dashoffset` reveal on
  connect, CSS-animated dash for live data-flow) beneath absolutely-
  positioned `ServiceNode` DOM cards. Same technique as
  `Constellation.tsx`.
- `board.ts` owns wire geometry with its **own** small cubic-bezier
  helper (`wirePath(a, b)`); it does NOT import `path.ts`'s private
  `buildSmoothPath` (so `path.ts` stays untouched). Wire routing
  (side-anchored bezier between port coords) differs from the
  constellation's snaking path anyway.
- Node icons via `getIconPath(skillId)`; accent via `skill.brand` /
  `accent` / lime fallback (see Data model). Ports are real `<button>`s
  with `focus-visible` lime rings, `aria-label`, and `data-cursor-label`.

**Unified wiring state machine (one code path for click, tap, AND
keyboard):**
1. Activating an `out` port (click / tap / Enter-Space) dispatches
   `ARM(fromPort)`: the port shows a lime ring, and the log announces
   `armed: nginx out - choose a target` (the `role=log` region voices it
   for AT).
2. Activating a valid `in` port completes it: dispatch `CONNECT` AND
   echo the exact command `connect <from> <to>` into the log (then a
   styled `LINK <from> -> <to>  OK`). The reciprocal bind.
3. Activating an invalid target (e.g. `client -> datastore`) prints a
   red `! cannot expose <a> to <b>` and stays armed.
4. Activating the armed source again, Esc, or empty canvas -> `DISARM`
   (cancel).
5. Activating an existing edge (or its endpoint) -> `DISCONNECT` + log.

**Pointer drag is a progressive enhancement** over that machine: an
`out`-port pointer-capture session follows the cursor with a single
ghost `<path>` and snaps to the nearest valid `in` port; release =
`CONNECT` + echo. During an active drag, only the dragged node and the
single ghost path mutate (local state / direct style); `MOVE_NODE` /
`CONNECT` dispatch to the reducer **only on pointerup** (no per-frame
dispatch). rAF runs only during an active drag.

**Custom-cursor during a capture drag** (because `cursor:none` on fine
pointers removes the OS pointer): the canvas root carries
`data-cursor="drag"` for the whole session so the cursor dot stays in
drag accent; the deck drives explicit visual state itself - origin port
stays highlighted, the nearest valid `in` port gets a snap highlight
(ring + scale), and the ghost bezier tracks the captured pointer. Do not
rely on per-port `pointerover` during capture.

- `data-lenis-prevent` on the canvas; pointer events do not bubble into
  scroll; while a wire is armed/dragging on touch, the canvas must not
  start a Lenis scroll.
- Min port hit target >= 44px under `md` (Tailwind `md` = 768px, the
  constellation's mobile cutoff); larger touch targets when stacked.

### 4. Detail drawer - `DetailDrawer.tsx`

- Clicking any node (HLD canvas) opens a read-only Radix drawer reusing
  `ui/sheet.tsx`. It renders `detail.ports`, `detail.protocols`,
  `detail.config` chips, and - for datastores - `detail.tables` as a
  simple name/columns list (NO FK-line renderer; that was cut as
  over-engineering for a portfolio).
- Drawer open is derived (`selectedNodeId != null`); Esc / close
  dispatches `SELECT_NODE(null)`. The drawer MUST render a `SheetTitle`
  (DialogTitle) for an accessible name, and the close control's
  `aria-label` must be Deck-appropriate (`Close details`) - so either
  parameterize `sheet.tsx`'s hardcoded `Close menu` label or use a
  Deck-local variant. Verify Lenis does not fight Radix's body
  scroll-lock while open (call `window.__lenis?.stop()/start()` around
  open/close if needed).

### 5. Boot

- `boot`: `bootOrder()` (topological sort in `board.ts`, cycle-safe)
  pulses nodes "up" in dependency order with a mono status log
  (`easings.outExpo`); missing required wires surface a red `unreachable`
  hint instead of pretending success. Boot status lives in
  `state.boot.{up, unreachable}` (not just a `booting` flag).

### 6. `skills` chart

- `skills [cluster]`: a hand-rolled bar chart (flex divs, brand-hex
  fill) grouped by cluster from `skills.ts`. Bar width
  `${(years ?? 0) / 5 * 100}%`, with `years` clamped to 5 (the
  documented cap) and a min-width stub / "n/a" for skills with no
  `years` (so undefined never yields `NaN%`). No chart library.

### 7. Stretch (post-v1, optional)

- **`validate`** - a required-edge diff + the few `NodeKind` invariants
  (a `datastore` needs >=1 inbound `service` edge; a `client` must not
  wire to a `datastore`; an `edge` needs an upstream `external`),
  reusing `bootOrder`. Optional because `boot` already surfaces
  unreachable wiring; only add if the explicit pass/warn/fail report
  earns its place.
- **Auto-demo** (`demo` / `tour`) - a button/command that types the
  happy-path commands into the terminal in sequence (reuses the parser,
  near-zero new code). This replaces the earlier chip-rides-the-path
  tour, which was a state machine + extra rAF not worth it for a
  portfolio.
- **`graph`** - mount the constellation render inside the deck as command
  output, using `buildConstellation()` in a **static** variant
  (`progress = 1`, no scroll tick) so it does not add a second always-on
  rAF (the non-goal). Geometry is pure and renders fully-drawn.
- **Server Cockpit preset** - a second `architectures.ts` entry behind a
  segmented toggle. Do not build the multi-arch registry indirection
  until this second system actually exists; v1 `load` may target the
  single arch directly.

### 8. Constellation click-upgrade (independent, optional)

A separate, optional homepage enhancement - NOT a dependency of the deck:

- Make the existing skill graph clickable: add `selectedId` state +
  `onClick`/Enter-Space toggle (`aria-pressed`) on `SkillNode`, dim
  unrelated nodes, and render a "used in" list by filtering `projects.ts`
  where `stack.includes(skill.id)`. **This is net-new code on current
  `main`**, not a cherry-pick.
- The only reuse is the pure helper `highlightDash` (path-segment
  spotlight math) from the polish branch's `interaction.ts`, copied in
  as a utility and driven by `selectedId`'s `pathFraction`. Do NOT pull
  in the branch's `Constellation.tsx` rewrite or its parallax
  pointer-move loop (out of scope; it is the separate constellation
  polish feature's concern). NEVER merge
  `feat/constellation-interactive-polish` - it predates the SEO work and
  would delete `public/icons/*`, `public/og/*`,
  `scripts/gen-seo-assets.mjs`, `scripts/seo-assets.config.mjs`, and SEO
  docs, and regress `SeoHead.astro`.

## Pure, testable modules (mirror the `path.ts` convention)

- **`board.ts`** (DOM-free, alias-free - takes data as params, imports no
  `@content`): `layout(arch, positions, dims)` -> positioned nodes by
  depth column; `portCoords(node, port)`; `wirePath(a, b)` -> own bezier
  `d`; `bootOrder(nodes, edges)` -> topo order (or a cycle error);
  optional `validate(edges, arch)` (stretch).
- **`commands.ts`** (DOM-free, alias-free): `parse(input)` ->
  `Action | ParseError`; `complete(input)` -> `string[]`. Frozen verb
  set: `help`, `ls`, `load`, `connect`, `disconnect`, `boot`, `reset`,
  `skills`, `clear` (+ stretch: `validate`, `demo`, `graph`).
- **`state.ts`**: the reducer + action/state types.
- Tests (`*.test.ts`, vitest) import these modules via **relative paths**
  with inline fixtures (no aliases needed). Covered: `board.ts` (layout
  determinism, wire math, bootOrder incl. cycle detection, validate if
  built), `commands.ts` (every verb, errors, completion), `state.ts`
  (reducer transitions: arm/connect/disconnect/load/reset/select).

### Phase 0 prerequisite - vitest alias config

There is currently **no** `vitest.config.*`/`vite.config.*` and
`vite-tsconfig-paths` is not installed, so any test importing `@content`/
`@lib` cannot resolve. Add `vitest.config.ts` with `resolve.alias` for
`@`, `@components`, `@lib`, `@content`, `@styles` (mirroring
`tsconfig.json` paths). Keeping the pure modules alias-free (above) means
their own tests do not strictly need it, but the config unblocks any
test that imports aliased modules and prevents a silent gap.

## Data flow

1. User input (a typed command OR a manual wire via click/tap/keyboard/
   drag) is normalized to an `Action`.
2. `dispatch(action)` updates the single reducer state.
3. `Diagram` re-derives geometry from memoized `board.ts` output against
   the new state; `Terminal` appends log lines.
4. A manual wire additionally dispatches `LOG` with the exact replayable
   command string `connect <from> <to>` (then a styled result line), so
   the log + history always reflect commands you could have typed.
   `MOVE_NODE` (reposition) is cosmetic and not echoed.

## Reduced motion / input / a11y

- `prefersReducedMotion()`:
  - Board renders **fully wired** by default; command execution is
    instant (no typewriter); no data-flow dash animation.
  - **Boot** prints its full status log in one batch and sets reachable
    nodes "up" immediately - driven by inline style, NOT a CSS
    transition class, because `global.css` forces
    `transition-duration: 200ms` (not 0) under reduced motion, so a
    class-based flip would still tween. Red `unreachable` lines still
    surface.
  - Auto-demo (stretch) executes instantly with no travel animation.
- All pointer-driven values applied as CSS `transform` only.
- **One wiring machine** serves keyboard, touch, and click (Section 3),
  so there is no focusable-dead-control a11y trap and no
  keyboard/touch-only gap: every audience can wire via ports OR the
  terminal. Pointer drag is the enhancement.
- **Touch:** tap-select-source then tap-target (the same machine); armed
  state shows a ring + a log line; invalid target = red line, stays
  armed; tapping an edge disconnects; hint chips + history make the
  terminal usable without a hardware keyboard; under `md` the layout
  stacks (diagram above, terminal below) with >=44px port targets.
- **Keyboard:** Tab to a port, Enter/Space arms/completes (announced via
  the live region), Esc cancels; Esc closes the drawer; full command
  path via the input.
- Custom cursor: `data-cursor`/`data-cursor-label` on ports/nodes/edges;
  `data-cursor="drag"` on the canvas during a capture drag.

## Performance

- The `/deck` route still runs the page-wide Lenis rAF and
  `ScrollProgress` spring loop (mounted by `Base.astro`) - it is NOT
  rAF-quiet. The win is only that there is **no homepage constellation
  rAF** here. The deck's own rAF runs solely during an active drag.
- Data-flow is a CSS `@keyframes wire-flow` (new in `global.css`,
  reduced-motion gated). A CSS keyframe is the one allowed place to
  encode timing directly (it cannot import `motion.ts`); use the
  signature feel and keep the duration in one named place.
- Drag uses local state + dispatch-on-pointerup; geometry is memoized -
  no per-frame reducer storm.
- The stretch `graph` command renders the constellation statically
  (no second rAF). No new heavy dependency.

## Files

New:
- `src/pages/deck.astro`
- `src/components/deck/Deck.tsx`
- `src/components/deck/Terminal.tsx`
- `src/components/deck/Diagram.tsx`
- `src/components/deck/ServiceNode.tsx`
- `src/components/deck/DetailDrawer.tsx`
- `src/components/deck/SkillsChart.tsx`
- `src/components/deck/board.ts` (+ `board.test.ts`)
- `src/components/deck/commands.ts` (+ `commands.test.ts`)
- `src/components/deck/state.ts` (+ `state.test.ts`)
- `src/content/architectures.ts`
- `src/components/sections/DeckTeaser/DeckTeaser.astro`
- `vitest.config.ts` (alias resolution; Phase 0)

Modified:
- `src/pages/index.astro` (insert `DeckTeaser` before Notes; bump the
  `data-index` of Notes 6->7, Contact 7->8, Footer 8->9)
- the Notes/Contact/Footer section files as needed for their `data-index`
  attribute bumps
- `src/components/astro/Nav.astro` (route-aware hrefs + `Deck` entry;
  `Notes -> #blog` unchanged)
- `src/content/skills.ts` + `src/lib/icons.ts` (add `php`)
- `src/styles/global.css` (add `@keyframes wire-flow` + reduced-motion
  guard)
- (Optional, Section 8) `src/components/sections/SkillConstellation/
  Constellation.tsx` + a copied `highlightDash` helper

Explicitly NOT modified: `path.ts` (board.ts has its own wire helper).

## Phasing (each phase independently shippable)

0. **Foundations (invisible):** `vitest.config.ts`; `architectures.ts`
   (Stalwart only) with a reference that boots all-up; add `php` to
   `skills.ts` + `icons.ts`. Ships as config + data + tests; no UI.
1. **Deck page MVP - static diagram + command terminal (honest framing:
   an MVP, not yet the flagship moment):** `/deck` route + homepage
   entry; `board.ts` (layout, wirePath, bootOrder); render Stalwart
   fully-wired; terminal parses `help`/`ls`/`load`/`connect`/
   `disconnect`/`reset`/`clear` and mutates the diagram via the reducer.
   Optionally include node-reposition drag here. No wire-by-hand yet.
2. **Manual wiring + the reciprocal bind (the senior-signal moment):**
   the unified click/tap/keyboard select-source->target machine
   dispatching `CONNECT`/`DISCONNECT` and echoing the exact command;
   pointer drag-to-wire as the enhancement (snap, ghost path, cursor
   affordances, Lenis coordination). Full keyboard + touch acceptance.
3. **Boot + detail drawer:** topo `boot` with batched status log;
   click-node -> `DetailDrawer` (ports/protocols/config/tables). Full
   reduced-motion + a11y pass (batched live region, focus-visible ports,
   named dialog).
4. **`skills` chart + the data-flow polish** (`@keyframes wire-flow`).
5. **Stretch (optional):** `validate`, auto-demo, `graph`, Server
   Cockpit preset.
6. **Independent (optional, anytime):** constellation click-upgrade
   (Section 8) - net-new, not a cherry-pick.

## Testing / verification

- Unit (vitest): `board.ts`, `commands.ts`, `state.ts` (relative imports,
  inline fixtures); acceptance test that the Stalwart reference boots
  all-up with no unreachable.
- Manual via `pnpm dev` (HMR is the review surface): type-path and
  wire-path stay in sync (same echoed command); boot behaves; the
  drawer; the homepage entry links to `/deck`; nav links work both on
  home and from `/deck`.
- Confirm `data-lenis-prevent` actually stops Lenis from hijacking the
  log/canvas wheel + touch scroll in dev.
- Reduced-motion (OS / devtools): fully wired, instant execution, no
  dashes, batched instant boot.
- Touch emulation + keyboard-only: the one wiring machine works in all
  three input modes; stacked layout under `md`; >=44px ports.
- `pnpm lint` + `pnpm run typecheck` clean for all touched files; no new
  console errors; 60fps (transform-only, no re-render storm on drag).

## Conventions

- pnpm only; review via dev HMR (no `pnpm build` per iteration).
- Copy/comments and all terminal output strings use hyphens, never
  em-dashes (middot `·` allowed).
- Commits authored as `v9dev <99959044+v9dev@users.noreply.github.com>`,
  no AI co-author trailers.
- New code passes Biome (`import type`, single quotes in JS / double in
  JSX, semicolons, trailing commas, 2-space, lineWidth 100, a11y on);
  reuse `cn()` and `@lib/motion` tokens (never hard-code easings in JS;
  the one CSS keyframe is the documented exception).
- Use the path aliases (`@components`, `@content`, `@lib`, `@styles`).

## Review corrections applied

From the adversarial spec review (verified against the codebase):

- **`buildSmoothPath` is private** in `path.ts` -> `board.ts` defines its
  own `wirePath` bezier; `path.ts` stays untouched.
- **No vitest alias config / no tsconfig-paths** -> added `vitest.config.ts`
  as Phase 0 + pure modules kept alias-free with relative-import tests.
- **Blog/Notes is real content** (not empty) with a live `Notes -> #blog`
  nav link -> raised as the PLACEMENT decision (A keep / B replace) with
  the nav change spelled out.
- **`php` needs an `icon` field + an id-keyed `icons.ts` map entry** ->
  exact two-file edit specified.
- **Node accent source** -> `skill.brand` (matches constellation), not
  `getIconHex`; explicit fallback for non-skill nodes (`stalwart`, `dns`).
- **SeoHead/Base wiring** -> page passes `title`/`description` props to
  `<Base>`; no second `<SeoHead>`.
- **Constellation upgrade is net-new, not a cherry-pick** -> re-scoped;
  only the pure `highlightDash` helper is reused; parallax out of scope;
  made keyboard-operable; extended the protected-asset list.
- **DB FK renderer cut** -> tables shown in the detail drawer (list only).
- **`validate` + guided tour demoted** to optional stretch; tour replaced
  by a cheap auto-demo.
- **Reciprocal echo format defined** (exact `connect a b` + styled
  result; `MOVE_NODE` not echoed; echoes join history).
- **Reducer state completed** (boot status, derived drawer open, ARM/
  DISARM, LOAD vs RESET).
- **One wiring machine** for click/tap/keyboard fixes the a11y
  focusable-dead-control trap and the touch gap; drag is the enhancement.
- **Perf claims corrected** (Lenis + ScrollProgress run on /deck;
  drag dispatches on pointerup; memoized geometry; static `graph`).
- **Nav dead-links on /deck** -> route-aware `#anchor` vs `/#anchor`.
- **CSS `wire-flow` keyframe**, **skills-chart `years` fallback**,
  **port `dir`-based eligibility**, **drawer `SheetTitle` + correct close
  label**, **batched boot live-region** all specified.
