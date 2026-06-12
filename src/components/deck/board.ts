import type { ArchEdge, ArchNode, Architecture } from '@content/architectures';
import type { Pos } from './state';

// hintFor only needs these fields; typing them locally keeps board.ts from
// importing the full DeckState (state.ts already type-imports board).
interface HintState {
  placed: string[];
  edges: ArchEdge[];
  hintsUsed: number;
}

export interface Dims {
  width: number;
  height: number;
}
export interface PlacedNode {
  node: ArchNode;
  x: number;
  y: number;
}

const KIND_DEPTH: Record<string, number> = {
  client: 0,
  external: 0,
  edge: 1,
  service: 2,
  datastore: 3,
};

export function nodeColumn(node: ArchNode): number {
  return typeof node.col === 'number' ? node.col : (KIND_DEPTH[node.kind] ?? 1);
}

export function layout(
  arch: Architecture,
  positions: Record<string, Pos>,
  dims: Dims,
): PlacedNode[] {
  const cols = new Map<number, ArchNode[]>();
  for (const n of arch.nodes) {
    const c = nodeColumn(n);
    const list = cols.get(c) ?? [];
    list.push(n);
    cols.set(c, list);
  }
  const colKeys = [...cols.keys()].sort((a, b) => a - b);
  const colGap = dims.width / (colKeys.length + 1);
  const placed: PlacedNode[] = [];
  colKeys.forEach((key, ci) => {
    const list = cols.get(key) ?? [];
    const rowGap = dims.height / (list.length + 1);
    list.forEach((n, ri) => {
      const o = positions[n.id];
      placed.push({ node: n, x: o?.x ?? colGap * (ci + 1), y: o?.y ?? rowGap * (ri + 1) });
    });
  });
  return placed;
}

const NODE_HALF_W = 66;

export function portAnchor(p: PlacedNode, dir: 'in' | 'out'): Pos {
  return { x: p.x + (dir === 'out' ? NODE_HALF_W : -NODE_HALF_W), y: p.y };
}

