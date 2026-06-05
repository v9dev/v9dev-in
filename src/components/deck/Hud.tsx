import type { Architecture } from '@content/architectures';
import { cn } from '@lib/cn';
import { useEffect, useState } from 'react';
import { objectiveProgress } from './board';
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

// Live play HUD: objective, a progress bar (% required wires), connections N/M,
// moves, an elapsed timer, and hints used. Rendered only while phase==='playing'
// (the parent gates it). The timer is the one piece that needs a tick - a 1s
// interval keyed off startedAt; Date.now() is read here in the island, never in
// the reducer. mono + lime accent on the shared tokens.
export default function Hud({ arch, state }: Props) {
  const p = objectiveProgress(arch, state.edges);
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
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-elevated/70 px-4 py-3 font-mono backdrop-blur-xl">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-text">{arch.objective}</span>
        <span className="text-[11px] text-lime tabular-nums">{p.pct}%</span>
      </div>

      {/* Determinate progress: a styled overlay bar is the visual, with a
          visually-hidden native <progress> carrying the accessible value (the
          native element avoids the noninteractive-role lint a role="progressbar"
          div would trip). */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line/50">
        <div
          className="h-full rounded-full bg-lime transition-[width] duration-300"
          style={{ width: `${p.pct}%` }}
        />
        <progress className="sr-only" aria-label="objective progress" value={p.pct} max={100} />
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-muted">
        <div className="flex items-center gap-1.5">
          <dt>wires</dt>
          <dd className="tabular-nums text-text">
            {p.satisfied}/{p.total}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>moves</dt>
          <dd className="tabular-nums text-text">{state.moves}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>time</dt>
          <dd className="tabular-nums text-text">{formatElapsed(elapsed)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>hints</dt>
          <dd className={cn('tabular-nums', state.hintsUsed > 0 ? 'text-fuchsia' : 'text-text')}>
            {state.hintsUsed}
          </dd>
        </div>
      </dl>
    </div>
  );
}
