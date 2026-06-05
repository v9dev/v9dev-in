import type { ArchEdge, ArchNode, Architecture } from '@content/architectures';
import type { Pos } from './state';

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

export function canConnect(
  arch: Architecture,
  fromId: string,
  toId: string,
): { ok: boolean; reason?: string } {
  if (fromId === toId) return { ok: false, reason: 'cannot wire a node to itself' };
  const from = arch.nodes.find((n) => n.id === fromId);
  const to = arch.nodes.find((n) => n.id === toId);
  if (!from || !to) return { ok: false, reason: 'unknown node' };
  if (from.kind === 'datastore')
    return { ok: false, reason: 'a datastore does not initiate connections' };
  if (to.kind === 'datastore' && (from.kind === 'client' || from.kind === 'external')) {
    return { ok: false, reason: `cannot expose ${to.label} to ${from.label}` };
  }
  return { ok: true };
}

export interface BootResult {
  order: string[];
  up: string[];
  unreachable: string[];
}

export function bootOrder(arch: Architecture, edges: ArchEdge[]): BootResult {
  const ids = arch.nodes.map((n) => n.id);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) adj.get(e.from)?.push(e.to);
  const sources = arch.nodes
    .filter((n) => n.kind === 'external' || n.kind === 'client')
    .map((n) => n.id);
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
