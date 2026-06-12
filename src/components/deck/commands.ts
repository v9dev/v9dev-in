import { type Architecture, architectureBySlug, architectures } from '@content/architectures';
import type { DeckAction, GamePhase } from './state';

// A parsed terminal command. `action` flows straight to the reducer; `print`
// emits log lines; `game` carries a high-level game verb the Deck runner
// resolves (it captures Date.now() for the actions that need a timestamp, so
// the reducer stays pure); `error` is a friendly message.
export type Command =
  | { kind: 'action'; action: DeckAction; echo: string }
  | { kind: 'print'; lines: string[] }
  | { kind: 'game'; verb: GameVerb; arg?: string; echo: string }
  | { kind: 'error'; message: string };

// High-level game verbs handled by the Deck runner (not the pure reducer).
// `play`/`reset` need a captured timestamp; `status`/`hint`/`boot` read the
// live board; `menu` returns to the scenario picker.
export type GameVerb =
  | 'play'
  | 'status'
  | 'hint'
  | 'boot'
  | 'menu'
  | 'reset'
  | 'add'
  | 'remove'
  | 'cards';

// Parse context: the current session phase and the loaded scenario (null at the
// menu). Node-id validation and completion read `arch`; phase gates gameplay
// verbs so they print a friendly redirect at the menu.
export interface Ctx {
  phase: GamePhase;
  arch: Architecture | null;
}

// The frozen v1 vocabulary. Aliases share a canonical verb; the first column is
// what `complete` offers and `help` documents.
export const VERBS = [
  'help',
  'ls',
  'games',
  'play',
  'start',
  'connect',
  'link',
  'disconnect',
  'unlink',
  'status',
  'hint',
  'boot',
  'fireup',
  'reset',
  'menu',
  'back',
  'add',
  'remove',
  'cards',
  'clear',
] as const;

// Verbs that only make sense once a scenario is loaded. At the menu they print
// "load a game first - try `ls`" instead of failing obscurely.
const GAMEPLAY_VERBS = new Set([
  'connect',
  'link',
  'disconnect',
  'unlink',
  'status',
  'hint',
  'boot',
  'fireup',
  'reset',
  'menu',
  'back',
  'add',
  'remove',
  'cards',
]);

// One row per scenario for the `ls` / menu table: id, difficulty, objective.
function scenarioLines(): string[] {
  return [
    'games:',
    ...architectures.map((a) => `  ${a.slug.padEnd(14)} ${a.difficulty.padEnd(7)} ${a.objective}`),
    "type 'play <id>' to start",
  ];
}

export function helpText(_ctx?: Ctx): string[] {
  return [
    'commands:',
    '  help                show this guide',
    '  ls | games          list the games',
    '  play | start <id>   load a game (unwired)',
    '  ls | cards          list cards (board + tray) while playing',
    '  add <id>            place a tray card on the board',
    '  remove <id>         return a card to the tray',
    '  connect | link <a> <b>      wire node a -> node b',
    '  disconnect | unlink <a> <b> remove the wire a -> b',
    '  status              progress, connections, missing wires',
    '  hint                a nudge - not the answer',
    '  boot | fireup       fire up the server - win if correct',
    '  reset               restart the current game (unwired)',
    '  menu | back         return to the game menu',
    '  clear               clear the log',
  ];
}

export function parse(input: string, ctx: Ctx): Command {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'print', lines: [] };
  const [verb, ...args] = trimmed.split(/\s+/);

  // Always-available verbs first (work in any phase).
  switch (verb) {
    case 'help':
      return { kind: 'print', lines: helpText(ctx) };
    case 'games':
      return { kind: 'print', lines: scenarioLines() };
    case 'ls':
      if (ctx.phase === 'menu' || !ctx.arch) return { kind: 'print', lines: scenarioLines() };
      return { kind: 'game', verb: 'cards', echo: 'ls' };
    case 'clear':
      return { kind: 'action', action: { type: 'CLEAR' }, echo: 'clear' };
    case 'play':
    case 'start': {
      const id = args[0];
      if (!id) return { kind: 'error', message: `usage: ${verb} <id> - try 'ls'` };
      if (!architectureBySlug[id]) {
        return { kind: 'error', message: `unknown game: ${id} - try 'ls'` };
      }
      return { kind: 'game', verb: 'play', arg: id, echo: `play ${id}` };
    }
  }

  // Every remaining verb is gameplay - gate it on a loaded scenario.
  if (ctx.phase === 'menu' || !ctx.arch) {
    if (GAMEPLAY_VERBS.has(verb)) {
      return { kind: 'error', message: "load a game first - try 'ls'" };
    }
    return { kind: 'error', message: `command not found: ${verb} - try 'help'` };
  }

  const arch = ctx.arch;
  const ids = new Set(arch.nodes.map((n) => n.id));

  switch (verb) {
    case 'status':
      return { kind: 'game', verb: 'status', echo: 'status' };
    case 'hint':
      return { kind: 'game', verb: 'hint', echo: 'hint' };
    case 'boot':
    case 'fireup':
      return { kind: 'game', verb: 'boot', echo: verb };
    case 'menu':
    case 'back':
      return { kind: 'game', verb: 'menu', echo: verb };
    case 'reset':
      // The runner captures Date.now() and dispatches RESET - the reducer never
      // reads the clock, so it stays pure.
      return { kind: 'game', verb: 'reset', echo: 'reset' };
    case 'cards':
      return { kind: 'game', verb: 'cards', echo: 'cards' };
    case 'add':
    case 'remove': {
      const id = args[0];
      if (!id) return { kind: 'error', message: `usage: ${verb} <id>` };
      if (!ids.has(id)) return { kind: 'error', message: `unknown card: ${id}` };
      return { kind: 'game', verb, arg: id, echo: `${verb} ${id}` };
    }
    case 'connect':
    case 'link':
    case 'disconnect':
    case 'unlink': {
      if (args.length < 2) return { kind: 'error', message: `usage: ${verb} <a> <b>` };
      const [a, b] = args;
      if (!ids.has(a)) return { kind: 'error', message: `unknown node: ${a}` };
      if (!ids.has(b)) return { kind: 'error', message: `unknown node: ${b}` };
      const wire = verb === 'connect' || verb === 'link';
      const action: DeckAction = wire
        ? { type: 'CONNECT', from: a, to: b }
        : { type: 'DISCONNECT', from: a, to: b };
      return { kind: 'action', action, echo: `${verb} ${a} ${b}` };
    }
    default:
      return { kind: 'error', message: `command not found: ${verb} - try 'help'` };
  }
}

export function complete(input: string, ctx: Ctx): string[] {
  const parts = input.trimStart().split(/\s+/);
  if (parts.length <= 1) return VERBS.filter((v) => v.startsWith(parts[0] ?? ''));
  const last = parts[parts.length - 1];
  const head = parts[0];
  // After `play`/`start`, complete scenario ids; after a wiring verb, node ids
  // of the loaded arch; otherwise nothing.
  if (head === 'play' || head === 'start') {
    return architectures.map((a) => a.slug).filter((id) => id.startsWith(last));
  }
  if (!ctx.arch) return [];
  return ctx.arch.nodes.map((n) => n.id).filter((id) => id.startsWith(last));
}
