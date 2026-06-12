# v9 Deck - Architecture Game (redesign)

**This supersedes the "showcase" framing in `2026-06-05-v9-deck-design.md`.**
The deck is no longer a thing you look at - it is a **terminal-driven
game**. You `ls` the available games, `play` one, and use real
ops-style commands to wire and fire up a server. There is an objective,
a live progress %, hints, a win state, and multiple levels. The diagram
is live visual feedback for your commands, not the main interaction.

Built on the existing engine (already on `feat/v9-deck`): the `state.ts`
reducer, `board.ts` (`canConnect`, `bootOrder`, geometry), `Diagram.tsx`
renderer, drag-to-wire, and `Terminal.tsx` are REUSED. We add the game
loader, the scenarios, the objective/score/win/hint layer, and the level
flow. No new runtime deps.

## What the player does (core loop)

1. `/deck` opens the terminal at a **menu**: a short intro, then `help`.
2. `ls` (or `games`) lists **3-4 scenarios**, each `id · title · difficulty · one-line goal`.
3. `play <id>` (alias `start <id>`) loads a scenario: the diagram shows
   its services **dark and unwired**, the objective prints, progress = 0%.
4. The player issues **commands** to build it:
   - `connect <a> <b>` (alias `link`) - wire service a -> b.
   - `disconnect <a> <b>` (alias `unlink`) - remove a wire.
   - `status` - prints progress %, connections made N/M, wrong wires, and
     what is still missing.
   - `hint` - names the next missing required connection (limited? no -
     unlimited for v1, but each use is counted).
   - `boot` (alias `fireup`) - attempt to bring the server online. If the
     topology is correct -> **WIN**: "SYSTEM ONLINE", show time + moves +
     hints used, offer **next level**. If not -> prints which nodes are
     unreachable / what is missing, no win.
   - `reset` - restart the current scenario (back to 0%, unwired).
   - `menu` (alias `back`) - return to the game menu.
   - `clear` - clear the log. `help` - the full command guide.
5. GUI **drag-to-wire still works** as an alternative to `connect`, and
   it echoes the equivalent `connect a b` (the existing reciprocal bind).
   But the game is **command-first**: fully playable with only commands +
   hints. The diagram is live feedback (a service lights up when it is
   correctly wired into the graph).

## Win / scoring

- Each scenario defines a **reference topology** (`edges` with
  `required: true`). Start with **no edges**.
- **Progress %** = (required edges currently present) / (total required).
- **Win** = all required edges present AND `bootOrder` reaches every node
  (no unreachable) AND no invalid edges (canConnect already blocks the
  truly invalid; a "wrong" edge is a valid-but-not-required one - allowed,
  but it does not raise %, and `status` flags extras).
- **Score shown on win:** elapsed **time**, **moves** (connect/disconnect
  count), and **hints used**. Lower is better. No leaderboard/persistence
  (in-memory only).

## Scenarios (3-4 levels, real systems)

Authored in `src/content/architectures.ts` as `Architecture[]`, each with
an added game objective field. Difficulty ramps by node/edge count.

1. **mail** - "Bring the Stalwart mail server online" (existing Stalwart
   model: internet, mailclient, nginx, stalwart, sqlite). Easy (5 nodes).
2. **cockpit** - "Stand up the Server Cockpit monitoring fleet"
   (host/docker, portainer, beszel, dozzle, uptime-kuma, homarr, reverse
   proxy). Medium.
3. **webstack** - "Init a full-stack app stack" (cloudflare -> nginx ->
   app(node) -> postgres, app -> redis). Medium.
4. **ci** (optional 4th if time) - "Wire a CI/CD pipeline" (git -> runner
   -> build -> registry -> deploy target). Harder.

Each node keeps the existing `ArchNode` shape (icon via skillId/abbr,
accent, `detail` for the optional inspect drawer). Each `Architecture`
gains: `objective: string`, `difficulty: 'easy'|'medium'|'hard'`, and an
optional `intro: string`.

## Data model change - `architectures.ts`

Add to `Architecture`:
```ts
objective: string;            // "Bring the Stalwart mail server online"
difficulty: 'easy' | 'medium' | 'hard';
intro?: string;               // one-line scene-setting shown on play
```
Keep `nodes`, `edges` (the reference/required topology), `slug`, `title`,
`subtitle`, `projectSlug`. Export `architectures` (3-4) and
`architectureBySlug`. The reference `edges` are the WIN target; the live
game starts with `edges: []`.

## State change - `state.ts`

The session no longer initializes to the reference wiring. Add a game
session layer:
```ts
// initDeckState(arch) now starts UNWIRED:
edges: []            // was arch.edges.map(...)
// new game fields on DeckState:
phase: 'menu' | 'playing' | 'won';
moves: number;       // connect+disconnect count
hintsUsed: number;
startedAt: number | null;   // ms epoch, set on PLAY (passed in via action, since Date.now is fine in the browser island - NOT in workflow scripts)
wonAt: number | null;
```
New / changed actions:
- `PLAY { arch }` - load a scenario unwired, phase='playing', reset
  moves/hints/startedAt, log the objective.
