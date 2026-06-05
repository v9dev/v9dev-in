import type { Architecture } from '@content/architectures';
import { cn } from '@lib/cn';
import { useEffect, useRef, useState } from 'react';
import { complete, parse } from './commands';
import type { Command } from './commands';
import type { LogKind, LogLine } from './state';

interface Props {
  arch: Architecture;
  log: LogLine[];
  history: string[];
  onRun: (cmd: Command) => void;
}

const HINTS = ['help', 'ls', 'connect nginx stalwart', 'boot', 'reset', 'skills'] as const;

const LINE_CLASS: Record<LogKind, string> = {
  input: 'text-text/55',
  output: 'text-text',
  error: 'text-fuchsia',
  system: 'text-muted',
  // Machine-paced boot output - same look as `output`, but rendered aria-hidden
  // below so the rapid burst is excluded from the live region (the batched
  // <output> summary in Deck is the single announcement).
  boot: 'text-text',
};

/** Longest common prefix of a list of strings. */
function commonPrefix(items: string[]): string {
  if (items.length === 0) return '';
  let prefix = items[0];
  for (const item of items.slice(1)) {
    while (!item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

export default function Terminal({ arch, log, history, onRun }: Props) {
  const [value, setValue] = useState('');
  const [histIndex, setHistIndex] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the log pinned to the latest line.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every log change.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const submit = () => {
    const text = value;
    if (!text.trim()) return;
    onRun(parse(text, arch));
    setValue('');
    setHistIndex(null);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const options = complete(value, arch);
      if (options.length === 0) return;
      const parts = value.trimStart().split(/\s+/);
      const head = parts.slice(0, -1).join(' ');
      const filled = commonPrefix(options);
      setValue(head ? `${head} ${filled}` : filled);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = histIndex === null ? history.length - 1 : Math.max(0, histIndex - 1);
      setHistIndex(next);
      setValue(history[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIndex === null) return;
      const next = histIndex + 1;
      if (next >= history.length) {
        setHistIndex(null);
        setValue('');
      } else {
        setHistIndex(next);
        setValue(history[next]);
      }
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-elevated/70 backdrop-blur-xl overflow-hidden h-[clamp(22rem,60vh,40rem)]">
      <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-fuchsia/70" aria-hidden />
        <span className="size-2.5 rounded-full bg-cyan/70" aria-hidden />
        <span className="size-2.5 rounded-full bg-lime/70" aria-hidden />
        <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-muted">
          deck://terminal
        </span>
      </div>

      <div
        ref={logRef}
        data-lenis-prevent
        role="log"
        aria-live="polite"
        aria-label="deck terminal output"
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed"
      >
        {log.map((line) => (
          <div
            key={line.id}
            // `boot` lines are visible scroll content but excluded from this
            // live region's announcement (the burst would otherwise flood it);
            // the batched <output> summary in Deck announces the boot result.
            aria-hidden={line.kind === 'boot' ? true : undefined}
            className={cn('whitespace-pre-wrap break-words', LINE_CLASS[line.kind])}
          >
            {line.kind === 'input' ? <span className="text-lime/70">$ </span> : null}
            {line.text}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-line/60 px-4 py-2.5">
        {HINTS.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => {
              onRun(parse(hint, arch));
              inputRef.current?.focus();
            }}
            className="rounded-full border border-line/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted transition-colors hover:border-lime hover:text-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            data-cursor-label="run"
          >
            {hint}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-line/60 px-4 py-3">
        <span className="font-mono text-sm text-lime" aria-hidden>
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="deck terminal input"
          placeholder="type a command - try 'help'"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          className="flex-1 bg-transparent font-mono text-sm text-text caret-lime placeholder:text-muted/60 focus:outline-none"
        />
      </div>
    </div>
  );
}
