# Constellation Interactive Polish — Design

Add depth and reactivity to the Skill Constellation ("Stack") section:
magnetic 3D hover on each skill node, a brightening of the connecting
path around the hovered node, and mouse-driven parallax depth across the
whole constellation. No new dependencies; reuses the existing
`motion/react` springs and `path.ts` geometry. Honors the project's
restrained-but-expressive motion rule and `prefers-reduced-motion`.

## Goals

- Hovering a node feels alive: the node leans toward the cursor in 3D
  and the constellation visibly reacts.
- The whole star-map reads as a 3D space that responds to mouse
  movement, reinforcing the constellation metaphor.
- Zero layout thrash, no new libraries, graceful no-op on touch and
  under reduced-motion.

## Non-goals

- No floating 3D object / three.js / CSS-3D scene (explicitly rejected
  to avoid bundle weight and a generic look).
- No change to the scroll-driven draw, node count, layout, or wrapping
  logic in `path.ts`.
- No change to the tooltip content or the path-riding chip behavior.

## Components

### 1. Magnetic 3D hover — `SkillNode` (inside `Constellation.tsx`)

- On `pointermove` over the node's hover zone, compute the cursor
  offset from the node center, normalized to `[-1, 1]` on each axis.
- Apply via a `perspective` wrapper:
  - `rotateX` / `rotateY` up to **±12°** toward the cursor.
  - A **magnetic translate** of up to **~8px** toward the cursor.
- Existing hover treatment (scale ~1.12, brand box-shadow, border
  color, icon recolor + drop-shadow, tooltip) is retained and driven by
  the same `hovered` state — the tilt/drift layer on top.
- On `pointerleave`, all pointer-driven transforms spring back to rest
  using the existing spring config (`stiffness: 380, damping: 22`).
- Per-node pointer tracking is local state, active only while hovered —
  no always-on global listeners per node.

### 2. Path-segment highlight — `Constellation`

- When a node is hovered, brighten the connecting path around that
  node's `pathFraction` (already exposed by `path.ts`).
- Implementation: an additional overlay `<path>` using the same `d`,
  with `stroke-dasharray` / `stroke-dashoffset` set to reveal only a
  short span (a small +/- window in path length) centered on the
  hovered node's fraction, drawn in the node's brand color with a soft
  glow. Hidden (zero-length dash) when nothing is hovered.
- Hovered node identity is lifted to `Constellation` state so the
  overlay can read it; `SkillNode` reports hover up via a callback.

### 3. Constellation parallax depth — `Constellation`

- Track mouse position relative to the section container (single
  `pointermove` listener on the container).
- Each node gets a stable **depth factor** in one of ~3 discrete layers
  derived from its index/cluster (deterministic, not random per
  render).
- Translate each node by `mouseOffset * depthFactor`, max shift
  **~10–14px**, eased. The SVG path layer translates on a mid-depth
  factor so the line stays visually attached to the nodes.
- A single intensity constant scales the whole effect for easy tuning.

## Data flow

- `Constellation` owns: `hoveredId | null`, normalized `mouse` offset
  (`{x, y}` in `[-1, 1]`), and the derived per-node depth map (memoized
  from `geo.nodes`).
- `mouse` is updated from one container `pointermove`, throttled to a
  shared `requestAnimationFrame` tick (reuse the existing rAF pattern in
  the component rather than adding a second loop).
- Each `SkillNode` receives its depth factor + current `mouse` and
  reports hover enter/leave via `onHoverChange(id, bool)`.
- The path-highlight overlay reads `hoveredId` → looks up that node's
  `pathFraction` from `geo.nodes`.

## Reduced motion / input safety

- If `prefers-reduced-motion: reduce`: parallax disabled, 3D
  tilt/magnetic drift disabled. Plain scale + glow + tooltip remain
  (current behavior preserved).
- All pointer-driven values are applied as CSS `transform` only
  (compositor-friendly, no reflow).
- Effects are pointer-hover driven, so touch devices no-op naturally;
  the path-highlight simply never triggers without hover.

## Files touched

- `src/components/sections/SkillConstellation/Constellation.tsx`
  - parallax mouse state + memoized depth map
  - lifted `hoveredId` state + path-highlight overlay `<path>`
  - `SkillNode`: `perspective` wrapper, 3D tilt + magnetic offset,
    `onHoverChange` callback, depth-aware transform
- `src/components/sections/SkillConstellation/path.ts`
  - No change expected (`pathFraction` already exposed). Touch only if
    the highlight needs a helper to map a fraction window to dash
    values.

## Testing / verification

- Manual via `pnpm dev` (HMR is the review surface per project
  convention): hover nodes (tilt + drift + path glow), move mouse
  across section (parallax depth), verify spring-back on leave.
- Verify `prefers-reduced-motion` (OS setting / devtools emulation)
  disables tilt + parallax, keeps scale/glow.
- Verify no console errors, smooth 60fps (no layout thrash — transforms
  only), and touch/no-hover devices are unaffected.
- `pnpm lint` and typecheck clean for the touched files.

## Conventions

- pnpm only; review via dev HMR (no `pnpm build` per iteration).
- Copy/comments use hyphens, never em-dashes.
- Commits authored as `v9dev`, no AI co-author trailers.
