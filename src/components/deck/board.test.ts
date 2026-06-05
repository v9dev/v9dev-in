import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import { bootOrder, canConnect, layout, wirePath } from './board';

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
