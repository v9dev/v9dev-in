# v9 Deck - "Architect" mode (design)

Date: 2026-06-06. Supersedes the win-by-wiring loop in
`2026-06-05-v9-deck-game-design.md`. Same engine, harder game.

## Why

The terminal game shipped, but play-test feedback: too few levels, too
easy, and the hint hands you the answer. The fix turns it from "wire the
given nodes" into "design the system": pick the right cards from a tray
of real-and-decoy options, wire freely (wrong wires are rejected and
cost score), chase a graded score, across 6 levels.

## Locked decisions (from brainstorming)

1. **Cards: tray + add/remove.** A scenario session starts with only the
   entry card(s) on the board; every other card - the real services AND
   the decoys, mixed - sits in a tray. `add <id>` places a card,
   `remove <id>` returns it to the tray (and drops its wires). Placing a
   decoy dings the score.
2. **Wrong wires: auto-reject + penalty.** Any placed card may be wired
   to any other (no `canConnect` gate, no valid-target highlight). The
   wire is judged against the real design: correct sticks (green); wrong
   is rejected instantly with a reason and a score penalty - it never
   stays on the board. A node may fan out/in to many (no per-node limit).
3. **Correctness wins; score is the grade.** Win = all required cards
   placed + all decoys off the board + all required wires present + boots
   clean. Score grades the run; it is not a win gate.
4. **Six levels.** The 4 existing + decoys, plus 2 new (hard + expert).

## Game loop

```
play <id>      -> board = entry card(s) only; rest (+decoys) in the tray
ls / cards     -> at menu: list games; in play: list board + tray cards
add <id>       -> place a tray card on the board   (decoy => score ding)
remove <id>    -> return a card to the tray         (drops its wires)
connect a b    -> wire a->b: correct sticks, wrong is rejected + penalized
disconnect a b -> remove a wire
status         -> score/grade, % wires, cards placed/needed, decoys on board
hint           -> a VAGUE nudge (never "connect x y"); costs score
boot / fireup  -> fire up: win only if the design is correct + boots clean
reset          -> replay current scenario (back to entry-only, counters 0)
menu / back    -> scenario picker
clear          -> clear the log
```

## Scoring

Pure, derived from the live state - no score stored in the reducer.
Constants live in a new `scoring.ts` (tunable):

```
CORRECT_WIRE = 100   // per required wire currently present
WRONG_WIRE   =  50   // per rejected wire attempt (cumulative)
HINT         =  40   // per hint used
DECOY_ADD    =  40   // per decoy placement (cumulative, even if removed)

score = max(0, satisfiedWires*CORRECT_WIRE
              - wrongWires*WRONG_WIRE
              - hintsUsed*HINT
              - decoyAdds*DECOY_ADD)
max   = totalRequiredWires*CORRECT_WIRE
perfect = wrongWires===0 && hintsUsed===0 && decoyAdds===0
grade = (perfect && satisfied===total) ? 'S'
      : ratio>=0.9 ? 'A' : ratio>=0.75 ? 'B' : ratio>=0.5 ? 'C' : 'D'
       (ratio = score/max)
```

`scoreState(arch, state) => { score, max, grade, perfect, breakdown }`
where `breakdown = { correct, wrong, hints, decoys }` (the four signed
contributions, for the HUD/WinPanel).

## Data model (`src/content/architectures.ts`)

- `Architecture.difficulty` union gains `'expert'` ->
  `'easy' | 'medium' | 'hard' | 'expert'`.
- `ArchNode` gains `decoy?: boolean`. A decoy is NEVER referenced by any
  `arch.edges` entry; it must stay OFF the board to win.
- **Entry cards** (pre-placed at session start) are derived, not flagged:
  a node is an entry iff `!decoy && (kind === 'external' || kind ===
  'client')`. Decoys are never sources in the data (keeps the start
  clean), but the derive excludes decoys regardless.
- `Architecture` gains optional `hints?: string[]` - authored, vague,
  spoiler-free principle nudges for `hintFor` to cycle when wires are
  missing (e.g. "traffic flows source -> edge -> service -> data").

### Decoys added to existing scenarios

Plausible-but-wrong cards, `decoy: true`, no edges, same column as the
peers they distract from. Use `skillId` only where a simple-icons id is
certain; otherwise `accent` + `abbr` (mirrors internet/mailclient).

- **stalwart-mail** (easy, +1): `dovecot` (standalone IMAP/POP3 -
  redundant; Stalwart already speaks IMAP/JMAP). accent+abbr `DVC`.
