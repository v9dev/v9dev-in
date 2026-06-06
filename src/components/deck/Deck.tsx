import { type Architecture, architectureBySlug, architectures } from '@content/architectures';
import { durations, prefersReducedMotion, stagger } from '@lib/motion';
import {
  type Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import DetailDrawer from './DetailDrawer';
import Diagram from './Diagram';
import GameMenu from './GameMenu';
import Hud from './Hud';
import Terminal from './Terminal';
import Tray from './Tray';
import WinPanel from './WinPanel';
import { bootOrder, hintFor, isComplete, judgeWire, objectiveProgress } from './board';
import { type Command, type Ctx, type GameVerb, parse } from './commands';
import { SCORE, scoreState } from './scoring';
import { type DeckAction, type DeckState, deckReducer, initDeckState } from './state';

const arch = architectureBySlug['stalwart-mail'];

// Per-node pulse interval for the animated boot, sourced from the shared motion
// language (never hard-code durations in JS). `stagger.large` is in seconds.
const BOOT_STEP_MS = stagger.large * 1000;
// After a winning boot, hold on the fully-lit diagram for one pulse cycle so the
// fire-up animation is actually seen before the WinPanel replaces the diagram.
const WIN_HOLD_MS = durations.pulse * 1000;

const bootUpLine = (id: string): string => `boot: ${id} ... up`;
const bootUnreachableLine = (id: string): string =>
  `boot: ${id} unreachable - missing a required wire`;

// Resolve a high-level game verb against the live board. Date.now() is captured
// HERE (the browser island), never in the reducer, and passed via the action
// `at` field so the reducer stays pure. The HUD/menu/win-panel UI is layered on
// top of this state in a later task; this is the command-driven core loop.
function runGame(
  cmd: { kind: 'game'; verb: GameVerb; arg?: string; echo: string },
  activeArch: Architecture,
  state: DeckState,
  dispatch: Dispatch<DeckAction>,
): void {
  dispatch({ type: 'LOG', kind: 'input', text: cmd.echo });
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
      // The boot animation runs as the reward (and as the failure report when
      // the topology is incomplete - unreachable nodes are flagged in the log).
      // A complete topology wins, but the WIN is dispatched by the boot effect
      // AFTER the fire-up animation finishes (not here) so the on-diagram pulse
      // is seen before the WinPanel replaces the diagram.
      dispatch({ type: 'BOOT_START' });
      return;
    }
  }
}

