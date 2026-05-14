import { skills, type Cluster, type Skill } from '@content/skills';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  /** 0..1 progress along the path at which this node lights up. */
  pathFraction: number;
  cluster: Cluster;
  skill: Skill;
}

export interface ConstellationGeometry {
  width: number;
  height: number;
  /** SVG `d` attribute for the smooth path through every node. */
  d: string;
  nodes: NodePosition[];
  clusterRows: { cluster: Cluster; label: string; y: number }[];
  pathLength: number;
}

const clusterOrder: Cluster[] = ['language', 'frontend', 'backend', 'database', 'cloud', 'devops'];

const clusterLabel: Record<Cluster, string> = {
  language: 'Languages',
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Data',
  cloud: 'Cloud',
  devops: 'DevOps',
};

interface BuildOpts {
  width: number;
  /** Vertical pixels per cluster row. */
  rowHeight: number;
  /** Horizontal padding from edges. */
  padX: number;
  /** Vertical padding top / bottom. */
  padY: number;
}

/**
 * Lays each cluster on a horizontal row, alternating zig-zag direction
 * between rows so the connecting path snakes elegantly down the page.
 * Returns positions, smooth path `d`, and per-node `pathFraction` for
 * scroll-linked reveals.
 */
export function buildConstellation({
  width,
  rowHeight,
  padX,
  padY,
}: BuildOpts): ConstellationGeometry {
  const nodes: NodePosition[] = [];
  const rowYs: number[] = [];
  const clusterRows: { cluster: Cluster; label: string; y: number }[] = [];

  // Group skills by cluster in fixed order
  const grouped = clusterOrder.map((c) => skills.filter((s) => s.cluster === c));

  // Compute positions
  grouped.forEach((group, rowIdx) => {
    const y = padY + rowIdx * rowHeight + rowHeight / 2;
    rowYs.push(y);
    clusterRows.push({ cluster: clusterOrder[rowIdx], label: clusterLabel[clusterOrder[rowIdx]], y });

    const innerWidth = width - padX * 2;
    const step = innerWidth / Math.max(group.length, 1);
    const reverse = rowIdx % 2 === 1;

    group.forEach((skill, i) => {
      const baseX = padX + step * i + step / 2;
      const x = reverse ? width - baseX : baseX;
      nodes.push({
        id: skill.id,
        x,
        y,
        pathFraction: 0, // filled in after we measure length
        cluster: skill.cluster,
        skill,
      });
    });
  });

  // Build smooth path through the nodes in their natural sequence
  const d = buildSmoothPath(nodes.map((n) => [n.x, n.y]));

  // Approximate path length via SVG only available in browser - return raw length
  // so consumer can replace with real measurement using getTotalLength().
  const pathLength = approxPathLength(nodes);

  // Each node's fraction along the path = its cumulative distance / total
  let cum = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) {
      cum += dist(nodes[i - 1], nodes[i]);
    }
    nodes[i].pathFraction = pathLength > 0 ? cum / pathLength : 0;
  }

  return {
    width,
    height: padY * 2 + clusterOrder.length * rowHeight,
    d,
    nodes,
    clusterRows,
    pathLength,
  };
}

function buildSmoothPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  const [first, ...rest] = points;
  let d = `M ${first[0]} ${first[1]}`;
  let prev: [number, number] = first;

  for (let i = 0; i < rest.length; i++) {
    const next = rest[i];
    // Control points: bezier curve that bulges in the direction of travel.
    const c1x = prev[0] + (next[0] - prev[0]) * 0.5;
    const c1y = prev[1];
    const c2x = prev[0] + (next[0] - prev[0]) * 0.5;
    const c2y = next[1];
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${next[0]} ${next[1]}`;
    prev = next;
  }
  return d;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function approxPathLength(nodes: NodePosition[]): number {
  let total = 0;
  for (let i = 1; i < nodes.length; i++) {
    total += dist(nodes[i - 1], nodes[i]);
  }
  // Curves are ~1.15x longer than the straight-line approximation.
  return total * 1.15;
}
