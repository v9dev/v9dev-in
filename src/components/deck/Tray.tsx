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
        <span className="text-[10px] uppercase tracking-widest text-muted">
          tray - cards to place
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted/70">
          {tray.length} left
        </span>
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