export default function Deck() {
  const [state, dispatch] = useReducer(deckReducer, arch, initDeckState);
  // The arch currently in play is keyed off the session slug (PLAY swaps it),
  // falling back to the default scenario.
  const activeArch = architectureBySlug[state.archSlug] ?? arch;

  // A single batched, screen-reader-only summary of the last boot. The rapid
  // per-step `boot:` up-lines are dispatched as the `boot` LogKind, which the
  // Terminal renders aria-hidden (visible scroll content, excluded from its
  // role=log live region) - so they never flood the announcement. This <output>
  // is the one polite announcement of the up-count. The unreachable lines stay
  // `error` (red, low-volume, genuinely live) and announce themselves, so the
  // summary deliberately omits the unreachable count to avoid double-announcing.
  const [bootStatus, setBootStatus] = useState('');

  // Pending boot timers; cleared on re-trigger and on unmount.
  const bootTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearBootTimers = useCallback(() => {
    for (const t of bootTimersRef.current) clearTimeout(t);
    bootTimersRef.current = [];
  }, []);

  // Boot effect: run on every BOOT_START. The effect is keyed off the monotonic
  // `bootSeq` token (not the `running` boolean) so re-typing `boot` mid-animation
  // still re-runs the effect, clears the prior run's in-flight timers, and starts
  // fresh - otherwise stale timers from the previous run would repopulate `up`.
  // Computes the dependency order from the CURRENT edges, then either (reduced
  // motion) batches every status line + sets nodes up in one synchronous flush,
  // or (default) steps through the order one node per BOOT_STEP_MS tick. Either
  // way a single batched bootStatus drives the dedicated live region.
  const bootSeq = state.bootSeq;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed off the bootSeq token; reads current boot.running + edges intentionally at trigger time.
  useEffect(() => {
    // Clear BEFORE the guard: a reset/load mid-animation changes bootSeq and sets
    // running=false, re-running this effect - we must cancel in-flight timers then,
    // or stale ticks would fire BOOT_STEP/LOG against the freshly-reset state.
    clearBootTimers();
    if (!state.boot.running) return;
    const r = bootOrder(activeArch, state.edges, state.placed);
    // Single polite announcement: only the up-count. The unreachable `error`
    // lines are themselves live and announce per node, so the summary omits the
    // unreachable count to avoid double-announcing the same information.
    const summary = `boot complete - ${r.up.length} up`;

    if (prefersReducedMotion()) {
      // Instant: set every reachable node up, print every status line in one
      // synchronous batch. The `boot` up-lines are visible-but-not-live; the
      // `error` unreachable lines are live, and <output> announces the up-count.
      dispatch({ type: 'BOOT_STEP', up: r.up, unreachable: r.unreachable });
      for (const id of r.order) dispatch({ type: 'LOG', kind: 'boot', text: bootUpLine(id) });
      for (const id of r.unreachable) {
        dispatch({ type: 'LOG', kind: 'error', text: bootUnreachableLine(id) });
      }
      dispatch({ type: 'BOOT_DONE' });
      setBootStatus(summary);
      // No animation to wait out under reduced motion - win immediately.
      if (isComplete(activeArch, state.edges, state.placed)) {
        dispatch({ type: 'WIN', at: Date.now() });
      }
      return;
    }

    // Animated: grow `up` one node per tick with a matching status line, then
    // flag any unreachable nodes, then finish. Timers are tracked for cleanup.
    // Up-lines are the `boot` kind (excluded from the live region) so the
    // animated burst never floods the announcement.
    const up: string[] = [];
    r.order.forEach((id, i) => {
      const t = setTimeout(() => {
        up.push(id);
        dispatch({ type: 'BOOT_STEP', up: [...up], unreachable: [] });
        dispatch({ type: 'LOG', kind: 'boot', text: bootUpLine(id) });
      }, i * BOOT_STEP_MS);
      bootTimersRef.current.push(t);
    });
    const tail = setTimeout(() => {
      dispatch({ type: 'BOOT_STEP', up: r.up, unreachable: r.unreachable });
      for (const id of r.unreachable) {
        dispatch({ type: 'LOG', kind: 'error', text: bootUnreachableLine(id) });
      }
      dispatch({ type: 'BOOT_DONE' });
      setBootStatus(summary);
    }, r.order.length * BOOT_STEP_MS);
    bootTimersRef.current.push(tail);

    // A complete topology wins, but only AFTER the fire-up is seen: hold one
    // pulse past the last node, then dispatch WIN. Registered up-front in the
    // same timer list so a reset (bumps bootSeq, re-runs this effect) cancels
    // it; the reducer also ignores WIN unless still playing, covering a `menu`
    // typed during the hold.
    if (isComplete(activeArch, state.edges, state.placed)) {
      const win = setTimeout(
        () => dispatch({ type: 'WIN', at: Date.now() }),
        r.order.length * BOOT_STEP_MS + WIN_HOLD_MS,
      );
      bootTimersRef.current.push(win);
    }
  }, [bootSeq, clearBootTimers]);

  // Cancel any in-flight boot timers on unmount.
  useEffect(() => clearBootTimers, [clearBootTimers]);

  const runCommand = useCallback(
    (cmd: Command) => {
      if (cmd.kind === 'print') {
        for (const text of cmd.lines) dispatch({ type: 'LOG', kind: 'output', text });
        return;
      }
      if (cmd.kind === 'error') {
        dispatch({ type: 'LOG', kind: 'error', text: cmd.message });
        return;
      }
      if (cmd.kind === 'game') {
        runGame(cmd, activeArch, state, dispatch);
        return;
      }
      // action
      dispatch({ type: 'LOG', kind: 'input', text: cmd.echo });
      const a = cmd.action;
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
      if (a.type === 'DISCONNECT') {
        dispatch(a);
        dispatch({ type: 'LOG', kind: 'output', text: `UNLINK ${a.from} -> ${a.to}` });
        return;
      }
      dispatch(a);
    },
    [activeArch, state],
  );

  // Drawer open is derived: the drawer is open whenever a node is selected.
  const selectedNode = useMemo(
    () => activeArch.nodes.find((n) => n.id === state.selectedNodeId) ?? null,
    [activeArch, state.selectedNodeId],
  );
  const closeDrawer = useCallback(() => dispatch({ type: 'SELECT_NODE', id: null }), []);

  // Parse context for the terminal: the live phase + the loaded arch (null at
  // the menu) drive node-id validation, completion, and menu-phase gating.
  // Memoized so the WinPanel/menu callbacks below can depend on a stable ref.
  const ctx: Ctx = useMemo(
    () => ({
      phase: state.phase,
      arch: state.phase === 'menu' ? null : activeArch,
    }),
    [state.phase, activeArch],
  );

  // The next scenario after the one just won, for the WinPanel `next` action
  // (null when the current arch is the last in the list).
  const nextArch = useMemo(() => {
    const i = architectures.findIndex((a) => a.slug === activeArch.slug);
    return i >= 0 ? (architectures[i + 1] ?? null) : null;
  }, [activeArch.slug]);

  // WinPanel/GameMenu actions flow through the SAME parse + runCommand path as
  // typed commands so the terminal log and session state stay in sync. `next`
  // is `play <slug>` for the following scenario; `menu` is the menu verb.
  const playNext = useCallback(() => {
    if (nextArch) runCommand(parse(`play ${nextArch.slug}`, ctx));
  }, [ctx, nextArch, runCommand]);
  const goMenu = useCallback(() => runCommand(parse('menu', ctx)), [ctx, runCommand]);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Terminal ctx={ctx} log={state.log} history={state.history} onRun={runCommand} />
      <div className="flex flex-col gap-4">
        {state.phase === 'playing' && <Hud arch={activeArch} state={state} />}
        {state.phase === 'playing' && (
          <Tray arch={activeArch} state={state} ctx={ctx} onRun={runCommand} />
        )}
        {state.phase === 'menu' ? (
          <GameMenu ctx={ctx} onRun={runCommand} />
        ) : state.phase === 'won' ? (
          <WinPanel
            arch={activeArch}
            state={state}
            next={nextArch}
            onNext={playNext}
            onMenu={goMenu}
          />
        ) : (
          <Diagram arch={activeArch} state={state} dispatch={dispatch} onRun={runCommand} />
        )}
      </div>
      <DetailDrawer node={selectedNode} open={state.selectedNodeId != null} onClose={closeDrawer} />
      {/* Single batched boot announcement - the per-step `boot:` up-lines render
          aria-hidden inside the Terminal log, so this <output> (implicit
          role=status / aria-live=polite) is the only polite boot announcement
          and the live region is never flooded line-by-line. */}
      <output className="sr-only">{bootStatus}</output>
    </div>
  );
}
