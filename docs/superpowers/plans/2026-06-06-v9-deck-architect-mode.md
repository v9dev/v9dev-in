# v9 Deck - Architect mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the deck terminal game into "Architect" mode - pick the right cards from a tray of real-and-decoy options, wire freely (wrong wires rejected + penalized), chase a graded score, across 6 levels.

**Architecture:** Same single-`useReducer` engine. Pure modules (`board.ts`, `scoring.ts`, `state.ts`, `architectures.ts`, `commands.ts`) are TDD'd first; the React island (`Deck.tsx`) and UI (`Tray`, `Diagram`, `Hud`, `WinPanel`, `GameMenu`) follow. Signature changes to existing pure functions are **additive** (a trailing optional `placed?` param defaulting to current behavior) so the project typechecks and all tests pass at the end of every task.

**Tech Stack:** Astro 5 + React 19 island, Tailwind v4 (`@theme` tokens), vitest, Biome. pnpm only. Spec: `docs/superpowers/specs/2026-06-06-v9-deck-architect-mode-design.md`.

**Conventions (every commit):** author `v9dev <99959044+v9dev@users.noreply.github.com>` (`git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit ...`), NO AI trailer; copy/comments use hyphens, never em-dashes (middot OK); review via `pnpm test` + `pnpm run typecheck` + dev HMR, never `pnpm build`.