- **cockpit** (medium, +2): `grafana` (skill), `prometheus` (skill) -
  a heavier metrics stack this lightweight fleet does not use.
- **webstack** (medium, +2): `mysql` (skill, wrong relational store vs
  Postgres), `memcached` (accent+abbr `MMC`, redundant cache vs Redis).
- **ci** (hard, +2): `sonarqube` (accent+abbr `SQ`, quality gate not in
  the minimal pipeline), `slack` (skill, notify add-on, not required).

### New scenario: `media` (hard)

Self-hosted media stack. Real cards (6): `internet` (ext), `nginx`
(edge/skill nginx), `jellyfin` (service/skill jellyfin), `sonarr`
(service, accent+abbr `SNR`), `qbittorrent` (service/skill qbittorrent,
abbr `QBT`), `nas` (datastore, accent+abbr `NAS`).
Required edges (7): internet->nginx, nginx->jellyfin, nginx->sonarr,
jellyfin->nas, sonarr->qbittorrent, sonarr->nas, qbittorrent->nas.
Decoys (3): `plex` (skill, alt media server), `mysql` (skill, wrong
store), `ftp` (client, accent+abbr `FTP`, legacy).
Columns: internet 0, nginx 1, jellyfin 2, sonarr 2, qbittorrent 3, nas 4;
plex 2, mysql 4, ftp 0.

### New scenario: `microservices` (expert)

API gateway + services + queue + worker + two stores. Real cards (9):
`internet` (ext), `gateway` (edge/skill nginx, abbr `GW`), `auth`
(service, abbr `AUTH`), `orders` (service, abbr `ORD`), `payments`
(service, abbr `PAY`), `queue` (service/skill rabbitmq, abbr `MQ`),
`worker` (service, abbr `WRK`), `postgres` (datastore/skill postgres),
`redis` (datastore/skill redis).
Required edges (10): internet->gateway, gateway->auth, gateway->orders,
gateway->payments, auth->redis, orders->postgres, payments->postgres,
orders->queue, queue->worker, worker->postgres.
Decoys (3): `mongodb` (skill, wrong store), `memcached` (accent+abbr
`MMC`, redundant cache), `graphql` (skill, BFF distractor).
Columns: internet 0, gateway 1, auth/orders/payments 2, queue 3,
worker 4, postgres/redis 5; mongodb 5, memcached 5, graphql 2.

Layout note: 9 cards across 6 columns is wide. Nodes are draggable and
only PLACED cards render, so the player builds up incrementally - but
verify the expert board is legible at the play-test (acceptable to lean
on drag; do not block the build on a layout rewrite).

## State (`src/components/deck/state.ts`)

`DeckState` adds:
- `placed: string[]` - node ids currently on the board.
- `wrongWires: number` - cumulative rejected wire attempts.
- `decoyAdds: number` - cumulative decoy placements.

(`moves`, `hintsUsed`, `startedAt`, `wonAt`, `phase`, `edges`, `boot`,
`bootSeq`, `log`, `history`, `seq`, `positions`, `selectedNodeId`,
`armedFrom` unchanged.)

`initDeckState(arch)` (menu): `placed: []`. `startSession(arch, at)`:
`placed = entryCards(arch)`, `edges: []`, `wrongWires: 0`,
`decoyAdds: 0`, `moves: 0`, `hintsUsed: 0`, `phase: 'playing'`,
`startedAt: at`. (`entryCards` is a board.ts helper - see below.)

New / changed actions:
- `ADD_CARD { id: string; decoy: boolean }` - if already placed, no-op;
  else append to `placed`, `moves++`, and `if (decoy) decoyAdds++`. The
  island passes `decoy` (it has `arch`); reducer stays data-free.
- `REMOVE_CARD { id: string }` - drop from `placed`; drop every edge
  with `from===id || to===id`; `moves++`; reset `boot` to
  `{running:false,up:[],unreachable:[]}` (topology changed).
- `WRONG_WIRE` - `wrongWires++` (no edge, not a move).
- `CONNECT` (unchanged) is dispatched ONLY when the island judged the
  wire correct; still `moves++` + boot-flag reset.
- `WIN` keeps the `phase==='playing'` guard added in f7be5e0.

## Engine (`src/components/deck/board.ts`)

- New `entryCards(arch): string[]` - `arch.nodes.filter(n => !n.decoy &&
  (n.kind==='external'||n.kind==='client')).map(n=>n.id)`.
