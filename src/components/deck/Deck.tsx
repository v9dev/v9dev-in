import { type Architecture, architectureBySlug } from '@content/architectures';
import { prefersReducedMotion, stagger } from '@lib/motion';
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
import Terminal from './Terminal';
import { bootOrder, canConnect, isComplete, nextHint, objectiveProgress } from './board';
import type { Command, Ctx, GameVerb } from './commands';
import { type DeckAction, type DeckState, deckReducer, initDeckState } from './state';

const arch = architectureBySlug['stalwart-mail'];

// Per-node pulse interval for the animated boot, sourced from the shared motion
// language (never hard-code durations in JS). `stagger.large` is in seconds.
const BOOT_STEP_MS = stagger.large * 1000;

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
    case 'status': {
      const p = objectiveProgress(activeArch, state.edges);
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: `progress ${p.pct}% - ${p.satisfied}/${p.total} required wires`,
      });
      if (p.extra.length > 0) {
        dispatch({
          type: 'LOG',
          kind: 'output',
          text: `extra wires (not required): ${p.extra.map((e) => `${e.from}->${e.to}`).join(', ')}`,
        });
      }
      if (p.missing.length > 0) {
        dispatch({
          type: 'LOG',
          kind: 'output',
          text: `missing: ${p.missing.map((e) => `${e.from}->${e.to}`).join(', ')}`,
        });
      } else {
        dispatch({ type: 'LOG', kind: 'output', text: "all required wires present - try 'boot'" });
      }
      return;
    }
    case 'hint': {
      dispatch({ type: 'HINT' });
      const h = nextHint(activeArch, state.edges);
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: h
          ? `hint: connect ${h.from} ${h.to}`
          : 'nothing to wire - all required wires present',
      });
      return;
    }
    case 'boot': {
      if (isComplete(activeArch, state.edges)) {
        dispatch({ type: 'WIN', at: Date.now() });
      }
      // The boot animation runs as the reward (and as the failure report when
      // the topology is incomplete - unreachable nodes are flagged in the log).
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
    const r = bootOrder(activeArch, state.edges);
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
        const v = canConnect(activeArch, a.from, a.to);
        if (!v.ok) {
          dispatch({ type: 'LOG', kind: 'error', text: `! ${v.reason}` });
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
  const ctx: Ctx = {
    phase: state.phase,
    arch: state.phase === 'menu' ? null : activeArch,
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Terminal ctx={ctx} log={state.log} history={state.history} onRun={runCommand} />
      <Diagram arch={activeArch} state={state} dispatch={dispatch} onRun={runCommand} />
      <DetailDrawer node={selectedNode} open={state.selectedNodeId != null} onClose={closeDrawer} />
      {/* Single batched boot announcement - the per-step `boot:` up-lines render
          aria-hidden inside the Terminal log, so this <output> (implicit
          role=status / aria-live=polite) is the only polite boot announcement
          and the live region is never flooded line-by-line. */}
      <output className="sr-only">{bootStatus}</output>
    </div>
  );
}
