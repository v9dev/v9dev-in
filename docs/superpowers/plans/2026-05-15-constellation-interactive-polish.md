# Constellation Interactive Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Skill Constellation section feel alive — icons ignite into their brand color as the scroll-drawn line crosses them, nodes tilt magnetically toward the cursor, the path brightens around the hovered node, and the whole star-map parallaxes in depth with the mouse.

**Architecture:** Pure interaction math (depth layers, pointer normalization, path-highlight dash window) lives in a new tested helper module `interaction.ts`. The React wiring in `Constellation.tsx` consumes those helpers; motion/visual behavior is verified manually via dev HMR (the project's review surface — visual motion is not unit-testable). All pointer-driven values are applied as CSS `transform` only and gated by `prefers-reduced-motion`.

**Tech Stack:** Astro 5 + React 19 island, `motion/react`, TypeScript, Vitest (jsdom), Biome. Package manager: **pnpm only**.

---

## Conventions (apply to every task)

- **pnpm only.** Never npm/yarn. Do not run `pnpm build` — review via `pnpm dev` HMR.
- Commits authored as `v9dev`, **no AI co-author trailers**. Every commit command in this plan uses:
  `git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "..."`
- Copy and comments use hyphens `-`, never em-dashes.
- After code steps, lint with: `pnpm exec biome check <file>` (clean = exit 0 / "Checked N file").

## File Structure

- **Create** `src/components/sections/SkillConstellation/interaction.ts` — pure helpers: `depthFactor`, `normalizePointer`, `highlightDash`. One responsibility: interaction math, no DOM, no React.
- **Create** `src/components/sections/SkillConstellation/interaction.test.ts` — Vitest unit tests for the three helpers.
- **Modify** `src/components/sections/SkillConstellation/Constellation.tsx` — consume helpers: lifted `hoveredId` state, parallax `pointer` state, reduced-motion gate, path-highlight overlay, and a rewritten `SkillNode` (perspective wrapper, 3D tilt + magnetic drift, brand-color ignite on `active`).

No change to `path.ts` (its `pathFraction` and `d`/`pathLength` are already exposed).

---

### Task 1: Pure interaction helpers (TDD)

**Files:**
- Create: `src/components/sections/SkillConstellation/interaction.ts`
- Test: `src/components/sections/SkillConstellation/interaction.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/sections/SkillConstellation/interaction.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { depthFactor, highlightDash, normalizePointer } from './interaction';

describe('depthFactor', () => {
  it('cycles through three stable layers by index', () => {
    expect(depthFactor(0)).toBe(1);
    expect(depthFactor(1)).toBe(0.66);
    expect(depthFactor(2)).toBe(0.4);
    expect(depthFactor(3)).toBe(1);
  });

  it('is deterministic for the same index', () => {
    expect(depthFactor(7)).toBe(depthFactor(7));
  });
});

describe('normalizePointer', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };

  it('maps the center to 0,0', () => {
    expect(normalizePointer(200, 100, rect)).toEqual({ x: 0, y: 0 });
  });

  it('maps corners to -1/1 and clamps beyond the rect', () => {
    expect(normalizePointer(100, 50, rect)).toEqual({ x: -1, y: -1 });
    expect(normalizePointer(300, 150, rect)).toEqual({ x: 1, y: 1 });
    expect(normalizePointer(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });

  it('returns 0,0 for a zero-size rect', () => {
    expect(
      normalizePointer(10, 10, { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('highlightDash', () => {
  it('returns a hidden pattern for non-positive length', () => {
    expect(highlightDash(0, 0.5, 100)).toEqual({ dasharray: '0 1', dashoffset: 0 });
  });

  it('reveals a window centered on the fraction', () => {
    expect(highlightDash(1000, 0.5, 100)).toEqual({
      dasharray: '0 450 100 1000',
      dashoffset: 0,
    });
  });

  it('clamps the window at the path start', () => {
    expect(highlightDash(1000, 0, 100)).toEqual({
      dasharray: '0 0 50 1000',
      dashoffset: 0,
    });
  });

  it('clamps the window at the path end', () => {
    expect(highlightDash(1000, 1, 100)).toEqual({
      dasharray: '0 950 50 1000',
      dashoffset: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/sections/SkillConstellation/interaction.test.ts`
Expected: FAIL — `Failed to resolve import "./interaction"` / module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/sections/SkillConstellation/interaction.ts`:

```ts
/**
 * Pure interaction math for the Skill Constellation. No DOM, no React -
 * unit-tested in interaction.test.ts.
 */

/** Discrete parallax depth layers, near -> far. */
const DEPTH_LAYERS = [1, 0.66, 0.4] as const;

/**
 * Stable parallax depth factor for a node, derived from its index so a
 * node keeps the same layer across renders.
 */
export function depthFactor(index: number): number {
  return DEPTH_LAYERS[index % DEPTH_LAYERS.length];
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Normalize a pointer position within a rect to [-1, 1] per axis, clamped. */
export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: RectLike,
): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const x = rect.width ? clamp(((clientX - rect.left) / rect.width) * 2 - 1) : 0;
  const y = rect.height ? clamp(((clientY - rect.top) / rect.height) * 2 - 1) : 0;
  return { x, y };
}

