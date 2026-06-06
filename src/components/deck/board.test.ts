import type { Architecture } from '@content/architectures';
import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import {
  bootOrder,
  canConnect,
  entryCards,
  hintFor,
  isComplete,
  judgeWire,
  layout,
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

const fix: Architecture = {
  slug: 'fix',
  title: 'Fix',
  subtitle: '',
  objective: 'test',
  difficulty: 'easy',
  hints: ['principle one', 'principle two'],
  nodes: [
    { id: 'net', label: 'Net', kind: 'external', hld: '' },
    { id: 'web', label: 'Web', kind: 'edge', hld: '' },
    { id: 'app', label: 'App', kind: 'service', hld: '' },
    { id: 'db', label: 'DB', kind: 'datastore', hld: '' },
    { id: 'fake', label: 'Fake', kind: 'service', hld: '', decoy: true },
  ],
  edges: [
    { id: 'net->web', from: 'net', to: 'web', required: true },
    { id: 'web->app', from: 'web', to: 'app', required: true },
    { id: 'app->db', from: 'app', to: 'db', required: true },
  ],
};
const ALL = fix.nodes.map((n) => n.id);
const REAL = fix.nodes.filter((n) => !n.decoy).map((n) => n.id);

describe('entryCards', () => {
  it('returns non-decoy sources (external/client) only', () => {
    expect(entryCards(fix)).toEqual(['net']);
  });
});

describe('judgeWire', () => {
  it('accepts a required edge between placed nodes', () => {
    expect(judgeWire(fix, REAL, 'net', 'web')).toEqual({ ok: true });
  });
  it('rejects a self-wire without penalty', () => {
    expect(judgeWire(fix, REAL, 'web', 'web')).toMatchObject({ ok: false, penalize: false });
  });
  it('rejects when a card is not placed, without penalty', () => {
    expect(judgeWire(fix, ['net'], 'net', 'web')).toMatchObject({ ok: false, penalize: false });
  });
  it('penalizes a datastore-initiated wire with a reason', () => {
    const v = judgeWire(fix, REAL, 'db', 'app');
    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ penalize: true });
    expect((v as { reason: string }).reason).toMatch(/datastore/i);
  });
  it('penalizes exposing a datastore to a source', () => {
    const v = judgeWire(fix, REAL, 'net', 'db');
    expect(v).toMatchObject({ ok: false, penalize: true });
    expect((v as { reason: string }).reason).toMatch(/expose/i);
  });
  it('penalizes a wire to/from a decoy', () => {
    const v = judgeWire(fix, ALL, 'web', 'fake');
    expect(v).toMatchObject({ ok: false, penalize: true });
    expect((v as { reason: string }).reason).toMatch(/no role/i);
  });
  it('penalizes a plausible-but-wrong wire', () => {
    const v = judgeWire(fix, REAL, 'net', 'app');
    expect(v).toMatchObject({ ok: false, penalize: true });
    expect((v as { reason: string }).reason).toMatch(/not part of this design/i);
  });
});

describe('objectiveProgress with placed', () => {
  it('reports missing cards and decoys on board', () => {
    const p = objectiveProgress(
      fix,
      [{ id: 'net->web', from: 'net', to: 'web', required: false }],
      ['net', 'web', 'fake'],
    );
    expect(p.missingCards.sort()).toEqual(['app', 'db']);
    expect(p.decoysOnBoard).toEqual(['fake']);
  });
});

describe('isComplete with placed', () => {
  const wired = fix.edges.map((e) => ({ ...e, required: false }));
  it('is false while a decoy is on the board', () => {
    expect(isComplete(fix, wired, ALL)).toBe(false);
  });
  it('is true with exactly the real cards, all wires, no decoys', () => {
    expect(isComplete(fix, wired, REAL)).toBe(true);
  });
  it('is false when a required card is missing', () => {
    expect(isComplete(fix, wired, ['net', 'web', 'app'])).toBe(false);
  });
});

describe('hintFor', () => {
  const base = { archSlug: 'fix', placed: REAL, edges: [], hintsUsed: 0 } as never;
  it('nudges to drop a decoy when one is placed', () => {
    const s = { ...(base as object), placed: ALL } as never;
    expect(hintFor(fix, s).toLowerCase()).toContain('no role');
  });
  it('nudges about a missing piece when a card is missing', () => {
    const s = { ...(base as object), placed: ['net', 'web'] } as never;
    expect(hintFor(fix, s).toLowerCase()).toContain('missing');
  });
  it('cycles authored principle hints when wires are missing, never the answer', () => {
    const s0 = { ...(base as object), placed: REAL, edges: [], hintsUsed: 0 } as never;
    expect(hintFor(fix, s0)).toBe('principle one');
    const s1 = { ...(base as object), placed: REAL, edges: [], hintsUsed: 1 } as never;
    expect(hintFor(fix, s1)).toBe('principle two');
    expect(hintFor(fix, s0)).not.toMatch(/connect /);
  });
});
