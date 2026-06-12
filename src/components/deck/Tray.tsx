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

// The card tray: a thin full-width strip docked under the board, listing every
// card not yet placed (real AND decoy, no tell) as chips in a single
// horizontally-scrolling row. A chip runs `add <id>` through the same parse path
// as typing it, so the terminal log + state stay in sync. Empty when all placed.
export default function Tray({ arch, state, ctx, onRun }: Props) {
  const tray = arch.nodes.filter((n) => !state.placed.includes(n.id));
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-elevated/70 px-4 py-2.5 font-mono backdrop-blur-xl">
      <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted">
        tray{tray.length > 0 ? ` · ${tray.length}` : ''}
      </span>
      {tray.length === 0 ? (
        <span className="text-[11px] text-muted">empty - all cards placed</span>
      ) : (
        <ul className="flex flex-1 gap-2 overflow-x-auto pb-0.5" data-lenis-prevent>
          {tray.map((n) => (
            <li key={n.id} className="shrink-0">
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