**Signature note (important):** The spec writes new params as `(arch, placed, edges)` for readability. The PLAN uses a backward-compatible **trailing optional**: `bootOrder(arch, edges, placed?)`, `onlineNodes(arch, edges, placed?)`, `objectiveProgress(arch, edges, placed?)`, `isComplete(arch, edges, placed?)`. When `placed` is omitted it defaults to all node ids (today's behavior), so existing callers keep working until migrated. New callers always pass `placed`.

---

## Task 1: Engine extensions in `board.ts` (+ interface fields)

**Files:**
- Modify: `src/content/architectures.ts` (interfaces only)
- Modify: `src/components/deck/board.ts`
- Test: `src/components/deck/board.test.ts`

- [ ] **Step 1: Add the interface fields.** In `src/content/architectures.ts`:
  - In `ArchNode`, add after `col?: number;`: `  decoy?: boolean;`
  - Change `difficulty: 'easy' | 'medium' | 'hard';` to `difficulty: 'easy' | 'medium' | 'hard' | 'expert';`
  - In `Architecture`, add after `intro?: string;`: `  hints?: string[];`

- [ ] **Step 2: Write failing tests** in `src/components/deck/board.test.ts` (append). Use a tiny inline fixture so this task does not depend on the new scenario data:

```ts
import type { Architecture } from '@content/architectures';
import {
  entryCards,
  hintFor,
  isComplete,
  judgeWire,
  objectiveProgress,
} from './board';

const fix: Architecture = {
  slug: 'fix',
  title: 'Fix',
  subtitle: '',
  objective: 'test',
  difficulty: 'easy',
  hints: ['principle one', 'principle two'],
  nodes: [
    { id: 'net', label: 'Net', kind: 'external', hld: '' },
    { id: 'web', label: 'Web', kind: 'edge', hld: '' },
    { id: 'app', label: 'App', kind: 'service', hld: '' },
    { id: 'db', label: 'DB', kind: 'datastore', hld: '' },
    { id: 'fake', label: 'Fake', kind: 'service', hld: '', decoy: true },
  ],
  edges: [
    { id: 'net->web', from: 'net', to: 'web', required: true },
    { id: 'web->app', from: 'web', to: 'app', required: true },
    { id: 'app->db', from: 'app', to: 'db', required: true },
  ],
};
const ALL = fix.nodes.map((n) => n.id);
const REAL = fix.nodes.filter((n) => !n.decoy).map((n) => n.id);

describe('entryCards', () => {
  it('returns non-decoy sources (external/client) only', () => {
    expect(entryCards(fix)).toEqual(['net']);
  });
});

describe('judgeWire', () => {
  it('accepts a required edge between placed nodes', () => {
    expect(judgeWire(fix, REAL, 'net', 'web')).toEqual({ ok: true });
  });
  it('rejects a self-wire without penalty', () => {
    expect(judgeWire(fix, REAL, 'web', 'web')).toMatchObject({ ok: false, penalize: false });
  });
  it('rejects when a card is not placed, without penalty', () => {
    expect(judgeWire(fix, ['net'], 'net', 'web')).toMatchObject({ ok: false, penalize: false });
  });
  it('penalizes a datastore-initiated wire with a reason', () => {
    const v = judgeWire(fix, REAL, 'db', 'app');
    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ penalize: true });
    expect((v as { reason: string }).reason).toMatch(/datastore/i);
  });
  it('penalizes exposing a datastore to a source', () => {
    const v = judgeWire(fix, REAL, 'net', 'db');
    expect(v).toMatchObject({ ok: false, penalize: true });
    expect((v as { reason: string }).reason).toMatch(/expose/i);
  });
  it('penalizes a wire to/from a decoy', () => {
    const v = judgeWire(fix, ALL, 'web', 'fake');
    expect(v).toMatchObject({ ok: false, penalize: true });
    expect((v as { reason: string }).reason).toMatch(/no role/i);
  });
  it('penalizes a plausible-but-wrong wire', () => {
    const v = judgeWire(fix, REAL, 'net', 'app');
    expect(v).toMatchObject({ ok: false, penalize: true });
    expect((v as { reason: string }).reason).toMatch(/not part of this design/i);
  });
});

describe('objectiveProgress with placed', () => {
  it('reports missing cards and decoys on board', () => {
    const p = objectiveProgress(fix, [{ id: 'net->web', from: 'net', to: 'web', required: false }], ['net', 'web', 'fake']);
    expect(p.missingCards.sort()).toEqual(['app', 'db']);
    expect(p.decoysOnBoard).toEqual(['fake']);
  });
});

describe('isComplete with placed', () => {
  const wired = fix.edges.map((e) => ({ ...e, required: false }));
  it('is false while a decoy is on the board', () => {
    expect(isComplete(fix, wired, ALL)).toBe(false);
  });
  it('is true with exactly the real cards, all wires, no decoys', () => {
    expect(isComplete(fix, wired, REAL)).toBe(true);
  });
  it('is false when a required card is missing', () => {
    expect(isComplete(fix, wired, ['net', 'web', 'app'])).toBe(false);
  });
});

describe('hintFor', () => {
  const base = { archSlug: 'fix', placed: REAL, edges: [], hintsUsed: 0 } as never;
  it('nudges to drop a decoy when one is placed', () => {
    const s = { ...(base as object), placed: ALL } as never;
    expect(hintFor(fix, s).toLowerCase()).toContain('no role');
  });
  it('nudges about a missing piece when a card is missing', () => {
    const s = { ...(base as object), placed: ['net', 'web'] } as never;
    expect(hintFor(fix, s).toLowerCase()).toContain('missing');
  });
  it('cycles authored principle hints when wires are missing, never the answer', () => {
    const s0 = { ...(base as object), placed: REAL, edges: [], hintsUsed: 0 } as never;
    expect(hintFor(fix, s0)).toBe('principle one');
    const s1 = { ...(base as object), placed: REAL, edges: [], hintsUsed: 1 } as never;
    expect(hintFor(fix, s1)).toBe('principle two');
    expect(hintFor(fix, s0)).not.toMatch(/connect /);
  });
});
```

- [ ] **Step 3: Run, verify fail.** `pnpm test src/components/deck/board.test.ts` -> FAIL (entryCards/judgeWire/hintFor undefined, missingCards missing).

- [ ] **Step 4: Implement in `src/components/deck/board.ts`.**
  - Add a minimal state shape import-free type for `hintFor` (avoid importing `DeckState` to keep board free of a state-value dep). At top, add:

```ts
// hintFor only needs these fields; typing them locally keeps board.ts from
// importing the full DeckState (state.ts already type-imports board).
interface HintState {
  placed: string[];
  edges: ArchEdge[];
  hintsUsed: number;
}
```

  - Add `entryCards`:

```ts
// Cards pre-placed when a session starts: non-decoy sources (a client or
// external node). Decoys are never auto-placed even if a source kind.
export function entryCards(arch: Architecture): string[] {
  return arch.nodes
    .filter((n) => !n.decoy && (n.kind === 'external' || n.kind === 'client'))
    .map((n) => n.id);
}
```

  - Add `judgeWire` (replaces the old `canConnect` semantics; keep `canConnect` for now - it is removed in Task 8 once the UI migrates):

```ts
export type WireVerdict = { ok: true } | { ok: false; penalize: boolean; reason: string };

// Judge a wire attempt against the real design. `ok` wires (a required edge,
// both cards placed) stick; everything else is rejected. `penalize` is true
// only for a genuine wrong attempt (both cards placed, not a required edge) -
// guidance rejections (self-wire, card not placed) do not cost score.
export function judgeWire(
  arch: Architecture,
  placed: string[],
  fromId: string,
  toId: string,
): WireVerdict {
  if (fromId === toId) return { ok: false, penalize: false, reason: 'cannot wire a node to itself' };
  if (!placed.includes(fromId) || !placed.includes(toId)) {
    return { ok: false, penalize: false, reason: 'place both cards first' };
  }
  const required = arch.edges.some((e) => e.from === fromId && e.to === toId);
  if (required) return { ok: true };
  const from = arch.nodes.find((n) => n.id === fromId);
  const to = arch.nodes.find((n) => n.id === toId);
  if (!from || !to) return { ok: false, penalize: false, reason: 'unknown node' };
  let reason: string;
  if (from.kind === 'datastore') {
    reason = `${from.label} is a datastore - it does not initiate connections`;
  } else if (to.kind === 'datastore' && (from.kind === 'client' || from.kind === 'external')) {
    reason = `do not expose ${to.label} directly to ${from.label}`;
  } else if (from.decoy || to.decoy) {
    reason = 'that card has no role in this design';
  } else {
    reason = `${from.label} -> ${to.label} is not part of this design`;
  }
  return { ok: false, penalize: true, reason };
}
```

  - Change `bootOrder` to take a trailing optional `placed`:

```ts
export function bootOrder(arch: Architecture, edges: ArchEdge[], placed?: string[]): BootResult {
  const live = placed ? arch.nodes.filter((n) => placed.includes(n.id)) : arch.nodes;
  const ids = live.map((n) => n.id);
  const idSet = new Set(ids);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (idSet.has(e.from) && idSet.has(e.to)) adj.get(e.from)?.push(e.to);
  }
  const sources = live.filter((n) => n.kind === 'external' || n.kind === 'client').map((n) => n.id);
  const seen = new Set<string>(sources);
  const order: string[] = [];
  const queue = [...sources];
  while (queue.length) {
    const cur = queue.shift() as string;
    order.push(cur);
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return { order, up: [...order], unreachable: ids.filter((id) => !seen.has(id)) };
}
```

  - Extend `Progress` and `objectiveProgress` (trailing optional `placed`):

```ts
export interface Progress {
  satisfied: number;
  total: number;
  pct: number;
  missing: ArchEdge[];
  extra: ArchEdge[];
  missingCards: string[];
  decoysOnBoard: string[];
}

export function objectiveProgress(
  arch: Architecture,
  edges: ArchEdge[],
  placed?: string[],
): Progress {
  const req = arch.edges;
  const have = new Set(edges.map((e) => e.id));
  const reqIds = new Set(req.map((e) => e.id));
  const missing = req.filter((e) => !have.has(e.id));
  const satisfied = req.length - missing.length;
  const extra = edges.filter((e) => !reqIds.has(e.id));
  const total = req.length;
  const placedSet = new Set(placed ?? arch.nodes.map((n) => n.id));
  const missingCards = arch.nodes.filter((n) => !n.decoy && !placedSet.has(n.id)).map((n) => n.id);
  const decoysOnBoard = arch.nodes.filter((n) => n.decoy && placedSet.has(n.id)).map((n) => n.id);
  return {
    satisfied,
    total,
    pct: total === 0 ? 100 : Math.round((satisfied / total) * 100),
    missing,
    extra,
    missingCards,
    decoysOnBoard,
  };
}
```

  - Rewrite `isComplete` (trailing optional `placed`):

```ts
export function isComplete(arch: Architecture, edges: ArchEdge[], placed?: string[]): boolean {
  const p = objectiveProgress(arch, edges, placed);
  return (
    p.satisfied === p.total &&
    p.missingCards.length === 0 &&
    p.decoysOnBoard.length === 0 &&
    bootOrder(arch, edges, placed).unreachable.length === 0
  );
}
```

  - Replace `nextHint` with `hintFor` (delete `nextHint`; it is unused after Task 6):

```ts
// A vague, state-aware nudge - never the exact wire. Tiers: drop a stray decoy,
// add a missing piece, an authored architectural principle while wiring, else
// "looks wired".
export function hintFor(arch: Architecture, state: HintState): string {
  const p = objectiveProgress(arch, state.edges, state.placed);
  if (p.decoysOnBoard.length > 0) {
    return 'one of the cards you placed has no role in this design - drop it';
  }
  if (p.missingCards.length > 0) {
    return 'the design is missing a piece - check the tray for what belongs';
  }
  if (p.satisfied < p.total) {
    const hints = arch.hints ?? [];
    if (hints.length > 0) return hints[state.hintsUsed % hints.length];
    return "traffic flows source -> edge -> service -> data; follow the chain that isn't wired yet";
  }
  return 'looks wired - type boot';
}
```

  - Update `onlineNodes` to a trailing optional `placed`:

```ts
export function onlineNodes(arch: Architecture, edges: ArchEdge[], placed?: string[]): Set<string> {
  const have = new Set(edges.map((e) => e.id));
  const live = placed ? new Set(placed) : new Set(arch.nodes.map((n) => n.id));
  const online = new Set<string>();
  for (const node of arch.nodes) {
    if (!live.has(node.id)) continue;
    const requiredIn = arch.edges.filter((e) => e.to === node.id && e.required);
    if (requiredIn.every((e) => have.has(e.id))) online.add(node.id);
  }
  return online;
}
```

- [ ] **Step 5: Run.** `pnpm test src/components/deck/board.test.ts` -> PASS. Then `pnpm test src/content src/components/deck` -> all PASS (existing board/state/commands/architectures suites unaffected: `canConnect` kept, default `placed` preserves behavior). `pnpm run typecheck` -> 0 errors. `pnpm exec biome check src/components/deck/board.ts src/components/deck/board.test.ts src/content/architectures.ts` -> clean.

- [ ] **Step 6: Commit.**

```bash
git add src/components/deck/board.ts src/components/deck/board.test.ts src/content/architectures.ts
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): board engine for architect mode - judgeWire, entryCards, hintFor, placed-aware boot/progress"
```

---

## Task 2: Scoring module `scoring.ts`

**Files:**
- Create: `src/components/deck/scoring.ts`
- Test: `src/components/deck/scoring.test.ts`

- [ ] **Step 1: Write failing tests** in `src/components/deck/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Architecture } from '@content/architectures';
import { SCORE, scoreState } from './scoring';

const arch: Architecture = {
  slug: 's',
  title: 'S',
  subtitle: '',
  objective: 'o',
  difficulty: 'easy',
  nodes: [
    { id: 'a', label: 'A', kind: 'external', hld: '' },
    { id: 'b', label: 'B', kind: 'service', hld: '' },
  ],
  edges: [
    { id: 'a->b', from: 'a', to: 'b', required: true },
    { id: 'b->a', from: 'b', to: 'a', required: true },
  ],
};
const st = (over: Partial<{ edges: typeof arch.edges; wrongWires: number; hintsUsed: number; decoyAdds: number; placed: string[] }>) =>
  ({ edges: [], wrongWires: 0, hintsUsed: 0, decoyAdds: 0, placed: ['a', 'b'], ...over }) as never;

describe('scoreState', () => {
  it('a perfect full wiring earns max and grade S', () => {
    const r = scoreState(arch, st({ edges: arch.edges }));
    expect(r.score).toBe(2 * SCORE.CORRECT_WIRE);
    expect(r.max).toBe(2 * SCORE.CORRECT_WIRE);
    expect(r.perfect).toBe(true);
    expect(r.grade).toBe('S');
  });
  it('subtracts penalties and floors at zero', () => {
    const r = scoreState(arch, st({ wrongWires: 100 }));
    expect(r.score).toBe(0);
    expect(r.perfect).toBe(false);
  });
  it('penalties drop the grade below S even at full wiring', () => {
    const r = scoreState(arch, st({ edges: arch.edges, hintsUsed: 1 }));
    expect(r.perfect).toBe(false);
    expect(r.grade).not.toBe('S');
    expect(r.breakdown).toEqual({
      correct: 2 * SCORE.CORRECT_WIRE,
      wrong: 0,
      hints: SCORE.HINT,
      decoys: 0,
    });
  });
});
```

- [ ] **Step 2: Run, verify fail.** `pnpm test src/components/deck/scoring.test.ts` -> FAIL (module not found).

- [ ] **Step 3: Implement `src/components/deck/scoring.ts`:**

```ts
import type { Architecture } from '@content/architectures';
import { objectiveProgress } from './board';
import type { DeckState } from './state';

// Score weights. Tunable - keep the math in one place.
export const SCORE = {
  CORRECT_WIRE: 100,
  WRONG_WIRE: 50,
  HINT: 40,
  DECOY_ADD: 40,
} as const;

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export interface ScoreResult {
  score: number;
  max: number;
  grade: Grade;
  perfect: boolean;
  breakdown: { correct: number; wrong: number; hints: number; decoys: number };
}

// Pure performance grade for the live state. Win is decided by board.isComplete,
// NOT by score; this only grades the run.
export function scoreState(
  arch: Architecture,
  state: Pick<DeckState, 'edges' | 'placed' | 'wrongWires' | 'hintsUsed' | 'decoyAdds'>,
): ScoreResult {
  const p = objectiveProgress(arch, state.edges, state.placed);
  const correct = p.satisfied * SCORE.CORRECT_WIRE;
  const wrong = state.wrongWires * SCORE.WRONG_WIRE;
  const hints = state.hintsUsed * SCORE.HINT;
  const decoys = state.decoyAdds * SCORE.DECOY_ADD;
  const score = Math.max(0, correct - wrong - hints - decoys);
  const max = p.total * SCORE.CORRECT_WIRE;
  const perfect = state.wrongWires === 0 && state.hintsUsed === 0 && state.decoyAdds === 0;
  const ratio = max === 0 ? 0 : score / max;
  const grade: Grade =
    perfect && p.satisfied === p.total
      ? 'S'
      : ratio >= 0.9
        ? 'A'
        : ratio >= 0.75
          ? 'B'
          : ratio >= 0.5
            ? 'C'
            : 'D';
  return { score, max, grade, perfect, breakdown: { correct, wrong, hints, decoys } };
}
```

Note: `scoring.ts` imports `DeckState` (type-only) from `state.ts`, which is added in Task 3. To keep this task green, the `Pick<DeckState, ...>` requires those fields on `DeckState`. **Reorder safety:** the `placed`/`wrongWires`/`decoyAdds` fields do not exist on `DeckState` until Task 3. So this test would fail to typecheck. To avoid that, in this task DEFINE the input type locally instead of `Pick<DeckState,...>`:

```ts
export interface ScoreInput {
  edges: { id: string }[];
  placed: string[];
  wrongWires: number;
  hintsUsed: number;
  decoyAdds: number;
}
```
and type the param `state: ScoreInput`. (Task 3/6 pass the real `DeckState`, which is structurally compatible.) Remove the `DeckState` import. Adjust `objectiveProgress(arch, state.edges, state.placed)` accordingly - `edges` is `ArchEdge[]`; widen `ScoreInput.edges` to `import('@content/architectures').ArchEdge[]`.

Final import line: `import type { ArchEdge, Architecture } from '@content/architectures';` and `edges: ArchEdge[]` in `ScoreInput`.

- [ ] **Step 4: Run.** `pnpm test src/components/deck/scoring.test.ts` -> PASS. `pnpm run typecheck` -> 0 errors. `pnpm exec biome check src/components/deck/scoring.ts src/components/deck/scoring.test.ts` -> clean.

- [ ] **Step 5: Commit.**

```bash
git add src/components/deck/scoring.ts src/components/deck/scoring.test.ts
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): pure scoreState + SCORE weights with S-A-B-C-D grade"
```

---

## Task 3: State - placed, card actions, counters

**Files:**
- Modify: `src/components/deck/state.ts`
- Test: `src/components/deck/state.test.ts`

- [ ] **Step 1: Write failing tests** (append to `src/components/deck/state.test.ts`):

```ts
describe('architect-mode state', () => {
  it('PLAY seeds placed with entry cards and zeroes wrong/decoy counters', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    expect(s.placed).toEqual(['internet', 'mailclient']); // stalwart non-decoy sources
    expect(s.edges).toHaveLength(0);
    expect(s.wrongWires).toBe(0);
    expect(s.decoyAdds).toBe(0);
  });
  it('ADD_CARD places a card, counts a move, and bumps decoyAdds only for a decoy', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'ADD_CARD', id: 'nginx', decoy: false });
    expect(s.placed).toContain('nginx');
    expect(s.moves).toBe(1);
    expect(s.decoyAdds).toBe(0);
    const n = s.placed.length;
    s = deckReducer(s, { type: 'ADD_CARD', id: 'nginx', decoy: false }); // dup
    expect(s.placed).toHaveLength(n);
    expect(s.moves).toBe(1);
    s = deckReducer(s, { type: 'ADD_CARD', id: 'sqlite', decoy: true });
    expect(s.decoyAdds).toBe(1);
    expect(s.moves).toBe(2);
  });
  it('REMOVE_CARD drops the card and any edges touching it and counts a move', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'ADD_CARD', id: 'nginx', decoy: false });
    s = deckReducer(s, { type: 'CONNECT', from: 'internet', to: 'nginx' });
    expect(s.edges.some((e) => e.id === 'internet->nginx')).toBe(true);
    s = deckReducer(s, { type: 'REMOVE_CARD', id: 'nginx' });
    expect(s.placed).not.toContain('nginx');
    expect(s.edges.some((e) => e.id === 'internet->nginx')).toBe(false);
  });
  it('WRONG_WIRE bumps wrongWires only (no edge, no move)', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    const m = s.moves;
    s = deckReducer(s, { type: 'WRONG_WIRE' });
    expect(s.wrongWires).toBe(1);
    expect(s.moves).toBe(m);
    expect(s.edges).toHaveLength(0);
  });
});
```

(Note: the existing CONNECT test arms `nginx` then connects `mailclient->nginx`; with placed-gating off in the reducer this still passes - the reducer does not check `placed` for CONNECT, the island's judgeWire does. Keep existing tests as-is.)

- [ ] **Step 2: Run, verify fail.** `pnpm test src/components/deck/state.test.ts` -> FAIL.

- [ ] **Step 3: Implement in `src/components/deck/state.ts`.**
  - Import `entryCards`: at top add `import { entryCards } from './board';`
  - Add fields to `DeckState` (after `armedFrom`): `placed: string[];` and after `hintsUsed`: `wrongWires: number;` `decoyAdds: number;`
  - Add to `DeckAction` union: `| { type: 'ADD_CARD'; id: string; decoy: boolean }` `| { type: 'REMOVE_CARD'; id: string }` `| { type: 'WRONG_WIRE' }`
  - In `initDeckState`, add `placed: [],` (after `armedFrom: null,`) and `wrongWires: 0,` `decoyAdds: 0,` (near `hintsUsed: 0,`).
  - In `startSession`, set `placed: entryCards(arch),` and `wrongWires: 0,` `decoyAdds: 0,` in the returned object (it spreads `initDeckState(arch)` then overrides - add these overrides).
  - Add reducer cases:

```ts
    case 'ADD_CARD': {
      if (state.placed.includes(action.id)) return state;
      return {
        ...state,
        placed: [...state.placed, action.id],
        moves: state.moves + 1,
        decoyAdds: action.decoy ? state.decoyAdds + 1 : state.decoyAdds,
        boot: { running: false, up: [], unreachable: [] },
      };
    }
    case 'REMOVE_CARD':
      return {
        ...state,
        placed: state.placed.filter((id) => id !== action.id),
        edges: state.edges.filter((e) => e.from !== action.id && e.to !== action.id),
        moves: state.moves + 1,
        boot: { running: false, up: [], unreachable: [] },
      };
    case 'WRONG_WIRE':
      return { ...state, wrongWires: state.wrongWires + 1 };
```

- [ ] **Step 4: Run.** `pnpm test src/components/deck/state.test.ts` -> PASS. `pnpm test src/components/deck src/content` -> all PASS. `pnpm run typecheck` -> 0 errors. `pnpm exec biome check src/components/deck/state.ts src/components/deck/state.test.ts` -> clean.

- [ ] **Step 5: Commit.**

```bash
git add src/components/deck/state.ts src/components/deck/state.test.ts
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): state for architect mode - placed cards, ADD_CARD/REMOVE_CARD/WRONG_WIRE, counters"
```

---

## Task 4: Scenario data - decoys + two new levels

**Files:**
- Modify: `src/content/architectures.ts`
- Test: `src/content/architectures.test.ts`

- [ ] **Step 1: Update `src/content/architectures.test.ts`** to the new contract:

```ts
import { bootOrder, entryCards, judgeWire } from '@components/deck/board';
import { describe, expect, it } from 'vitest';
import { architectures } from './architectures';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;

describe('architectures (game scenarios)', () => {
  it('exposes at least 6 scenarios', () => {
    expect(architectures.length).toBeGreaterThanOrEqual(6);
  });

  for (const arch of architectures) {
    describe(arch.slug, () => {
      const real = arch.nodes.filter((n) => !n.decoy).map((n) => n.id);

      it('has a non-empty objective', () => {
        expect(arch.objective.trim().length).toBeGreaterThan(0);
      });
      it('has a difficulty within the union', () => {
        expect(DIFFICULTIES).toContain(arch.difficulty);
      });
      it('has at least one decoy card', () => {
        expect(arch.nodes.some((n) => n.decoy)).toBe(true);
      });
      it('no edge references a decoy', () => {
        const decoys = new Set(arch.nodes.filter((n) => n.decoy).map((n) => n.id));
        for (const e of arch.edges) {
          expect(decoys.has(e.from)).toBe(false);
          expect(decoys.has(e.to)).toBe(false);
        }
      });
      it('every edge references real node ids', () => {
        const ids = new Set(arch.nodes.map((n) => n.id));
        for (const e of arch.edges) {
          expect(ids.has(e.from)).toBe(true);
          expect(ids.has(e.to)).toBe(true);
        }
      });
      it('has at least one entry card', () => {
        expect(entryCards(arch).length).toBeGreaterThan(0);
      });
      it('the real topology boots every real node (no unreachable)', () => {
        expect(bootOrder(arch, arch.edges, real).unreachable).toEqual([]);
      });
      it('every required edge is recreatable via judgeWire', () => {
        for (const e of arch.edges) {
          expect(judgeWire(arch, real, e.from, e.to)).toEqual({ ok: true });
        }
      });
    });
  }
});
```

- [ ] **Step 2: Run, verify fail.** `pnpm test src/content/architectures.test.ts` -> FAIL (only 4 scenarios, no decoys).

- [ ] **Step 3: Add decoys to the existing four scenarios** in `src/content/architectures.ts`. Append each decoy node to that scenario's `nodes` array (no new edges). Keep the existing `detail` pattern minimal - a one-line `hld`, an optional `detail` is fine to omit for decoys (the drawer handles a missing detail).

  - **stalwart** nodes: add
```ts
    {
      id: 'dovecot',
      label: 'Dovecot',
      kind: 'service',
      accent: '#2f7df6',
      abbr: 'DVC',
      col: 2,
      decoy: true,
      hld: 'Standalone IMAP/POP3 server - redundant here; Stalwart already speaks IMAP/JMAP',
    },
```
  - **cockpit** nodes: add
```ts
    {
      id: 'grafana',
      label: 'Grafana',
      kind: 'service',
      skillId: 'grafana',
      col: 2,
      decoy: true,
      hld: 'Dashboards for a metrics database - this lightweight fleet has no Prometheus to feed it',
    },
    {
      id: 'prometheus',
      label: 'Prometheus',
      kind: 'service',
      accent: '#e6522c',
      abbr: 'PRM',
      col: 2,
      decoy: true,
      hld: 'Time-series metrics store - not part of this Uptime-Kuma / Beszel stack',
    },
```
  - **webstack** nodes: add
```ts
    {
      id: 'mysql',
      label: 'MySQL',
      kind: 'datastore',
      skillId: 'mysql',
      col: 3,
      decoy: true,
      hld: 'A second relational store - Postgres is already the primary; not needed',
    },
    {
      id: 'memcached',
      label: 'Memcached',
      kind: 'datastore',
      accent: '#1d8fc9',
      abbr: 'MMC',
      col: 3,
      decoy: true,
      hld: 'A cache - Redis already covers caching + sessions here',
    },
```
  - **ci** nodes: add
```ts
    {
      id: 'sonarqube',
      label: 'SonarQube',
      kind: 'service',
      accent: '#4e9bcd',
      abbr: 'SQ',
      col: 2,
      decoy: true,
      hld: 'Static-analysis quality gate - optional; not part of this minimal push-to-deploy chain',
    },
    {
      id: 'slack',
      label: 'Slack',
      kind: 'external',
      accent: '#611f69',
      abbr: 'SLK',
      col: 4,
      decoy: true,
      hld: 'Deploy notifications - a nice add-on, but not required to ship',
    },
```
  Note: `slack` is `kind: 'external'` but `decoy: true`, so `entryCards` excludes it (decoys never auto-place). Good distractor since it looks like a sink.

- [ ] **Step 4: Add `hints` arrays** (vague principles, never the exact wire) to each existing scenario, right after its `intro`:
  - stalwart: `hints: ['the proxy only fronts the web side - mail protocols hit the server directly', 'metadata needs somewhere to live'],`
  - cockpit: `hints: ['everything public goes through one front door', 'a couple of tools read the Docker socket directly, not via the proxy'],`
  - webstack: `hints: ['the edge talks to the proxy, never straight to the app', 'the app owns its data - the edge never touches a store'],`
  - ci: `hints: ['each stage hands off to exactly the next one', 'images live somewhere between build and deploy'],`

- [ ] **Step 5: Add the two new scenarios** before the `export const architectures` line:

```ts
const media: Architecture = {
  slug: 'media',
  title: 'Self-hosted Media Stack',
  subtitle: 'Jellyfin + an *arr downloader behind one proxy',
  objective: 'Stand up the self-hosted media stack',
  difficulty: 'hard',
  intro: 'A reverse proxy, a media server, a library manager, a downloader, and one big disk.',
  hints: [
    'the proxy fronts the user-facing apps, not the storage',
    'the library manager drives the downloader, and both write to the same disk',
    'the media server only reads from storage',
  ],
  nodes: [
    { id: 'internet', label: 'Internet', kind: 'external', accent: '#3ae0ff', abbr: 'NET', col: 0, hld: 'Public DNS + TLS in front of the stack' },
    { id: 'nginx', label: 'nginx', kind: 'edge', skillId: 'nginx', col: 1, hld: 'Reverse proxy + TLS for the web apps' },
    { id: 'jellyfin', label: 'Jellyfin', kind: 'service', accent: '#a85cc3', abbr: 'JFN', col: 2, hld: 'Media server - streams the library to clients' },
    { id: 'sonarr', label: 'Sonarr', kind: 'service', accent: '#3a8cff', abbr: 'SNR', col: 2, hld: 'Library manager - watches for releases and drives the downloader' },
    { id: 'qbittorrent', label: 'qBittorrent', kind: 'service', accent: '#2f67ba', abbr: 'QBT', col: 3, hld: 'Download client - fetches and saves to disk' },
    { id: 'nas', label: 'NAS Storage', kind: 'datastore', accent: '#b8ff3a', abbr: 'NAS', col: 4, hld: 'Bulk disk - the media library and downloads live here' },
    { id: 'plex', label: 'Plex', kind: 'service', accent: '#e5a00d', abbr: 'PLX', col: 2, decoy: true, hld: 'Alternative media server - Jellyfin already fills this role' },
    { id: 'mysql', label: 'MySQL', kind: 'datastore', skillId: 'mysql', col: 4, decoy: true, hld: 'A relational DB - the *arr apps keep their own state; media lives on the NAS' },
    { id: 'ftp', label: 'FTP', kind: 'client', accent: '#ff3a8c', abbr: 'FTP', col: 0, decoy: true, hld: 'Legacy file transfer - nothing in this stack speaks to it' },
  ],
  edges: [
    { id: 'internet->nginx', from: 'internet', to: 'nginx', protocol: 'HTTPS', required: true },
    { id: 'nginx->jellyfin', from: 'nginx', to: 'jellyfin', protocol: 'HTTP', required: true },
    { id: 'nginx->sonarr', from: 'nginx', to: 'sonarr', protocol: 'HTTP', required: true },
    { id: 'jellyfin->nas', from: 'jellyfin', to: 'nas', protocol: 'read', required: true },
    { id: 'sonarr->qbittorrent', from: 'sonarr', to: 'qbittorrent', protocol: 'control', required: true },
    { id: 'sonarr->nas', from: 'sonarr', to: 'nas', protocol: 'write', required: true },
    { id: 'qbittorrent->nas', from: 'qbittorrent', to: 'nas', protocol: 'write', required: true },
  ],
};

const microservices: Architecture = {
  slug: 'microservices',
  title: 'Microservices + Queue',
  subtitle: 'Gateway, services, a broker, a worker, two stores',
  objective: 'Wire the microservices platform',
  difficulty: 'expert',
  intro: 'An API gateway fronts three services; orders go async via a broker to a worker.',
  hints: [
    'one front door routes to every service',
    'auth keeps its sessions hot; the business services persist to the relational store',
    'orders go async - through the broker to a worker, which writes the result',
  ],
  nodes: [
    { id: 'internet', label: 'Internet', kind: 'external', accent: '#3ae0ff', abbr: 'NET', col: 0, hld: 'Public traffic enters here' },
    { id: 'gateway', label: 'API Gateway', kind: 'edge', skillId: 'nginx', abbr: 'GW', col: 1, hld: 'Single entry - routes + TLS for every service' },
    { id: 'auth', label: 'Auth', kind: 'service', accent: '#b8ff3a', abbr: 'AUTH', col: 2, hld: 'Issues + validates sessions' },
    { id: 'orders', label: 'Orders', kind: 'service', accent: '#3a8cff', abbr: 'ORD', col: 2, hld: 'Order lifecycle - persists and enqueues work' },
    { id: 'payments', label: 'Payments', kind: 'service', accent: '#ffd43b', abbr: 'PAY', col: 2, hld: 'Charges + records payments' },
    { id: 'queue', label: 'RabbitMQ', kind: 'service', accent: '#ff6600', abbr: 'MQ', col: 3, hld: 'Message broker - decouples orders from the worker' },
    { id: 'worker', label: 'Worker', kind: 'service', accent: '#ff3a8c', abbr: 'WRK', col: 4, hld: 'Consumes jobs and writes results' },
    { id: 'postgres', label: 'PostgreSQL', kind: 'datastore', skillId: 'postgres', col: 5, hld: 'Relational store for business state' },
    { id: 'redis', label: 'Redis', kind: 'datastore', skillId: 'redis', col: 5, hld: 'Session + cache store for auth' },
    { id: 'mongodb', label: 'MongoDB', kind: 'datastore', skillId: 'mongodb', col: 5, decoy: true, hld: 'A document store - this platform standardizes on Postgres' },
    { id: 'memcached', label: 'Memcached', kind: 'datastore', accent: '#1d8fc9', abbr: 'MMC', col: 5, decoy: true, hld: 'A cache - Redis already covers caching here' },
    { id: 'graphql', label: 'GraphQL BFF', kind: 'service', skillId: 'graphql', abbr: 'GQL', col: 2, decoy: true, hld: 'A backend-for-frontend - the gateway already routes REST; not in this design' },
  ],
  edges: [
    { id: 'internet->gateway', from: 'internet', to: 'gateway', protocol: 'HTTPS', required: true },
    { id: 'gateway->auth', from: 'gateway', to: 'auth', protocol: 'HTTP', required: true },
    { id: 'gateway->orders', from: 'gateway', to: 'orders', protocol: 'HTTP', required: true },
    { id: 'gateway->payments', from: 'gateway', to: 'payments', protocol: 'HTTP', required: true },
    { id: 'auth->redis', from: 'auth', to: 'redis', protocol: 'RESP', required: true },
    { id: 'orders->postgres', from: 'orders', to: 'postgres', protocol: 'SQL', required: true },
    { id: 'payments->postgres', from: 'payments', to: 'postgres', protocol: 'SQL', required: true },
    { id: 'orders->queue', from: 'orders', to: 'queue', protocol: 'AMQP', required: true },
    { id: 'queue->worker', from: 'queue', to: 'worker', protocol: 'AMQP', required: true },
    { id: 'worker->postgres', from: 'worker', to: 'postgres', protocol: 'SQL', required: true },
  ],
};
```

  Then change the export to: `export const architectures: Architecture[] = [stalwart, cockpit, webstack, ci, media, microservices];`

- [ ] **Step 6: Confirm skillIds resolve.** The icon map in `src/lib/icons.ts` is curated. The only `skillId`s used by new/edited nodes are `nginx`, `mysql`, `postgres`, `redis`, `mongodb`, `graphql`, `grafana` - all present in that map. Every other new brand (jellyfin, qbittorrent, plex, rabbitmq, prometheus, slack, sonarr, nas, ftp, memcached, sonarqube) intentionally uses `accent` + `abbr` (ServiceNode renders the abbr). Quick sanity grep: `grep -n "skillId:" src/content/architectures.ts` then confirm each value is a key in `src/lib/icons.ts`'s `map`. Do NOT add new simple-icons imports.

- [ ] **Step 7: Run.** `pnpm test src/content/architectures.test.ts` -> PASS. `pnpm test` (full) -> only the pre-existing `functions/_lib/validate.test.ts` fails; everything else PASS. `pnpm run typecheck` -> 0. `pnpm exec biome check src/content/architectures.ts src/content/architectures.test.ts` -> clean.

- [ ] **Step 8: Commit.**

```bash
git add src/content/architectures.ts src/content/architectures.test.ts
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): decoys + media (hard) and microservices (expert) scenarios; vague hints"
```

---

## Task 5: Commands - add/remove/cards + context-aware ls + help

**Files:**
- Modify: `src/components/deck/commands.ts`
- Test: `src/components/deck/commands.test.ts`

- [ ] **Step 1: Write failing tests** (append to `src/components/deck/commands.test.ts`). Build a ctx with a loaded arch and a tray:

```ts
import { architectureBySlug } from '@content/architectures';
// ...existing imports...
const playingCtx = { phase: 'playing', arch: architectureBySlug['stalwart-mail'] } as const;

describe('architect-mode commands', () => {
  it('parses add/remove into game verbs with the id arg', () => {
    expect(parse('add nginx', playingCtx)).toMatchObject({ kind: 'game', verb: 'add', arg: 'nginx' });
    expect(parse('remove nginx', playingCtx)).toMatchObject({ kind: 'game', verb: 'remove', arg: 'nginx' });
  });
  it('rejects add/remove for an unknown node', () => {
    expect(parse('add nope', playingCtx)).toMatchObject({ kind: 'error' });
  });
  it('add/remove require a loaded scenario', () => {
    const menu = { phase: 'menu', arch: null } as const;
    expect(parse('add nginx', menu)).toMatchObject({ kind: 'error' });
  });
  it('ls lists cards while playing, games at the menu', () => {
    expect(parse('ls', { phase: 'menu', arch: null } as const)).toMatchObject({ kind: 'print' });
    expect(parse('ls', playingCtx)).toMatchObject({ kind: 'game', verb: 'cards' });
    expect(parse('cards', playingCtx)).toMatchObject({ kind: 'game', verb: 'cards' });
  });
  it('help mentions add/remove and no longer claims hint reveals the wire', () => {
    const lines = (parse('help', playingCtx) as { lines: string[] }).lines.join('\n');
    expect(lines).toMatch(/add/);
    expect(lines).toMatch(/remove/);
    expect(lines).not.toMatch(/reveal the next required wire/);
  });
});
```

- [ ] **Step 2: Run, verify fail.** `pnpm test src/components/deck/commands.test.ts` -> FAIL.

- [ ] **Step 3: Implement in `src/components/deck/commands.ts`.**
  - Extend `GameVerb`: `export type GameVerb = 'play' | 'status' | 'hint' | 'boot' | 'menu' | 'reset' | 'add' | 'remove' | 'cards';`
  - Add to `VERBS` (after `'menu','back',`): `'add', 'remove', 'cards',`
  - Add to `GAMEPLAY_VERBS`: `'add', 'remove', 'cards'`
  - Move `ls`/`games` handling to be context-aware. Replace the always-available `case 'ls': case 'games':` block: keep `games` (and menu-phase `ls`) returning `scenarioLines()`, but when a scenario is loaded, `ls`/`cards` return a `cards` game verb. Concretely, in the first switch keep only:
```ts
    case 'games':
      return { kind: 'print', lines: scenarioLines() };
    case 'ls':
      if (ctx.phase === 'menu' || !ctx.arch) return { kind: 'print', lines: scenarioLines() };
      return { kind: 'game', verb: 'cards', echo: 'ls' };
```
  - In the gameplay switch (after `arch` is in scope), add:
```ts
    case 'cards':
      return { kind: 'game', verb: 'cards', echo: 'cards' };
    case 'add':
    case 'remove': {
      const id = args[0];
      if (!id) return { kind: 'error', message: `usage: ${verb} <id>` };
      if (!ids.has(id)) return { kind: 'error', message: `unknown card: ${id}` };
      return { kind: 'game', verb, arg: id, echo: `${verb} ${id}` };
    }
```
  - Update `helpText` lines: replace the hint line with `'  hint                a nudge - not the answer'` and add after the `play` line:
```ts
    '  ls | cards          list cards (board + tray) while playing',
    '  add <id>            place a tray card on the board',
    '  remove <id>         return a card to the tray',
```
  - Update `complete`: after `add`/`remove`, complete node ids; keep node-id completion for connect/disconnect. The existing fallback `return ctx.arch.nodes.map((n) => n.id).filter(...)` already covers add/remove/connect/disconnect since they all take node ids - no change needed beyond confirming `head` cases. (Optional refinement, not required for tests.)

- [ ] **Step 4: Run.** `pnpm test src/components/deck/commands.test.ts` -> PASS. `pnpm test src/components/deck src/content` -> PASS. `pnpm run typecheck` -> 0. biome clean on the two files.

- [ ] **Step 5: Commit.**

```bash
git add src/components/deck/commands.ts src/components/deck/commands.test.ts
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): add/remove/cards verbs + context-aware ls + refreshed help"
```

---

## Task 6: Island runner `Deck.tsx` - card verbs, judged wiring, scored status, vague hint

**Files:**
- Modify: `src/components/deck/Deck.tsx`

No unit test (React island - verified by typecheck + dev smoke, consistent with the codebase having no component tests).

- [ ] **Step 1: Update imports.** Replace `import { bootOrder, canConnect, isComplete, nextHint, objectiveProgress } from './board';` with `import { bootOrder, isComplete, judgeWire, hintFor, objectiveProgress } from './board';` and add `import { scoreState } from './scoring';`

- [ ] **Step 2: Extend `runGame`** to handle `add`/`remove`/`cards`, route `connect` through `judgeWire`, score `status`, and use `hintFor`. Replace the `status`, `hint` cases and add the new verbs. Full replacement for the `switch (cmd.verb)` body:

```ts
  switch (cmd.verb) {
    case 'play': {
      const next = cmd.arg ? architectureBySlug[cmd.arg] : undefined;
      if (!next) {
        dispatch({ type: 'LOG', kind: 'error', text: `unknown game: ${cmd.arg ?? ''}` });
        return;
      }
      dispatch({ type: 'PLAY', arch: next, at: Date.now() });
      return;
    }
    case 'reset':
      dispatch({ type: 'RESET', arch: activeArch, at: Date.now() });
      return;
    case 'menu':
      dispatch({ type: 'MENU' });
      return;
    case 'cards': {
      const onBoard = state.placed.join(', ') || '(none)';
      const tray = activeArch.nodes.filter((n) => !state.placed.includes(n.id)).map((n) => n.id);
      dispatch({ type: 'LOG', kind: 'output', text: `board: ${onBoard}` });
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: tray.length ? `tray:  ${tray.join(', ')}` : 'tray:  (empty - all cards placed)',
      });
      return;
    }
    case 'add': {
      const node = activeArch.nodes.find((n) => n.id === cmd.arg);
      if (!node) {
        dispatch({ type: 'LOG', kind: 'error', text: `unknown card: ${cmd.arg ?? ''}` });
        return;
      }
      if (state.placed.includes(node.id)) {
        dispatch({ type: 'LOG', kind: 'output', text: `${node.id} is already on the board` });
        return;
      }
      dispatch({ type: 'ADD_CARD', id: node.id, decoy: node.decoy === true });
      dispatch({ type: 'LOG', kind: 'output', text: `+ ${node.id} placed` });
      return;
    }
    case 'remove': {
      if (!cmd.arg || !state.placed.includes(cmd.arg)) {
        dispatch({ type: 'LOG', kind: 'error', text: `not on the board: ${cmd.arg ?? ''}` });
        return;
      }
      dispatch({ type: 'REMOVE_CARD', id: cmd.arg });
      dispatch({ type: 'LOG', kind: 'output', text: `- ${cmd.arg} removed` });
      return;
    }
    case 'status': {
      const p = objectiveProgress(activeArch, state.edges, state.placed);
      const sc = scoreState(activeArch, state);
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: `score ${sc.score}/${sc.max} (grade ${sc.grade}) - ${p.pct}% wires ${p.satisfied}/${p.total}`,
      });
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: `cards ${state.placed.length} placed - ${p.missingCards.length} still needed`,
      });
      if (p.decoysOnBoard.length > 0) {
        dispatch({
          type: 'LOG',
          kind: 'output',
          text: `warning: ${p.decoysOnBoard.length} placed card(s) do not belong - remove them`,
        });
      }
      if (state.wrongWires > 0) {
        dispatch({ type: 'LOG', kind: 'output', text: `wrong attempts: ${state.wrongWires}` });
      }
      if (p.satisfied === p.total && p.missingCards.length === 0 && p.decoysOnBoard.length === 0) {
        dispatch({ type: 'LOG', kind: 'output', text: "design looks right - try 'boot'" });
      }
      return;
    }
    case 'hint': {
      const text = hintFor(activeArch, state);
      dispatch({ type: 'HINT' });
      dispatch({ type: 'LOG', kind: 'output', text: `hint: ${text}` });
      return;
    }
    case 'boot': {
      dispatch({ type: 'BOOT_START' });
      return;
    }
  }
```

- [ ] **Step 3: Pass `placed` to the boot effect.** In the `useEffect` boot body, change `const r = bootOrder(activeArch, state.edges);` to `const r = bootOrder(activeArch, state.edges, state.placed);` and both `isComplete(activeArch, state.edges)` calls (reduced-motion path + animated win-hold) to `isComplete(activeArch, state.edges, state.placed)`.

- [ ] **Step 4: Route manual wiring through `judgeWire`.** In `runCommand`, the `a.type === 'CONNECT'` branch currently calls `canConnect`. Replace it with:

```ts
      if (a.type === 'CONNECT') {
        const v = judgeWire(activeArch, state.placed, a.from, a.to);
        if (!v.ok) {
          dispatch({ type: 'LOG', kind: 'error', text: `! ${v.reason}` });
          if (v.penalize) {
            dispatch({ type: 'WRONG_WIRE' });
            dispatch({ type: 'LOG', kind: 'error', text: `WRONG -${SCORE.WRONG_WIRE}` });
          }
          return;
        }
        dispatch(a);
        dispatch({ type: 'LOG', kind: 'output', text: `LINK ${a.from} -> ${a.to}  OK` });
        return;
      }
```
  Add `import { SCORE, scoreState } from './scoring';` (merge with Step 1's scoring import).

- [ ] **Step 5: Verify.** `pnpm run typecheck` -> 0 errors. `pnpm exec biome check src/components/deck/Deck.tsx` -> clean. Start dev (`pnpm dev`) and `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/deck` -> 200. In the browser: `play stalwart-mail` then `add nginx`, `connect internet nginx` (OK), `connect internet sqlite` (rejected + WRONG), `status` (shows score/grade), `hint` (vague), `cards` (board/tray).

- [ ] **Step 6: Commit.**

```bash
git add src/components/deck/Deck.tsx
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): island runner - card add/remove, judged wiring + penalty, scored status, vague hint"
```

---

## Task 7: Tray + HUD + WinPanel + GameMenu + theme token

**Files:**
- Create: `src/components/deck/Tray.tsx`
- Modify: `src/components/deck/Hud.tsx`, `src/components/deck/WinPanel.tsx`, `src/components/deck/GameMenu.tsx`, `src/components/deck/Terminal.tsx`, `src/styles/global.css`
- Wire-in: `src/components/deck/Deck.tsx`

- [ ] **Step 1: Add the `amber` theme token.** In `src/styles/global.css`, inside the `@theme` block, add alongside the other `--color-*` tokens: `  --color-amber: #ff9f1a;` (verify the exact `@theme` location by reading the existing cyan/lime/fuchsia tokens and matching the format).

- [ ] **Step 2: Create `src/components/deck/Tray.tsx`.** A panel listing tray cards (non-placed node ids, decoys included, NO decoy tell) as chips that run `add <id>`; mirrors GameMenu's button-runs-parse pattern.

```tsx
import type { Architecture } from '@content/architectures';
import type { Command, Ctx } from './commands';
import { parse } from './commands';
import type { DeckState } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
  ctx: Ctx;
  onRun: (cmd: Command) => void;
}

// The card tray: every card not yet on the board (real AND decoy, no tell). A
// chip runs `add <id>` through the same parse path as typing it, so the terminal
// log + state stay in sync. Empty when all cards are placed.
export default function Tray({ arch, state, ctx, onRun }: Props) {
  const tray = arch.nodes.filter((n) => !state.placed.includes(n.id));
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-elevated/70 px-4 py-3 font-mono backdrop-blur-xl">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-widest text-muted">tray - cards to place</span>
        <span className="text-[10px] uppercase tracking-widest text-muted/70">{tray.length} left</span>
      </div>
      {tray.length === 0 ? (
        <p className="text-[11px] text-muted">tray empty - all cards placed</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tray.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onRun(parse(`add ${n.id}`, ctx))}
                data-cursor-label="add"
                className="rounded-lg border border-line/80 px-2.5 py-1.5 text-[11px] text-text transition-colors hover:border-lime hover:text-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                + {n.id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `Hud.tsx`.** Import `scoreState` and surface score/grade + cards + warnings. Replace the body: compute `const p = objectiveProgress(arch, state.edges, state.placed);` and `const sc = scoreState(arch, state);`. Add a top row showing `grade` (large) + `score/max`. Add `cards {placed}/{needed}` to the `<dl>`. Add a fuchsia warning row when `p.decoysOnBoard.length > 0` ("N cards don't belong") and a `wrong {state.wrongWires}` stat when `> 0`. Keep `% wires` bar, moves, time, hints. Pass `state.placed` to `objectiveProgress`. Key snippet to add above the progress bar:

```tsx
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-widest text-muted">grade</span>
        <span className="text-lg leading-none text-lime tabular-nums">
          {sc.grade}
          <span className="ml-2 text-[11px] text-muted">{sc.score}/{sc.max}</span>
        </span>
      </div>
```
  And in the `<dl>`, add:
```tsx
        <div className="flex items-center gap-1.5">
          <dt>cards</dt>
          <dd className="tabular-nums text-text">
            {state.placed.length}/{state.placed.length + p.missingCards.length}
          </dd>
        </div>
```
  And after the `<dl>`, conditional warnings:
```tsx
      {p.decoysOnBoard.length > 0 && (
        <p className="text-[10px] uppercase tracking-widest text-fuchsia">
          {p.decoysOnBoard.length} placed card(s) do not belong
        </p>
      )}
```

- [ ] **Step 4: Update `WinPanel.tsx`.** Import `scoreState`; compute `const sc = scoreState(arch, state);`. Replace the "objective complete" subtitle area with the grade + score, add a perfect-run badge when `sc.perfect`, and add `wrong` to the stats grid (change `grid-cols-3` to `grid-cols-4`: time, moves, wrong, hints). Key snippets:
```tsx
        <span className="text-[11px] uppercase tracking-widest text-lime">system online</span>
        <h2 className="font-display text-2xl text-text">{arch.title}</h2>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-4xl text-lime">{sc.grade}</span>
          <span className="text-sm text-muted tabular-nums">{sc.score}/{sc.max}</span>
        </div>
        {sc.perfect && (
          <span className="rounded-full border border-lime px-3 py-1 text-[10px] uppercase tracking-widest text-lime">
            perfect run
          </span>
        )}
```
  And add a fourth stat cell:
```tsx
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-widest text-muted">wrong</dt>
          <dd className="text-lg text-text tabular-nums">{state.wrongWires}</dd>
        </div>
```

- [ ] **Step 5: Update `GameMenu.tsx`.** Add `expert: 'text-amber',` to `DIFFICULTY_CLASS` (the `Record<Architecture['difficulty'], string>` now requires all four keys, so this is also needed to typecheck).

- [ ] **Step 6: Update `Terminal.tsx` quick-chips.** Change `HINTS` to `['help', 'ls', 'play stalwart-mail', 'add', 'connect', 'boot'] as const;` (note `add`/`connect` are partial; clicking just pre-runs them - acceptable as they print a usage error that teaches the syntax. If you prefer no error, use `['help', 'ls', 'play stalwart-mail', 'status', 'hint', 'boot']` unchanged). Keep unchanged if uncertain.

- [ ] **Step 7: Wire `Tray` into `Deck.tsx`.** In the render, show the Tray during play, under the HUD. Change the playing block so the layout is HUD -> Tray -> Diagram:
```tsx
        {state.phase === 'playing' && <Hud arch={activeArch} state={state} />}
        {state.phase === 'playing' && <Tray arch={activeArch} state={state} ctx={ctx} onRun={runCommand} />}
```
  Add `import Tray from './Tray';` at the top.

- [ ] **Step 8: Verify.** `pnpm run typecheck` -> 0. `pnpm exec biome check src/components/deck/Tray.tsx src/components/deck/Hud.tsx src/components/deck/WinPanel.tsx src/components/deck/GameMenu.tsx src/components/deck/Deck.tsx src/styles/global.css` -> clean. Dev smoke: `/deck` 200; menu shows 6 levels (expert in amber); `play microservices` shows a tray of chips; clicking a chip adds it; HUD shows grade/score/cards.

- [ ] **Step 9: Commit.**

```bash
git add src/components/deck/Tray.tsx src/components/deck/Hud.tsx src/components/deck/WinPanel.tsx src/components/deck/GameMenu.tsx src/components/deck/Terminal.tsx src/components/deck/Deck.tsx src/styles/global.css
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): tray UI + score/grade HUD + win grade/perfect badge + expert difficulty color"
```

---

## Task 8: Diagram - placed-only render, free wiring, rejected-wire flash, remove control; drop canConnect

**Files:**
- Modify: `src/components/deck/Diagram.tsx`, `src/components/deck/ServiceNode.tsx`
- Modify: `src/components/deck/board.ts` + `src/components/deck/board.test.ts` (remove now-unused `canConnect`)

- [ ] **Step 1: Render only placed nodes.** In `Diagram.tsx`, after `const placed = useMemo(() => layout(arch, state.positions, dims), ...)`, filter the arch nodes by `state.placed` BEFORE layout. Replace the `layout` call:
```tsx
  const liveArch = useMemo(
    () => ({ ...arch, nodes: arch.nodes.filter((n) => state.placed.includes(n.id)) }),
    [arch, state.placed],
  );
  const placed = useMemo(() => layout(liveArch, state.positions, dims), [liveArch, state.positions, dims]);
```
  (The variable `placed` here is the PlacedNode[] for the board; do not confuse with `state.placed`.)

- [ ] **Step 2: Pass `placed` to online/boot derives.** Change `onlineNodes(arch, state.edges)` to `onlineNodes(arch, state.edges, state.placed)`. The `bootUp`/`bootUnreachable` sets read from `state.boot` (unchanged).

- [ ] **Step 3: Remove the canConnect candidate guidance.** Delete the `candidates` `useMemo` (and its use). In `nearestTarget`, drop the `if (!canConnect(arch, sourceId, p.node.id).ok) continue;` line so any placed node is a snap target. Remove `canConnect` from the board import. Pass `candidate={false}` to `ServiceNode` (or remove the prop usage - simplest: pass `candidate={false}` so the existing prop stays valid), and keep `wiring={armedFrom != null}`.

- [ ] **Step 4: Red-flash a rejected drop.** Add local state `const [rejectId, setRejectId] = useState<string | null>(null);` and a ref-timer. When a wire drop is rejected, flash the target. Since the CONNECT routes through `onRun` (which judges), the cleanest signal is to judge in `endDrag` for the flash only: import `judgeWire` and, in the wire branch when `target` is set, compute `const verdict = judgeWire(arch, state.placed, session.nodeId, target);` - if `!verdict.ok`, `setRejectId(target)` and clear it after a short timeout sourced from motion (`durations.pulse`), then STILL call `onRun(...)` (the runner logs the reason + penalty). Pass `reject={rejectId === p.node.id}` to `ServiceNode`. (Add `import { durations } from '@lib/motion';` and a timeout ref cleared on unmount.)

- [ ] **Step 5: Remove control on each node.** In `ServiceNode.tsx`, add an optional `onRemove?: (id: string) => void;` prop and render a small x button (top-right of the card) when provided: 
```tsx
      {onRemove && (
        <button
          type="button"
          aria-label={`remove ${node.label}`}
          data-cursor-label="remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(node.id);
          }}
          className="absolute -right-1.5 -top-1.5 z-20 grid size-5 place-items-center rounded-full border border-line bg-canvas text-[10px] text-muted hover:border-fuchsia hover:text-fuchsia focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia"
        >
          x
        </button>
      )}
