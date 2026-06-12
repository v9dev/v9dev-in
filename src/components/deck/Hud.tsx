import type { Architecture } from '@content/architectures';
import { cn } from '@lib/cn';
import { useEffect, useState } from 'react';
import { objectiveProgress } from './board';
import { scoreState } from './scoring';
import type { DeckState } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
}

// Format an elapsed millisecond span as m:ss (e.g. 2:07). Clamped at 0 so a
// not-yet-started session reads 0:00 rather than a negative value.
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Live play HUD: a thin full-width bar across the top of the deck so the terminal
// and board below can sit side-by-side at equal height. One wrapping row -
// objective, grade + score, wires, cards, moves, timer, hints, wrong, % - over a
// slim progress line, with a decoy warning when any decoy is on the board.
// Rendered only while phase==='playing' (the parent gates it). The timer is the
// one piece that needs a tick - a 1s interval keyed off startedAt; Date.now() is
// read here in the island, never in the reducer. mono + lime accent on tokens.
export default function Hud({ arch, state }: Props) {
  const p = objectiveProgress(arch, state.edges, state.placed);
  const sc = scoreState(arch, state);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while a session is running so the timer stays live. The
  // interval is the only periodic work and it stops as soon as startedAt clears.
  useEffect(() => {
    if (state.startedAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.startedAt]);

  const elapsed = state.startedAt == null ? 0 : now - state.startedAt;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-elevated/70 px-4 py-2.5 font-mono backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-widest text-muted">
        {/* Objective grows to push the stats to the right edge of the bar. */}
        <span className="mr-auto text-[12px] normal-case text-text">{arch.objective}</span>
        <span className="flex items-baseline gap-1.5">
          grade
          <span className="text-base normal-case leading-none text-lime tabular-nums">
            {sc.grade}
          </span>
          <span className="normal-case text-muted tabular-nums">
            {sc.score}/{sc.max}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          wires
          <span className="normal-case text-text tabular-nums">
            {p.satisfied}/{p.total}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          cards
          <span className="normal-case text-text tabular-nums">
            {state.placed.length}/{state.placed.length + p.missingCards.length}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          moves
          <span className="normal-case text-text tabular-nums">{state.moves}</span>
        </span>
        <span className="flex items-center gap-1.5">
          time
          <span className="normal-case text-text tabular-nums">{formatElapsed(elapsed)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          hints
          <span
            className={cn(
              'normal-case tabular-nums',
              state.hintsUsed > 0 ? 'text-fuchsia' : 'text-text',
            )}
          >
            {state.hintsUsed}
          </span>
        </span>
        {state.wrongWires > 0 && (
          <span className="flex items-center gap-1.5">
            wrong
            <span className="normal-case text-fuchsia tabular-nums">{state.wrongWires}</span>
          </span>
        )}
        <span className="normal-case text-lime tabular-nums">{p.pct}%</span>
      </div>

      {/* Determinate progress: a styled overlay bar is the visual, with a
          visually-hidden native <progress> carrying the accessible value (the
          native element avoids the noninteractive-role lint a role="progressbar"
          div would trip). */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-line/50">
        <div
          className="h-full rounded-full bg-lime transition-[width] duration-300"
          style={{ width: `${p.pct}%` }}
        />
        <progress className="sr-only" aria-label="objective progress" value={p.pct} max={100} />
      </div>

      {p.decoysOnBoard.length > 0 && (
        <p className="text-[10px] uppercase tracking-widest text-fuchsia">
          {p.decoysOnBoard.length} placed card(s) do not belong
        </p>
      )}
    </div>
  );
}
