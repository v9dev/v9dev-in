import type { Architecture } from '@content/architectures';
import type { DeckAction } from './state';

export type Command =
  | { kind: 'action'; action: DeckAction; echo: string }
  | { kind: 'print'; lines: string[] }
  | { kind: 'skills'; cluster: string | null }
  | { kind: 'error'; message: string };

export const VERBS = [
  'help',
  'ls',
  'load',
  'connect',
  'disconnect',
  'boot',
  'reset',
  'skills',
  'clear',
] as const;

export function helpText(_arch: Architecture): string[] {
  return [
    'commands:',
    '  help                show this',
    '  ls                  list nodes',
    '  connect <a> <b>     wire node a -> node b',
    '  disconnect <a> <b>  remove the wire a -> b',
    '  boot                start services in dependency order',
    '  reset               restore the reference wiring',
    '  skills [cluster]    show the skill chart',
    '  clear               clear the log',
  ];
}

export function parse(input: string, arch: Architecture): Command {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'print', lines: [] };
  const [verb, ...args] = trimmed.split(/\s+/);
  const ids = new Set(arch.nodes.map((n) => n.id));

  switch (verb) {
    case 'help':
      return { kind: 'print', lines: helpText(arch) };
    case 'ls':
      return { kind: 'print', lines: arch.nodes.map((n) => `${n.id}  (${n.kind})  ${n.label}`) };
    case 'clear':
      return { kind: 'action', action: { type: 'CLEAR' }, echo: 'clear' };
    case 'reset':
      // `at` is captured here in the browser island (parse runs on a user event),
      // never in the reducer - the reducer stays pure. G4/G5 route this through
      // the Deck runner; this keeps the contract typecheck-clean in the interim.
      return { kind: 'action', action: { type: 'RESET', arch, at: Date.now() }, echo: 'reset' };
    case 'load':
      return { kind: 'action', action: { type: 'LOAD', arch }, echo: `load ${arch.slug}` };
    case 'boot':
      return { kind: 'action', action: { type: 'BOOT_START' }, echo: 'boot' };
    case 'skills':
      return { kind: 'skills', cluster: args[0] ?? null };
    case 'connect':
    case 'disconnect': {
      if (args.length < 2) return { kind: 'error', message: `usage: ${verb} <a> <b>` };
      const [a, b] = args;
      if (!ids.has(a)) return { kind: 'error', message: `unknown node: ${a}` };
      if (!ids.has(b)) return { kind: 'error', message: `unknown node: ${b}` };
      const echo = `${verb} ${a} ${b}`;
      const action: DeckAction =
        verb === 'connect'
          ? { type: 'CONNECT', from: a, to: b }
          : { type: 'DISCONNECT', from: a, to: b };
      return { kind: 'action', action, echo };
    }
    default:
      return { kind: 'error', message: `command not found: ${verb} - try 'help'` };
  }
}

export function complete(input: string, arch: Architecture): string[] {
  const parts = input.trimStart().split(/\s+/);
  if (parts.length <= 1) return VERBS.filter((v) => v.startsWith(parts[0] ?? ''));
  const last = parts[parts.length - 1];
  return arch.nodes.map((n) => n.id).filter((id) => id.startsWith(last));
}
