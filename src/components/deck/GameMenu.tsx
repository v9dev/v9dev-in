import { type Architecture, architectures } from '@content/architectures';
import { cn } from '@lib/cn';
import type { Command, Ctx } from './commands';
import { parse } from './commands';

interface Props {
  ctx: Ctx;
  onRun: (cmd: Command) => void;
}

const DIFFICULTY_CLASS: Record<Architecture['difficulty'], string> = {
  easy: 'text-lime',
  medium: 'text-cyan',
  hard: 'text-fuchsia',
};

// The scenario picker shown in the diagram area while phase==='menu'. The `ls`
// table is the menu - each row is a clickable card that runs `play <id>` through
// the SAME parse path as typing it, so the terminal log + state stay in sync.
export default function GameMenu({ ctx, onRun }: Props) {
  return (
    <div className="flex h-[clamp(22rem,60vh,40rem)] flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-canvas/60 p-5 font-mono">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted">select a game</p>
        <p className="mt-1 text-[12.5px] text-text">
          pick a scenario below, or type <span className="text-lime">play &lt;id&gt;</span> in the
          terminal.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {architectures.map((a) => (
          <li key={a.slug}>
            <button
              type="button"
              onClick={() => onRun(parse(`play ${a.slug}`, ctx))}
              data-cursor-label="play"
              className="group flex w-full flex-col gap-1.5 rounded-xl border border-line bg-elevated/60 px-4 py-3 text-left transition-colors hover:border-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-text">{a.title}</span>
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-widest',
                    DIFFICULTY_CLASS[a.difficulty],
                  )}
                >
                  {a.difficulty}
                </span>
              </div>
              <span className="text-[11px] text-muted">{a.objective}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted/70 transition-colors group-hover:text-lime">
                play {a.slug} -&gt;
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