- Replace `canConnect` with **`judgeWire(arch, placed, from, to)`**:
  ```
  from===to               -> {ok:false, penalize:false, reason:'cannot wire a node to itself'}
  from|to not in placed   -> {ok:false, penalize:false, reason:'place both cards first'}
  (from,to) in arch.edges -> {ok:true}
  else (wrong, penalize:true) reason, most specific first:
    from.kind==='datastore'                 -> '<from> is a datastore - it does not initiate connections'
    to.kind==='datastore' && from is client/external -> 'do not expose <to> directly to <from>'
    from.decoy || to.decoy                  -> 'that card has no role in this design'
    otherwise                               -> '<from> -> <to> is not part of this design'
  ```
  `penalize:false` = guidance (no score hit, no WRONG_WIRE);
  `penalize:true` = a real wrong attempt.
- `bootOrder(arch, placed, edges)` - signature gains `placed`; filters
  `arch.nodes` to placed ids; sources = placed external/client. Returns
  the same `{order, up, unreachable}` over placed nodes only.
- `onlineNodes(arch, placed, edges)` - signature gains `placed`; only
  placed nodes can be online; a placed node is online once all required
  inbound edges present (sources online from the start).
- `objectiveProgress(arch, edges)` - keep wire %; add
  `missingCards: string[]` (non-decoy node ids not in `placed`) and
  `decoysOnBoard: string[]` (placed decoy ids). Therefore it now takes
  `placed` too: `objectiveProgress(arch, placed, edges)`.
- `isComplete(arch, placed, edges)` - true iff `satisfied===total` AND
  `decoysOnBoard.length===0` AND `missingCards.length===0` AND
  `bootOrder(arch, placed, edges).unreachable.length===0`.