/**
 * stroke-dasharray / dashoffset that reveals only a `windowPx` span of a
 * path centered on `fraction` (0..1) of `totalLength`, clamped to the
 * path ends. Pattern: zero dash, gap to the window start, the visible
 * span, then a gap covering the remaining path.
 */
export function highlightDash(
  totalLength: number,
  fraction: number,
  windowPx: number,
): { dasharray: string; dashoffset: number } {
  if (totalLength <= 0) return { dasharray: '0 1', dashoffset: 0 };
  const half = windowPx / 2;
  const center = Math.max(0, Math.min(totalLength, fraction * totalLength));
  const start = Math.max(0, center - half);
  const end = Math.min(totalLength, center + half);
  const visible = Math.max(0, end - start);
  return { dasharray: `0 ${start} ${visible} ${totalLength}`, dashoffset: 0 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/sections/SkillConstellation/interaction.test.ts`
Expected: PASS — 4 test files... actually 3 `describe` blocks, all green (10 assertions).

- [ ] **Step 5: Lint**

Run: `pnpm exec biome check src/components/sections/SkillConstellation/interaction.ts src/components/sections/SkillConstellation/interaction.test.ts`
Expected: "Checked 2 files" with no errors. If import-order is flagged, run `pnpm exec biome check --write` on those two files and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/SkillConstellation/interaction.ts src/components/sections/SkillConstellation/interaction.test.ts
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(constellation): pure interaction helpers (depth, pointer, highlight)"
```

---

### Task 2: Wire constants, imports, and reduced-motion gate into Constellation

**Files:**
- Modify: `src/components/sections/SkillConstellation/Constellation.tsx` (top imports + constants block at lines 1-12, plus add state)

- [ ] **Step 1: Update imports**

Replace the first line:

```tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
```

with:

```tsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
```

Add this import directly below the existing `import { getIconPath } from '@lib/icons';` line:

```tsx
import { depthFactor, highlightDash, normalizePointer } from './interaction';
```

- [ ] **Step 2: Add interaction constants**

Directly after the existing constant block (after `const NODE_SIZE_MOBILE = 36;`), add:

```tsx
const PARALLAX_MAX_PX = 14; // shift of the nearest depth layer
const TILT_MAX_DEG = 12; // max 3D lean of a hovered node
const MAGNET_MAX_PX = 8; // max drift of a hovered node toward the cursor
const HIGHLIGHT_WINDOW_PX = 120; // path length lit around the hovered node
const PATH_DEPTH = 0.66; // mid depth layer the path rides on
```

- [ ] **Step 3: Add state + reduced-motion gate inside `Constellation()`**

Immediately after the existing state declarations (after `const [nodeSize, setNodeSize] = useState(NODE_SIZE_DESKTOP);`), add:

```tsx
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [motionEnabled, setMotionEnabled] = useState(true);
  const pointerRaf = useRef(0);

  // ── Respect prefers-reduced-motion for pointer-driven motion ──
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionEnabled(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const handleHoverChange = useCallback((id: string, hovered: boolean) => {
    setHoveredId((cur) => (hovered ? id : cur === id ? null : cur));
  }, []);

  const handleSectionPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!motionEnabled) return;
      const el = containerRef.current;
      if (!el || pointerRaf.current) return;
      const { clientX, clientY } = e;
      const rect = el.getBoundingClientRect();
      pointerRaf.current = requestAnimationFrame(() => {
        pointerRaf.current = 0;
        setPointer(normalizePointer(clientX, clientY, rect));
      });
    },
    [motionEnabled],
  );

  const handleSectionPointerLeave = useCallback(() => {
    setPointer({ x: 0, y: 0 });
  }, []);
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output (no type errors). Unused-symbol warnings for the new constants/handlers are acceptable at this step — they are consumed in Tasks 3-5.

Run: `pnpm exec biome check src/components/sections/SkillConstellation/Constellation.tsx`
Expected: only the pre-existing warnings already present in this file (`noSvgWithoutTitle` on the SVG elements, formatter notes) — no NEW errors from the added lines. Do not "fix" the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/SkillConstellation/Constellation.tsx
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(constellation): interaction state, constants, reduced-motion gate"
```

---

### Task 3: Rewrite `SkillNode` — brand-color ignite + magnetic 3D hover

This replaces the entire `NodeProps` interface and `SkillNode` function at the bottom of `Constellation.tsx`. The new node: ignites its icon to the brand color whenever `active` (the line has crossed it) OR hovered; tilts in 3D and drifts toward the cursor on hover; receives a parallax `offsetX/offsetY` from the section; reports hover via `onHoverChange`. Pointer math reuses the tested `normalizePointer`.

**Files:**
- Modify: `src/components/sections/SkillConstellation/Constellation.tsx` (replace the `NodeProps` interface and `SkillNode` function)

- [ ] **Step 1: Replace the `NodeProps` interface**

Replace the existing `interface NodeProps { ... }` block with:

```tsx
interface NodeProps {
  id: string;
  x: number;
  y: number;
  size: number;
  active: boolean;
  name: string;
  role: string;
  years?: number;
  brand: string;
  iconPath: string | undefined;
  /** Parallax translate (px) from section pointer + this node's depth. */
  offsetX: number;
  offsetY: number;
  /** When false (reduced motion), tilt + magnet + parallax are disabled. */
  motionEnabled: boolean;
  onHoverChange: (id: string, hovered: boolean) => void;
}
```

- [ ] **Step 2: Replace the `SkillNode` function**

Replace the entire existing `function SkillNode(...) { ... }` with:

```tsx
function SkillNode({
  id,
  x,
  y,
  size,
  active,
  name,
  role,
  years,
  brand,
  iconPath,
  offsetX,
  offsetY,
  motionEnabled,
  onHoverChange,
}: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 0, my: 0 });
  const lit = active || hovered;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!motionEnabled) return;
    const { x: nx, y: ny } = normalizePointer(
      e.clientX,
      e.clientY,
      e.currentTarget.getBoundingClientRect(),
    );
    setTilt({
      rx: -ny * TILT_MAX_DEG,
      ry: nx * TILT_MAX_DEG,
      mx: nx * MAGNET_MAX_PX,
      my: ny * MAGNET_MAX_PX,
    });
  };

  const enter = () => {
    setHovered(true);
    onHoverChange(id, true);
  };

  const leave = () => {
    setHovered(false);
    setTilt({ rx: 0, ry: 0, mx: 0, my: 0 });
    onHoverChange(id, false);
  };

  const tx = offsetX + (motionEnabled ? tilt.mx : 0);
  const ty = offsetY + (motionEnabled ? tilt.my : 0);

  return (
    <div
      className="absolute"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        perspective: 600,
      }}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onPointerMove={handleMove}
      data-cursor-label={name.toLowerCase()}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translate3d(${tx}px, ${ty}px, 0) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 160ms ease-out',
          willChange: 'transform',
        }}
      >
        <motion.div
          className="size-full"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={
            active
              ? { opacity: 1, scale: hovered ? 1.12 : 1 }
              : { opacity: 0, scale: 0.4 }
          }
          transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.6 }}
        >
          <button
            type="button"
            className="group relative size-full rounded-full bg-elevated border border-line flex items-center justify-center cursor-none focus:outline-none focus-visible:ring-2 focus-visible:ring-lime ring-offset-2 ring-offset-canvas"
            style={{
              boxShadow: hovered
                ? `0 0 32px -4px ${brand}`
                : '0 4px 12px rgba(0,0,0,0.3)',
              borderColor: hovered ? brand : undefined,
              transition: 'box-shadow 250ms ease, border-color 250ms ease',
            }}
            aria-label={`${name} - ${role}`}
          >
            {iconPath ? (
              <svg
                viewBox="0 0 24 24"
                style={{
                  width: size * 0.55,
                  height: size * 0.55,
                  fill: lit ? brand : 'rgba(245,245,240,0.85)',
                  filter: hovered
                    ? `drop-shadow(0 0 10px ${brand})`
                    : lit
                      ? `drop-shadow(0 0 6px ${brand}80)`
                      : 'none',
                  transition: 'fill 220ms ease, filter 220ms ease',
                }}
                aria-hidden
              >
                <path d={iconPath} />
              </svg>
            ) : (
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: size * 0.22,
                  color: lit ? brand : undefined,
                  transition: 'color 220ms ease',
                }}
              >
                {name.slice(0, 3)}
              </span>
            )}
            <span
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-12 whitespace-nowrap rounded-md border border-line bg-elevated px-2 py-1 text-[11px] font-mono text-text opacity-0 transition-opacity group-hover:opacity-100"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}
            >
              <span style={{ color: brand }}>●</span> {name}
              <span className="text-muted ml-2">
                {role}
                {years ? ` · ${years}y` : ''}
              </span>
            </span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output. (The `SkillNode` call site still passes the old props — TypeScript will now error on the missing `id`/`offsetX`/`offsetY`/`motionEnabled`/`onHoverChange` props. If so, that error is expected and is fixed in Task 4 Step 2. If you want a clean typecheck before committing, do Task 4 Step 2 before this commit; otherwise commit and proceed — the call site is updated next task.)

To keep commits green, **proceed to Task 4 Step 2 now**, then return here for Step 4.

- [ ] **Step 4: Commit (after Task 4 Step 2 makes the call site match)**

```bash
git add src/components/sections/SkillConstellation/Constellation.tsx
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(constellation): brand-color ignite + magnetic 3D hover on nodes"
```

---

### Task 4: Render wiring — node call site, parallax, path-highlight overlay

**Files:**
- Modify: `src/components/sections/SkillConstellation/Constellation.tsx` (the `card` memo area, the root `<div>`, the SVG, and the `geo.nodes.map` block)

- [ ] **Step 1: Add the highlight memo**

Directly after the existing `const card = useMemo(...)` block (before `if (!geo) {`), add:

```tsx
  // ── Path segment lit around the hovered node ─────────────────
  const highlight = useMemo(() => {
    if (!geo || !hoveredId || realLength <= 0) return null;
    const hn = geo.nodes.find((n) => n.id === hoveredId);
    if (!hn) return null;
    return {
      dash: highlightDash(realLength, hn.pathFraction, HIGHLIGHT_WINDOW_PX),
      brand: hn.skill.brand,
    };
  }, [geo, hoveredId, realLength]);
```

- [ ] **Step 2: Update the root container + node map**

Find the outer return's root element:

```tsx
    <div ref={containerRef} className="relative w-full" style={{ height: geo.height }}>
```

Replace it with:

```tsx
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: geo.height }}
      onPointerMove={handleSectionPointerMove}
      onPointerLeave={handleSectionPointerLeave}
    >
```

Then find the `{/* Nodes */}` block:

```tsx
      {/* Nodes */}
      {geo.nodes.map((n) => {
        const active = progress >= n.pathFraction;
        const iconPath = getIconPath(n.id);
        return (
          <SkillNode
            key={n.id}
            x={n.x}
            y={n.y}
            size={nodeSize}
            active={active}
            name={n.skill.name}
            role={n.skill.role}
            years={n.skill.years}
            brand={n.skill.brand}
            iconPath={iconPath}
          />
        );
      })}
```

Replace it with:

```tsx
      {/* Nodes */}
      {geo.nodes.map((n, idx) => {
        const active = progress >= n.pathFraction;
        const iconPath = getIconPath(n.id);
        const factor = motionEnabled ? depthFactor(idx) : 0;
        return (
          <SkillNode
            key={n.id}
            id={n.id}
            x={n.x}
            y={n.y}
            size={nodeSize}
            active={active}
            name={n.skill.name}
            role={n.skill.role}
            years={n.skill.years}
            brand={n.skill.brand}
            iconPath={iconPath}
            offsetX={-pointer.x * factor * PARALLAX_MAX_PX}
            offsetY={-pointer.y * factor * PARALLAX_MAX_PX}
            motionEnabled={motionEnabled}
            onHoverChange={handleHoverChange}
          />
        );
      })}
```

- [ ] **Step 3: Add parallax to the SVG layer + the highlight overlay path**

Find the `<svg ... className="absolute inset-0 pointer-events-none" aria-hidden>` opening tag and add a `style` with the path parallax transform:

```tsx
      <svg
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        width={geo.width}
        height={geo.height}
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate3d(${-pointer.x * PATH_DEPTH * PARALLAX_MAX_PX}px, ${-pointer.y * PATH_DEPTH * PARALLAX_MAX_PX}px, 0)`,
          transition: 'transform 160ms ease-out',
        }}
        aria-hidden
      >
```

Then, inside that `<svg>`, directly after the closing `/>` of the "Animated drawn path" `<path ref={pathRef} ... />`, add the highlight overlay:

```tsx
        {/* Brand-tinted segment around the hovered node */}
        {highlight && (
          <path
            d={geo.d}
            fill="none"
            stroke={highlight.brand}
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              strokeDasharray: highlight.dash.dasharray,
              strokeDashoffset: highlight.dash.dashoffset,
              filter: `drop-shadow(0 0 6px ${highlight.brand})`,
              opacity: 0.9,
            }}
          />
        )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no output (call site now matches the new `NodeProps`; `SkillNode` from Task 3 is fully consistent).

Run: `pnpm exec biome check src/components/sections/SkillConstellation/Constellation.tsx`
Expected: only the file's pre-existing warnings (`noSvgWithoutTitle`, formatter notes that existed before this work). No new errors.

- [ ] **Step 5: Commit (this also satisfies Task 3 Step 4 — single green commit)**

```bash
git add src/components/sections/SkillConstellation/Constellation.tsx
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "feat(constellation): parallax depth + hovered-node path highlight"
```

> Note: Task 3 and Task 4 modify the same file and only typecheck cleanly together. If you committed nothing between them, this single commit covers both. If you committed Task 2 separately (clean), that is fine — Tasks 3+4 land as one consistent commit here.

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit suite**

Run: `pnpm test`
Expected: all suites pass, including `src/components/sections/SkillConstellation/interaction.test.ts` and the existing `functions/_lib/*.test.ts`. Confirm "passed" with zero failures.

- [ ] **Step 2: Typecheck the project**

Run: `pnpm run typecheck`
Expected: `astro check` reports 0 errors. (Pre-existing hints/warnings unrelated to these files are acceptable; 0 *errors* is the bar.)

- [ ] **Step 3: Lint the touched files**

Run: `pnpm exec biome check src/components/sections/SkillConstellation/interaction.ts src/components/sections/SkillConstellation/interaction.test.ts`
Expected: clean.

Run: `pnpm exec biome check src/components/sections/SkillConstellation/Constellation.tsx`
Expected: only the pre-existing warnings that were present before this work (the SVG `noSvgWithoutTitle` and formatter notes). Confirm no NEW diagnostics were introduced by these changes (compare against `git stash`/`git show HEAD~4` if unsure). Do not fix pre-existing debt in this plan.

- [ ] **Step 4: Manual verification via dev HMR**

Run: `pnpm dev`
Open the site, scroll to the Stack (Skill Constellation) section, and confirm each item:

  - [ ] As you scroll and the line crosses each icon, that icon **transitions into its brand color** with a soft glow (e.g. Docker blue, NGINX green) and stays lit. It is neutral grey before the line reaches it.
  - [ ] Hovering a lit node makes it **lean in 3D toward the cursor** and **drift slightly** toward it; it springs back to rest on leave.
  - [ ] Hovering **brightens a short segment of the connecting path** around that node in the node's brand color; it disappears when you move off.
  - [ ] Moving the mouse across the section makes the field **parallax in depth** (nodes shift, nearer layers move more than farther) and the path shifts with it; everything recenters when the pointer leaves the section.
  - [ ] No console errors; motion is smooth (no janky reflow).
  - [ ] Enable OS "Reduce Motion" (or emulate `prefers-reduced-motion: reduce` in devtools): parallax and tilt/drift are **off**, but icons still ignite to brand color on scroll and still scale/glow on hover.
  - [ ] On a touch viewport (devtools device mode), the section renders normally with no hover/parallax artifacts.

- [ ] **Step 5: Final commit (only if Step 3/4 required a fix)**

If a verification step surfaced a defect, fix it, re-run Steps 1-4, then:

```bash
git add -A
git commit --author="v9dev <99959044+v9dev@users.noreply.github.com>" -m "fix(constellation): address interactive-polish verification findings"
```

If nothing needed fixing, no commit — the feature is complete on the Task 4 commit.

---

## Plan Self-Review

- **Spec coverage:**
  - Spec §1 Magnetic 3D hover → Task 3 (tilt + magnet, `motionEnabled` gate, spring-back on leave).
  - Spec §2 Path-segment highlight → Task 1 (`highlightDash`) + Task 4 (`highlight` memo + overlay path, `onHoverChange` lift).
  - Spec §3 Brand-color ignite on path crossing → Task 3 (`lit = active || hovered`, eased fill/filter 220ms, applies under reduced motion).
  - Spec §4 Constellation parallax depth → Task 1 (`depthFactor`, `normalizePointer`) + Task 2 (pointer state, rAF throttle, reduced-motion gate) + Task 4 (per-node `offsetX/offsetY`, `PATH_DEPTH` SVG transform).
  - Spec "reduced motion / input safety" → Task 2 gate + Task 3/4 `motionEnabled` usage; manual checks in Task 5 Step 4.
  - Spec "files touched" matches: `Constellation.tsx` modified; `path.ts` untouched (confirmed — `pathFraction`/`d`/`pathLength` already exposed); `interaction.ts` added (not in original spec file list but a clean decomposition of testable math — noted here intentionally).
- **Placeholder scan:** none — every code step contains complete code; every command has expected output.
- **Type consistency:** `NodeProps` (Task 3) ↔ `SkillNode` call site (Task 4) prop names match exactly: `id, x, y, size, active, name, role, years, brand, iconPath, offsetX, offsetY, motionEnabled, onHoverChange`. `depthFactor`/`normalizePointer`/`highlightDash` signatures (Task 1) match their use in Tasks 2-4. `handleHoverChange`/`handleSectionPointerMove`/`handleSectionPointerLeave`/`pointer`/`motionEnabled` defined in Task 2, consumed in Task 4. Cross-file commit ordering note added (Tasks 3+4 land together) to keep every commit green.