- `CONNECT` / `DISCONNECT` - increment `moves`.
- `HINT` - increment `hintsUsed` (the hint text is computed by board and
  logged by the runner).
- `WIN { at }` - phase='won', wonAt set.
- `MENU` - phase='menu'.
- keep `RESET` (re-load current scenario unwired), `SELECT_NODE`,
  `BOOT_START/STEP/DONE`, `LOG`, `CLEAR`, `MOVE_NODE`, `ARM/DISARM`.

## Logic - `board.ts` (pure, add)

```ts
// how many required edges are satisfied + the missing ones
export function objectiveProgress(arch: Architecture, edges: ArchEdge[]): {
  satisfied: number; total: number; pct: number;
  missing: ArchEdge[]; extra: ArchEdge[];
};
// win when all required present AND bootOrder reaches all nodes
export function isComplete(arch: Architecture, edges: ArchEdge[]): boolean;
// next missing required edge for `hint`
export function nextHint(arch: Architecture, edges: ArchEdge[]): ArchEdge | null;
```
Add unit tests (vitest) for objectiveProgress (0%, partial, 100%),
isComplete, nextHint, on a fixture scenario. `canConnect` and `bootOrder`
unchanged.

## Commands - `commands.ts`

New/extended verb set (frozen for v1): `help`, `ls`/`games`,
`play`/`start <id>`, `connect`/`link <a> <b>`, `disconnect`/`unlink <a> <b>`,
`status`, `hint`, `boot`/`fireup`, `reset`, `menu`/`back`, `clear`.
- In **menu** phase, only `ls`/`play`/`help`/`clear` are meaningful;
  gameplay verbs print "load a game first - try `ls`".
- `parse` is scenario-aware: node-id validation uses the loaded arch;
  `play <id>` validates against `architectureBySlug`.
- `help` returns the full guide (the "guide for all commands").
- `complete` completes verbs, then game ids (after `play`) or node ids
  (after connect/disconnect).
Unit tests for every verb + menu-vs-playing gating + completion.

## UI

- **Deck.tsx**: holds the session; `runCommand` handles the new verbs
  (PLAY loads arch + resets diagram; STATUS/HINT print; BOOT checks
  `isComplete` -> WIN or report missing). On win, dispatch `WIN` and show
  the win panel. A small **HUD** (progress %, N/M connections, moves,
  timer, hints) renders above/beside the diagram while `phase==='playing'`.
- **Terminal.tsx**: reused. Shows the menu/guide on load.
- **Diagram.tsx**: reused; nodes render **dim when not yet correctly
  wired** and **lit when satisfied** (a node is "online" when all its
  required inbound edges are present); wrong/extra edges flagged. Drag
  still works.
- **Win panel**: a concise overlay/log block - "SYSTEM ONLINE", time,
  moves, hints, and `next` / `menu` actions.
- **Menu**: rendered in the terminal (the `ls` table). No separate route.
- **Remove `SkillsChart`** from the deck flow (cut). The `skills` command
  is removed from the game vocab.
- **DeckTeaser.astro**: update copy to a play framing ("a terminal game -
  fire up the architecture", `launch the deck ->`).

## Reused as-is (no change)

The SVG-over-DOM render technique, the unified click/tap/keyboard +
drag wiring machine, the reciprocal command echo, the detail drawer
(now an optional `inspect <node>` / click affordance), the route-aware
nav, the data-flow CSS, reduced-motion + a11y + Lenis + custom-cursor
handling, and all conventions from the original spec
(`2026-06-05-v9-deck-design.md` - "Reduced motion / input / a11y",
"Performance", "Conventions" sections still apply).

## Non-goals

- No persistence / leaderboard / accounts (in-memory only).
- No skills chart, no "loads fully wired" showcase view.
- No free-form node creation; scenarios are authored.
- No new heavy deps; no second always-on rAF.

## Acceptance (human, via `pnpm dev` on /deck)

- Opens to a menu; `ls` lists 3-4 games; `play mail` starts unwired at 0%.
- `connect`/`disconnect` change %, `status` reports progress + missing,
  `hint` reveals the next link, `boot` wins only when correct and shows
  time/moves/hints, `next` advances, `menu` returns.
- Drag still wires and echoes the command; nodes light up as wired;
  reduced-motion + keyboard + touch still work; no skills chart anywhere.

## Conventions

Unchanged from `2026-06-05-v9-deck-design.md`: pnpm only, dev HMR review,
hyphens not em-dashes, commits authored `v9dev` with no AI trailer, Biome
clean, reuse `cn()` + `@lib/motion`, path aliases.
