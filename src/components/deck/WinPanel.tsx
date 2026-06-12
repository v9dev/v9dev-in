import type { Architecture } from '@content/architectures';
import { scoreState } from './scoring';
import type { DeckState } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
  /** The next scenario to advance to (null when this was the last one). */
  next: Architecture | null;
  /** Load the next scenario (runs `play <nextSlug>`). */
  onNext: () => void;
  /** Return to the game menu (runs `menu`). */
  onMenu: () => void;
}

// Format an elapsed millisecond span as m:ss (e.g. 2:07).
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// The win screen shown in the diagram area while phase==='won': a concise
// SYSTEM ONLINE block with the run's time / moves / hints, then `next` (advance
// to the next scenario) and `menu` actions. Both also work as typed commands
// (`menu`, and `play <id>` for any specific level).
export default function WinPanel({ arch, state, next, onNext, onMenu }: Props) {
  const elapsed =
    state.startedAt != null && state.wonAt != null ? state.wonAt - state.startedAt : 0;
  const sc = scoreState(arch, state);

  return (
    <div className="flex h-[clamp(22rem,60vh,40rem)] flex-col items-center justify-center gap-6 rounded-2xl border border-lime/60 bg-canvas/60 p-6 text-center font-mono">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-lime">system online</span>
        <h2 className="font-display text-2xl text-text">{arch.title}</h2>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-4xl text-lime">{sc.grade}</span>
          <span className="text-sm text-muted tabular-nums">
            {sc.score}/{sc.max}
          </span>
        </div>
        {sc.perfect && (
          <span className="rounded-full border border-lime px-3 py-1 text-[10px] uppercase tracking-widest text-lime">
            perfect run
          </span>
        )}
      </div>

      <dl className="grid grid-cols-4 gap-x-6 gap-y-1 text-center">
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-widest text-muted">time</dt>
          <dd className="text-lg text-lime tabular-nums">{formatElapsed(elapsed)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-widest text-muted">moves</dt>
          <dd className="text-lg text-text tabular-nums">{state.moves}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-widest text-muted">wrong</dt>
          <dd className="text-lg text-text tabular-nums">{state.wrongWires}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-widest text-muted">hints</dt>
          <dd className="text-lg text-text tabular-nums">{state.hintsUsed}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {next ? (
          <button
            type="button"
            onClick={onNext}
            data-cursor-label="next"
            className="rounded-full border border-lime bg-lime/10 px-4 py-2 text-[11px] uppercase tracking-widest text-lime transition-colors hover:bg-lime/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            next: {next.slug} -&gt;
          </button>
        ) : (
          <span className="text-[11px] uppercase tracking-widest text-muted">
            all games complete
          </span>
        )}
        <button
          type="button"
          onClick={onMenu}
          data-cursor-label="menu"
          className="rounded-full border border-line/80 px-4 py-2 text-[11px] uppercase tracking-widest text-muted transition-colors hover:border-lime hover:text-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          menu
        </button>
      </div>
    </div>
  );
}