export function wirePath(a: Pos, b: Pos): string {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

// Cards pre-placed when a session starts: non-decoy sources (a client or
// external node). Decoys are never auto-placed even if a source kind.
export function entryCards(arch: Architecture): string[] {
  return arch.nodes
    .filter((n) => !n.decoy && (n.kind === 'external' || n.kind === 'client'))
    .map((n) => n.id);
}

export type WireVerdict = { ok: true } | { ok: false; penalize: boolean; reason: string };

// Judge a wire attempt against the real design. `ok` wires (a required edge,
// both cards placed) stick; everything else is rejected. `penalize` is true
// only for a genuine wrong attempt (both cards placed, not a required edge) -
// guidance rejections (self-wire, card not placed) do not cost score.
export function judgeWire(
  arch: Architecture,
  placed: string[],
  fromId: string,
  toId: string,
): WireVerdict {
  if (fromId === toId)
    return { ok: false, penalize: false, reason: 'cannot wire a node to itself' };
  if (!placed.includes(fromId) || !placed.includes(toId)) {
    return { ok: false, penalize: false, reason: 'place both cards first' };
  }
  const required = arch.edges.some((e) => e.from === fromId && e.to === toId);
  if (required) return { ok: true };
  const from = arch.nodes.find((n) => n.id === fromId);
  const to = arch.nodes.find((n) => n.id === toId);
  if (!from || !to) return { ok: false, penalize: false, reason: 'unknown node' };
  let reason: string;
  if (from.kind === 'datastore') {
    reason = `${from.label} is a datastore - it does not initiate connections`;
  } else if (to.kind === 'datastore' && (from.kind === 'client' || from.kind === 'external')) {
    reason = `do not expose ${to.label} directly to ${from.label}`;
  } else if (from.decoy || to.decoy) {
    reason = 'that card has no role in this design';
  } else {
    reason = `${from.label} -> ${to.label} is not part of this design`;
  }
  return { ok: false, penalize: true, reason };
}

export interface BootResult {
  order: string[];
  up: string[];
  unreachable: string[];
}

export function bootOrder(arch: Architecture, edges: ArchEdge[], placed?: string[]): BootResult {
  const live = placed ? arch.nodes.filter((n) => placed.includes(n.id)) : arch.nodes;
  const ids = live.map((n) => n.id);
  const idSet = new Set(ids);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (idSet.has(e.from) && idSet.has(e.to)) adj.get(e.from)?.push(e.to);
  }
  const sources = live.filter((n) => n.kind === 'external' || n.kind === 'client').map((n) => n.id);
  const seen = new Set<string>(sources);
  const order: string[] = [];
  const queue = [...sources];
  while (queue.length) {
    const cur = queue.shift() as string;
    order.push(cur);
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return { order, up: [...order], unreachable: ids.filter((id) => !seen.has(id)) };
}

export interface Progress {
  satisfied: number;
  total: number;
  pct: number;
  missing: ArchEdge[];
  extra: ArchEdge[];
  missingCards: string[];
  decoysOnBoard: string[];
}

export function objectiveProgress(
  arch: Architecture,
  edges: ArchEdge[],
  placed?: string[],
): Progress {
  const req = arch.edges;
  const have = new Set(edges.map((e) => e.id));
  const reqIds = new Set(req.map((e) => e.id));
  const missing = req.filter((e) => !have.has(e.id));
  const satisfied = req.length - missing.length;
  const extra = edges.filter((e) => !reqIds.has(e.id));
  const total = req.length;
  const placedSet = new Set(placed ?? arch.nodes.map((n) => n.id));
  const missingCards = arch.nodes.filter((n) => !n.decoy && !placedSet.has(n.id)).map((n) => n.id);
  const decoysOnBoard = arch.nodes.filter((n) => n.decoy && placedSet.has(n.id)).map((n) => n.id);
  return {
    satisfied,
    total,
    pct: total === 0 ? 100 : Math.round((satisfied / total) * 100),
    missing,
    extra,
    missingCards,
    decoysOnBoard,
  };
}

export function isComplete(arch: Architecture, edges: ArchEdge[], placed?: string[]): boolean {
  const p = objectiveProgress(arch, edges, placed);
  return (
    p.satisfied === p.total &&
    p.missingCards.length === 0 &&
    p.decoysOnBoard.length === 0 &&
    bootOrder(arch, edges, placed).unreachable.length === 0
  );
}

// A vague, state-aware nudge - never the exact wire. Tiers: drop a stray decoy,
// add a missing piece, an authored architectural principle while wiring, else
// "looks wired".
export function hintFor(arch: Architecture, state: HintState): string {
  const p = objectiveProgress(arch, state.edges, state.placed);
  if (p.decoysOnBoard.length > 0) {
    return 'one of the cards you placed has no role in this design - drop it';
  }
  if (p.missingCards.length > 0) {
    return 'the design is missing a piece - check the tray for what belongs';
  }
  if (p.satisfied < p.total) {
    const hints = arch.hints ?? [];
    if (hints.length > 0) return hints[state.hintsUsed % hints.length];
    return "traffic flows source -> edge -> service -> data; follow the chain that isn't wired yet";
  }
  return 'looks wired - type boot';
}

// The set of node ids that are "online" given the currently wired `edges`. A
// node is online once ALL of its REQUIRED inbound edges (from the reference
// topology `arch.edges` where `to === node.id`) are present. A source node (no
// required inbound) has nothing to wait on, so it is online from the start - the
// React island only treats this set as live while the scenario is `playing`.
// Pure: depends solely on `arch` + `edges`.
export function onlineNodes(arch: Architecture, edges: ArchEdge[], placed?: string[]): Set<string> {
  const have = new Set(edges.map((e) => e.id));
  const live = placed ? new Set(placed) : new Set(arch.nodes.map((n) => n.id));
  const online = new Set<string>();
  for (const node of arch.nodes) {
    if (!live.has(node.id)) continue;
    const requiredIn = arch.edges.filter((e) => e.to === node.id && e.required);
    if (requiredIn.every((e) => have.has(e.id))) online.add(node.id);
  }
  return online;
}
