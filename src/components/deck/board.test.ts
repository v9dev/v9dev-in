import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import {
  bootOrder,
  canConnect,
  isComplete,
  layout,
  nextHint,
  objectiveProgress,
  onlineNodes,
  wirePath,
} from './board';

const arch = architectureBySlug['stalwart-mail'];

describe('board', () => {
  it('layout places every node within bounds, columns left-to-right', () => {
    const placed = layout(arch, {}, { width: 800, height: 400 });
    expect(placed).toHaveLength(arch.nodes.length);
    for (const p of placed) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(800);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(400);
    }
    const internet = placed.find((p) => p.node.id === 'internet')!;
    const sqlite = placed.find((p) => p.node.id === 'sqlite')!;
    expect(internet.x).toBeLessThan(sqlite.x);
  });

  it('position overrides win', () => {
    const placed = layout(arch, { stalwart: { x: 123, y: 45 } }, { width: 800, height: 400 });
    const s = placed.find((p) => p.node.id === 'stalwart')!;
    expect(s.x).toBe(123);
    expect(s.y).toBe(45);
  });

  it('wirePath returns a cubic bezier between the two points', () => {
    const d = wirePath({ x: 0, y: 0 }, { x: 100, y: 50 });
    expect(d.startsWith('M 0,0')).toBe(true);
    expect(d).toContain('C');
    expect(d.trim().endsWith('100,50')).toBe(true);
  });

  it('canConnect refuses client/external -> datastore and self/datastore-source', () => {
    expect(canConnect(arch, 'mailclient', 'sqlite').ok).toBe(false);
    expect(canConnect(arch, 'internet', 'sqlite').ok).toBe(false);
    expect(canConnect(arch, 'sqlite', 'stalwart').ok).toBe(false);
    expect(canConnect(arch, 'nginx', 'nginx').ok).toBe(false);
    expect(canConnect(arch, 'nginx', 'stalwart').ok).toBe(true);
  });

  it('bootOrder: the reference topology reaches every node (no unreachable)', () => {
    const r = bootOrder(arch, arch.edges);
    expect(r.unreachable).toEqual([]);
    expect(r.up).toHaveLength(arch.nodes.length);
    // sources come before what they feed
    expect(r.order.indexOf('internet')).toBeLessThan(r.order.indexOf('nginx'));
    expect(r.order.indexOf('stalwart')).toBeLessThan(r.order.indexOf('sqlite'));
  });

  it('bootOrder: removing stalwart->sqlite makes sqlite unreachable', () => {
    const edges = arch.edges.filter((e) => e.id !== 'stalwart->sqlite');
    const r = bootOrder(arch, edges);
    expect(r.unreachable).toContain('sqlite');
  });
});

describe('objectiveProgress', () => {
  it('reports 0% with no edges', () => {
    const p = objectiveProgress(arch, []);
    expect(p.satisfied).toBe(0);
    expect(p.total).toBe(arch.edges.length);
    expect(p.pct).toBe(0);
    expect(p.missing).toHaveLength(arch.edges.length);
    expect(p.extra).toEqual([]);
  });

  it('reports partial progress with some required edges present', () => {
    const some = arch.edges.slice(0, 2);
    const p = objectiveProgress(arch, some);
    expect(p.satisfied).toBe(2);
    expect(p.total).toBe(arch.edges.length);
    expect(p.pct).toBe(Math.round((2 / arch.edges.length) * 100));
    expect(p.missing).toHaveLength(arch.edges.length - 2);
    expect(p.missing.map((e) => e.id)).not.toContain(some[0].id);
    expect(p.extra).toEqual([]);
  });

  it('reports 100% when every required edge is present', () => {
    const p = objectiveProgress(arch, arch.edges);
    expect(p.satisfied).toBe(arch.edges.length);
    expect(p.pct).toBe(100);
    expect(p.missing).toEqual([]);
    expect(p.extra).toEqual([]);
  });

  it('lists edges not in the reference topology as extra', () => {
    const bogus = { id: 'nginx->internet', from: 'nginx', to: 'internet', required: false };
    const p = objectiveProgress(arch, [...arch.edges, bogus]);
    expect(p.satisfied).toBe(arch.edges.length);
    expect(p.extra).toHaveLength(1);
    expect(p.extra[0].id).toBe('nginx->internet');
  });
});

describe('isComplete', () => {
  it('is false when required edges are missing', () => {
    expect(isComplete(arch, [])).toBe(false);
    expect(isComplete(arch, arch.edges.slice(0, 3))).toBe(false);
  });

  it('is true when all required edges are present and every node is reachable', () => {
    expect(isComplete(arch, arch.edges)).toBe(true);
  });
});

describe('nextHint', () => {
  it('returns a missing required edge while incomplete', () => {
    const hint = nextHint(arch, []);
    expect(hint).not.toBeNull();
    expect(arch.edges.map((e) => e.id)).toContain(hint?.id);
  });

  it('returns null once complete', () => {
    expect(nextHint(arch, arch.edges)).toBeNull();
  });
});

describe('onlineNodes', () => {
  it('lights source nodes (no required inbound) even with no edges', () => {
    const online = onlineNodes(arch, []);
    expect(online.has('internet')).toBe(true);
    expect(online.has('mailclient')).toBe(true);
    // a node with required inbound stays offline until wired
    expect(online.has('nginx')).toBe(false);
    expect(online.has('stalwart')).toBe(false);
    expect(online.has('sqlite')).toBe(false);
  });

  it('lights a node only once ALL its required inbound edges are present', () => {
    // nginx needs only internet->nginx
    const withNginx = onlineNodes(arch, [
      { id: 'internet->nginx', from: 'internet', to: 'nginx', required: true },
    ]);
    expect(withNginx.has('nginx')).toBe(true);
    // stalwart needs internet/mailclient/nginx -> stalwart; one is not enough
    const partial = onlineNodes(arch, [
      { id: 'internet->stalwart', from: 'internet', to: 'stalwart', required: true },
    ]);
    expect(partial.has('stalwart')).toBe(false);
  });

  it('lights every node when the full reference topology is wired', () => {
    const online = onlineNodes(arch, arch.edges);
    for (const n of arch.nodes) expect(online.has(n.id)).toBe(true);
  });

  it('ignores extra (non-required) edges - they do not light a downstream node', () => {
    // an unrelated edge into sqlite is not the required stalwart->sqlite
    const online = onlineNodes(arch, [
      { id: 'nginx->sqlite', from: 'nginx', to: 'sqlite', required: false },
    ]);
    expect(online.has('sqlite')).toBe(false);
  });
});