- Replace `nextHint` with **`hintFor(arch, state) => string`** (vague,
  state-aware, never names the exact wire):
  1. `decoysOnBoard.length>0` -> "one of the cards you placed has no role
     in this design - drop it".
  2. `missingCards.length>0` -> "the design is missing a piece - check
     the tray for what belongs".
  3. wires missing -> cycle `arch.hints` by `hintsUsed % hints.length`
     (fallback: "traffic flows source -> edge -> service -> data; follow
     the chain that isn't wired yet").
  4. complete -> "looks wired - type boot".

## Scoring (`src/components/deck/scoring.ts`, new)

Exports `SCORE` constants and `scoreState(arch, state)` per the Scoring
section. Pure, DOM-free, unit-tested.

## Commands (`src/components/deck/commands.ts`)

- `GameVerb` gains `'add' | 'remove' | 'cards'`.
- `VERBS` + completion: add `add`, `remove`, `cards`.
- `ls` / `cards`: context-aware. At the menu, `ls` lists games (today's
  behavior); in play, `ls`/`cards` emit a game verb the runner resolves
  to a board+tray listing. (`games` always lists games.)
- `add <id>` / `remove <id>`: gameplay verbs (gated like connect). Parse
  validates the id against `arch.nodes`; `add` also that it is currently
  in the tray (not placed), `remove` that it is placed - else a friendly
  error. The runner needs `decoy` for ADD_CARD, so emit
  `{kind:'game', verb:'add', arg:id}` and let the runner look up `decoy`
  from `activeArch` (it has it) before dispatching ADD_CARD.
- `connect`/`link`: still emit `{kind:'action', action:{type:'CONNECT'}}`
  - the runner's CONNECT path now routes through `judgeWire` (below).
- `complete`: after `add`/`remove`, complete from the relevant id set
  (tray ids for add, placed ids for remove); after connect/disconnect,
  placed ids.
- Update `helpText` (replace the "hint reveals the next required wire"
  line with "hint - a nudge, not the answer"; add `add`/`remove`/`cards`)
  and the gameplay-verb set.

## Island (`src/components/deck/Deck.tsx`)

- `runGame` handles `add`/`remove`/`cards`:
  - `add`: look up node in `activeArch`; if missing -> error; if already
    placed -> note; else `dispatch ADD_CARD {id, decoy}` + a log line
    (`+ add <id>` and, for a decoy, a `-40` ding via the score breakdown
    on the next status; do NOT name it "decoy" in the line - the player
    should realize it).
  - `remove`: `dispatch REMOVE_CARD {id}` + log.
  - `cards`: print board ids then tray ids (tray = non-placed node ids,
    decoys included and indistinguishable).
- `connect` path: call `judgeWire(activeArch, state.placed, from, to)`.
  `ok` -> `dispatch CONNECT` + `LINK a -> b OK`. Not ok -> log
  `! <reason>`; if `penalize`, `dispatch WRONG_WIRE` + a `WRONG -50`
  line.
- `status`: print score+grade (from `scoreState`), `% wires
  satisfied/total`, `cards placed/needed`, and, if any, `decoys on board`
  + `missing cards` (counts, not names) + `wrong attempts`.
- `hint`: compute `hintFor(activeArch, state)` (pre-increment), then
  `dispatch HINT`, then log it.
- `boot`: unchanged from f7be5e0 except `isComplete` /`bootOrder` now take
  `placed`; the WIN-after-animation hold stays.
- Pass `state.placed` to `bootOrder`/`onlineNodes`/`isComplete`
  everywhere they are called.

## UI

- **`Tray.tsx` (new):** a panel under/beside the HUD listing tray cards
  (all non-placed node ids, decoys included) as chips; clicking a chip
  runs `add <id>` through the same parse path. Shows a short label + abbr;
  no "decoy" tell. Empty state: "tray empty - all cards placed".
- **`Diagram.tsx`:** render only placed nodes (`layout` over placed).
  `bootOrder`/`onlineNodes` take `placed`. Remove the `canConnect`-based
  `candidates`/valid-target highlighting (every placed node is a legal
  drag target now). Drag-to-wire snaps to any placed in-port; on drop the
  CONNECT routes through the runner -> `judgeWire`; a rejected (wrong)
  drop triggers a brief red flash on the target (a transient local state,
  no persistent edge). Each placed node gets a small remove control (x)
  that runs `remove <id>` (terminal `remove` always works too).
- **`Hud.tsx`:** add `score` + `grade` (prominent), keep `% wires` +
  `wires N/M`, add `cards placed/needed`, surface `decoys on board` and
  `wrong` counts when > 0 (fuchsia), keep moves/time/hints.
- **`WinPanel.tsx`:** headline `grade` + `score`, a perfect-run badge
  when `perfect`, and time / moves / wrong / hints. Keep next/menu.
- **`GameMenu.tsx`:** `DIFFICULTY_CLASS` gains `expert`. Add a
  `--color-amber` token in `global.css` `@theme` and map
  `expert -> 'text-amber'` (distinct from hard's fuchsia); easy/medium/
  hard unchanged. Lists all 6 (data-driven already).
- **`Terminal.tsx`:** `HINTS` quick-chips updated to the new loop
  (e.g. `help`, `ls`, `play stalwart-mail`, `add`, `connect`, `boot`).

## Tests (vitest, pure modules)

- `scoring.test.ts` (new): score math, flooring at 0, grade thresholds,
  perfect flag.
- `board.test.ts`: `judgeWire` (correct / self / not-placed / datastore-
  initiated / exposed-datastore / decoy / not-in-design + penalize flag);
  `bootOrder`/`onlineNodes`/`objectiveProgress`/`isComplete` over a
  placed subset; `hintFor` returns the right category per state and never
  contains "connect "; `entryCards`.
- `state.test.ts`: `startSession` seeds `placed` with entry cards +
  zeroed `wrongWires`/`decoyAdds`; `ADD_CARD` (dup no-op, decoy bumps
  `decoyAdds`, move count); `REMOVE_CARD` drops edges + node + move;
  `WRONG_WIRE` bumps the counter only; existing WIN guard stays.
- `commands.test.ts`: `add`/`remove`/`cards` parse + gating; `ls` games
  at menu; node-id + tray/placed validation; help text mentions the new
  verbs.
- `architectures.test.ts`: bump `DIFFICULTIES` to include `expert`;
  update `bootOrder` calls to the `(arch, placed, edges)` signature with
  `placed = entryCards`-reachable... use `placed = all non-decoy ids` for
  the reference-topology assertions; assert every scenario has >=1 decoy
  (except none required), decoys are referenced by NO edge, every
  required edge is recreatable via `judgeWire(arch, allNonDecoy, a, b)`
  (winnability guard), and the non-decoy reference topology has no
  unreachable. Assert >= 6 scenarios.

## Reuse / non-goals

Reuses: reducer + dispatch core, the Diagram drag engine, the boot
animation + WIN hold, Terminal, the shared motion language, DetailDrawer.
Non-goals: persistence/leaderboard, multiplayer, a layout rewrite for the
expert board (drag is sufficient), animated tray transitions beyond the
existing motion tokens, naming which card is a decoy anywhere in the UI.
