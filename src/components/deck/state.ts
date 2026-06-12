import type { ArchEdge, Architecture } from '@content/architectures';
import { entryCards } from './board';

export interface Pos {
  x: number;
  y: number;
}
// `boot` lines are machine-paced animation output (one per node, dispatched
// rapidly). They render as visible scroll content but are kept OUT of the live
// region announcement (see Terminal) - the batched <output> summary in Deck is
// the single boot announcement, so the live region is never flooded.
export type LogKind = 'input' | 'output' | 'error' | 'system' | 'boot';
export interface LogLine {
  id: number;
  kind: LogKind;
  text: string;
}

// Game session phase: the menu (pick a scenario), live play, or the win screen.
export type GamePhase = 'menu' | 'playing' | 'won';

export interface DeckState {
  archSlug: string;
  positions: Record<string, Pos>;
  edges: ArchEdge[];
  selectedNodeId: string | null;
  armedFrom: string | null;
  // Architect mode: node ids currently on the board (the tray is every other
  // non-placed node). A session starts with only the entry card(s) placed.
  placed: string[];
  // Game session layer. `phase` gates the menu/play/win UI; `moves` counts
  // connect+disconnect+add/remove actions; `startedAt`/`wonAt` are ms-epoch
  // timestamps captured in the React island and passed via action `at` (the
  // reducer stays pure - it never calls Date.now()).
  phase: GamePhase;
  moves: number;
  hintsUsed: number;
  // Cumulative penalty counters for scoring: rejected wire attempts and decoy
  // placements (decoyAdds counts every decoy placement, even if later removed).
  wrongWires: number;
  decoyAdds: number;
  startedAt: number | null;
  wonAt: number | null;
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
  | { type: 'RESET'; arch: Architecture; at: number }
  | { type: 'PLAY'; arch: Architecture; at: number }
  | { type: 'HINT' }
  | { type: 'WIN'; at: number }
  | { type: 'MENU' }
  | { type: 'CONNECT'; from: string; to: string }
  | { type: 'DISCONNECT'; from: string; to: string }
  | { type: 'ADD_CARD'; id: string; decoy: boolean }
  | { type: 'REMOVE_CARD'; id: string }
  | { type: 'WRONG_WIRE' }
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

// A fresh session opens at the menu, UNWIRED: the player picks a scenario with
// `play`, then wires it up themselves. Edges start empty (the arch's reference
// edges are the win target, not the starting state).
export function initDeckState(arch: Architecture): DeckState {
  return {
    archSlug: arch.slug,
    positions: {},
    edges: [],
    selectedNodeId: null,
    armedFrom: null,
    placed: [],
    phase: 'menu',
    moves: 0,
    hintsUsed: 0,
    wrongWires: 0,
    decoyAdds: 0,
    startedAt: null,
    wonAt: null,
    boot: { running: false, up: [], unreachable: [] },
    bootSeq: 0,
    log: [
      { id: 0, kind: 'system', text: "v9 deck - type 'ls' to list games, 'help' for commands" },
    ],
    history: [],
    seq: 1,
  };
}

// Start a live session for `arch` at timestamp `at`: unwired, phase=playing,
// counters reset, and the objective logged. Used by both PLAY (fresh scenario)
// and RESET (replay the current scenario). Pure - `at` is captured by the caller.
function startSession(arch: Architecture, at: number): DeckState {
  return {
    ...initDeckState(arch),
    phase: 'playing',
    placed: entryCards(arch),
    wrongWires: 0,
    decoyAdds: 0,
    startedAt: at,
    log: [{ id: 0, kind: 'system', text: `objective: ${arch.objective}` }],
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
      return initDeckState(action.arch);
    case 'PLAY':
    case 'RESET':
      // Both start a fresh playing session for the given arch (RESET replays the
      // current scenario, PLAY loads a new one) - unwired, counters zeroed.
      return startSession(action.arch, action.at);
    case 'HINT':
      return { ...state, hintsUsed: state.hintsUsed + 1 };
    case 'WIN':
      // Only a live playing session can be won. The win is dispatched on a hold
      // timer after the boot animation, so guard against a late WIN landing once
      // the player has already left (e.g. typed `menu` during the win hold).
      if (state.phase !== 'playing') return state;
      return { ...state, phase: 'won', wonAt: action.at };
    case 'MENU':
      return { ...state, phase: 'menu' };
    case 'CONNECT': {
      const id = edgeId(action.from, action.to);
      if (state.edges.some((e) => e.id === id)) return { ...state, armedFrom: null };
      return {
        ...state,
        armedFrom: null,
        moves: state.moves + 1,
        // Topology changed - a prior boot's up/unreachable flags are now stale, so
        // clear them (otherwise a node flagged red 'unreachable' keeps its outline
        // even after you correctly wire it, until the next boot).
        boot: { running: false, up: [], unreachable: [] },
        edges: [...state.edges, { id, from: action.from, to: action.to, required: false }],
      };
    }
    case 'DISCONNECT':
      return {
        ...state,
        armedFrom: null,
        moves: state.moves + 1,
        boot: { running: false, up: [], unreachable: [] },
        edges: state.edges.filter((e) => e.id !== edgeId(action.from, action.to)),
      };
    case 'ADD_CARD': {
      if (state.placed.includes(action.id)) return state;
      return {
        ...state,
        placed: [...state.placed, action.id],
        moves: state.moves + 1,
        decoyAdds: action.decoy ? state.decoyAdds + 1 : state.decoyAdds,
        boot: { running: false, up: [], unreachable: [] },
      };
    }
    case 'REMOVE_CARD':
      return {
        ...state,
        placed: state.placed.filter((id) => id !== action.id),
        edges: state.edges.filter((e) => e.from !== action.id && e.to !== action.id),
        moves: state.moves + 1,
        boot: { running: false, up: [], unreachable: [] },
      };
    case 'WRONG_WIRE':
      return { ...state, wrongWires: state.wrongWires + 1 };
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