```
  Add a `reject?: boolean` prop; when true, force the card border to fuchsia (reuse the existing inline `borderColor` logic: `const borderColor = reject ? 'var(--color-fuchsia)' : bootBorder ?? (...)`).
  In `Diagram.tsx`, pass `onRemove={(id) => onRun(parse(\`remove ${id}\`, ... ))}` - but Diagram has no `ctx`. Simplest: pass a direct handler that calls `onRun({ kind: 'game', verb: 'remove', arg: id, echo: \`remove ${id}\` })`. Add `reject={rejectId === p.node.id}`.

- [ ] **Step 6: Remove `canConnect` from `board.ts`** (now unused) and its test in `board.test.ts`. Run `grep -rn "canConnect" src/` to confirm no references remain before deleting the function + test block.

- [ ] **Step 7: Verify.** `pnpm test` -> only pre-existing `validate.test.ts` fails. `pnpm run typecheck` -> 0. `pnpm exec biome check src/components/deck/Diagram.tsx src/components/deck/ServiceNode.tsx src/components/deck/board.ts src/components/deck/board.test.ts` -> clean. Dev smoke: `play stalwart-mail`; the board shows only entry cards; `add nginx` makes it appear; drag-wire internet->nginx sticks (green), drag internet->sqlite (after adding sqlite) flashes red + logs WRONG; the x on a card removes it; full correct build + `boot` wins with the fire-up + grade.

- [ ] **Step 8: Commit.**

```bash
git add src/components/deck/Diagram.tsx src/components/deck/ServiceNode.tsx src/components/deck/board.ts src/components/deck/board.test.ts
git -c user.name=v9dev -c user.email=99959044+v9dev@users.noreply.github.com commit -m "feat(deck): diagram renders placed cards, free wiring with rejected-wire flash + remove control; drop canConnect"
```

---

## Final verification (after Task 8)

- [ ] `pnpm test` -> all pass except the pre-existing `functions/_lib/validate.test.ts`.
- [ ] `pnpm run typecheck` -> 0 errors.
- [ ] `pnpm exec biome check src/components/deck src/content/architectures.ts src/styles/global.css` -> clean.
- [ ] Dev play-through per level (esp. `microservices` expert - confirm the board stays legible; nodes are draggable). Reduced-motion + keyboard wiring spot-check.
- [ ] Whole-branch review, then `superpowers:finishing-a-development-branch`.

## Self-review notes

- **Spec coverage:** tray+add/remove (T3 state, T5 cmd, T6 island, T7 Tray, T8 diagram remove); decoys + 2 levels + expert + hints (T1 types, T4 data); auto-reject + penalty (T1 judgeWire, T6 island, T8 flash); scoring + grade (T2, T6 status, T7 HUD/Win); vague hints (T1 hintFor, T4 data, T6); 6 levels (T4). All covered.
- **Type consistency:** `judgeWire(arch, placed, from, to)`, `bootOrder/onlineNodes/objectiveProgress/isComplete(arch, edges, placed?)`, `scoreState(arch, state)`, `Progress.missingCards/decoysOnBoard`, actions `ADD_CARD{id,decoy}`/`REMOVE_CARD{id}`/`WRONG_WIRE`, `GameVerb` +add/remove/cards - consistent across tasks.
- **Green-at-each-task:** additive optional `placed`, `canConnect` kept until T8, `scoring.ts` uses a local `ScoreInput` so it does not depend on T3 field additions.
