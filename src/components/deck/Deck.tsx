import { architectureBySlug } from '@content/architectures';
import { prefersReducedMotion, stagger } from '@lib/motion';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Diagram from './Diagram';
import Terminal from './Terminal';
import { bootOrder, canConnect } from './board';
import type { Command } from './commands';
import { deckReducer, initDeckState } from './state';

const arch = architectureBySlug['stalwart-mail'];

// Per-node pulse interval for the animated boot, sourced from the shared motion
// language (never hard-code durations in JS). `stagger.large` is in seconds.
const BOOT_STEP_MS = stagger.large * 1000;

const bootUpLine = (id: string): string => `boot: ${id} ... up`;
const bootUnreachableLine = (id: string): string =>
  `boot: ${id} unreachable - missing a required wire`;

export default function Deck() {
  const [state, dispatch] = useReducer(deckReducer, arch, initDeckState);
  // Local chart selection - the chart itself is wired in Group F.
  const [, setSkillsCluster] = useState<string | null>(null);

  // A single batched, screen-reader-only summary of the last boot. Updated once
  // per boot (not line-by-line) so the live region is never flooded - the
  // visual per-step log lines below are scroll content, this is the announcement.
  const [bootStatus, setBootStatus] = useState('');

  // Pending boot timers; cleared on re-trigger and on unmount.
  const bootTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearBootTimers = useCallback(() => {
    for (const t of bootTimersRef.current) clearTimeout(t);
    bootTimersRef.current = [];
  }, []);

  // Boot effect: run when state.boot.running transitions false -> true. Computes
  // the dependency order from the CURRENT edges, then either (reduced motion)
  // batches every status line + sets nodes up in one synchronous flush, or
  // (default) steps through the order one node per BOOT_STEP_MS tick. Either way
  // a single batched bootStatus drives the dedicated live region.
  const running = state.boot.running;
  const edges = state.edges;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed off the boot.running edge; reads current edges intentionally at trigger time.
  useEffect(() => {
    if (!running) return;
    clearBootTimers();
    const r = bootOrder(arch, edges);
    const summaryParts = [
      `boot complete - ${r.up.length} up`,
      ...(r.unreachable.length ? [`${r.unreachable.length} unreachable`] : []),
    ];

    if (prefersReducedMotion()) {
      // Instant: set every reachable node up, print every status line in one
      // synchronous batch (React coalesces these into a single render, so the
      // live region updates once), then finish.
      dispatch({ type: 'BOOT_STEP', up: r.up, unreachable: r.unreachable });
      for (const id of r.order) dispatch({ type: 'LOG', kind: 'output', text: bootUpLine(id) });
      for (const id of r.unreachable) {
        dispatch({ type: 'LOG', kind: 'error', text: bootUnreachableLine(id) });
      }
      dispatch({ type: 'BOOT_DONE' });
      setBootStatus(summaryParts.join(', '));
      return;
    }

    // Animated: grow `up` one node per tick with a matching status line, then
    // flag any unreachable nodes, then finish. Timers are tracked for cleanup.
    const up: string[] = [];
    r.order.forEach((id, i) => {
      const t = setTimeout(() => {
        up.push(id);
        dispatch({ type: 'BOOT_STEP', up: [...up], unreachable: [] });
        dispatch({ type: 'LOG', kind: 'output', text: bootUpLine(id) });
      }, i * BOOT_STEP_MS);
      bootTimersRef.current.push(t);
    });
    const tail = setTimeout(() => {
      dispatch({ type: 'BOOT_STEP', up: r.up, unreachable: r.unreachable });
      for (const id of r.unreachable) {
        dispatch({ type: 'LOG', kind: 'error', text: bootUnreachableLine(id) });
      }
      dispatch({ type: 'BOOT_DONE' });
      setBootStatus(summaryParts.join(', '));
    }, r.order.length * BOOT_STEP_MS);
    bootTimersRef.current.push(tail);
  }, [running, clearBootTimers]);

  // Cancel any in-flight boot timers on unmount.
  useEffect(() => clearBootTimers, [clearBootTimers]);

  const runCommand = useCallback((cmd: Command) => {
    if (cmd.kind === 'print') {
      for (const text of cmd.lines) dispatch({ type: 'LOG', kind: 'output', text });
      return;
    }
    if (cmd.kind === 'error') {
      dispatch({ type: 'LOG', kind: 'error', text: cmd.message });
      return;
    }
    if (cmd.kind === 'skills') {
      setSkillsCluster(cmd.cluster);
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: `skills${cmd.cluster ? ` ${cmd.cluster}` : ''}`,
      });
      return; // chart wired in Group F
    }
    // action
    dispatch({ type: 'LOG', kind: 'input', text: cmd.echo });
    const a = cmd.action;
    if (a.type === 'CONNECT') {
      const v = canConnect(arch, a.from, a.to);
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
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Terminal arch={arch} log={state.log} history={state.history} onRun={runCommand} />
      <Diagram arch={arch} state={state} dispatch={dispatch} onRun={runCommand} />
      {/* Single batched boot announcement - updated once per boot so the live
          region is never flooded line-by-line. <output> has an implicit
          role=status / aria-live=polite. */}
      <output className="sr-only">{bootStatus}</output>
    </div>
  );
}
