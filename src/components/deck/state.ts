import type { ArchEdge, Architecture } from '@content/architectures';

export interface Pos {
  x: number;
  y: number;
}
export type LogKind = 'input' | 'output' | 'error' | 'system';
export interface LogLine {
  id: number;
  kind: LogKind;
  text: string;
}

export interface DeckState {
  archSlug: string;
  positions: Record<string, Pos>;
  edges: ArchEdge[];
  selectedNodeId: string | null;
  armedFrom: string | null;
  boot: { running: boolean; up: string[]; unreachable: string[] };
  // Monotonic boot token: incremented on every BOOT_START so the boot effect
  // re-runs (and clears prior in-flight timers) even when a boot is requested
  // while one is already running.
  bootSeq: number;
  log: LogLine[];
  history: string[];
  seq: number;
}

export type DeckAction =
  | { type: 'LOAD'; arch: Architecture }
  | { type: 'RESET'; arch: Architecture }
  | { type: 'CONNECT'; from: string; to: string }
  | { type: 'DISCONNECT'; from: string; to: string }
  | { type: 'MOVE_NODE'; id: string; pos: Pos }
  | { type: 'ARM'; from: string }
  | { type: 'DISARM' }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'BOOT_START' }
  | { type: 'BOOT_STEP'; up: string[]; unreachable: string[] }
  | { type: 'BOOT_DONE' }
  | { type: 'LOG'; kind: LogKind; text: string }
  | { type: 'CLEAR' };

const edgeId = (from: string, to: string): string => `${from}->${to}`;

export function initDeckState(arch: Architecture): DeckState {
  return {
    archSlug: arch.slug,
    positions: {},
    edges: arch.edges.map((e) => ({ ...e })),
    selectedNodeId: null,
    armedFrom: null,
    boot: { running: false, up: [], unreachable: [] },
    bootSeq: 0,
    log: [{ id: 0, kind: 'system', text: `loaded ${arch.title} - type 'help'` }],
    history: [],
    seq: 1,
  };
}

function append(state: DeckState, kind: LogKind, text: string): DeckState {
  return {
    ...state,
    log: [...state.log, { id: state.seq, kind, text }],
    history: kind === 'input' ? [...state.history, text] : state.history,
    seq: state.seq + 1,
  };
}

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'LOAD':
    case 'RESET':
      return initDeckState(action.arch);
    case 'CONNECT': {
      const id = edgeId(action.from, action.to);
      if (state.edges.some((e) => e.id === id)) return { ...state, armedFrom: null };
      return {
        ...state,
        armedFrom: null,
        edges: [...state.edges, { id, from: action.from, to: action.to, required: false }],
      };
    }
    case 'DISCONNECT':
      return {
        ...state,
        armedFrom: null,
        edges: state.edges.filter((e) => e.id !== edgeId(action.from, action.to)),
      };
    case 'MOVE_NODE':
      return { ...state, positions: { ...state.positions, [action.id]: action.pos } };
    case 'ARM':
      return { ...state, armedFrom: action.from };
    case 'DISARM':
      return { ...state, armedFrom: null };
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.id };
    case 'BOOT_START':
      return {
        ...state,
        boot: { running: true, up: [], unreachable: [] },
        bootSeq: state.bootSeq + 1,
      };
    case 'BOOT_STEP':
      return { ...state, boot: { running: true, up: action.up, unreachable: action.unreachable } };
    case 'BOOT_DONE':
      return { ...state, boot: { ...state.boot, running: false } };
    case 'LOG':
      return append(state, action.kind, action.text);
    case 'CLEAR':
      return { ...state, log: [] };
    default:
      return state;
  }
}
