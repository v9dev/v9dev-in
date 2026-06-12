import { bootOrder, entryCards, judgeWire } from '@components/deck/board';
import { describe, expect, it } from 'vitest';
import { architectures } from './architectures';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;

describe('architectures (game scenarios)', () => {
  it('exposes at least 6 scenarios', () => {
    expect(architectures.length).toBeGreaterThanOrEqual(6);
  });

  for (const arch of architectures) {
    describe(arch.slug, () => {
      const real = arch.nodes.filter((n) => !n.decoy).map((n) => n.id);

      it('has a non-empty objective', () => {
        expect(arch.objective.trim().length).toBeGreaterThan(0);
      });
      it('has a difficulty within the union', () => {
        expect(DIFFICULTIES).toContain(arch.difficulty);
      });
      it('has at least one decoy card', () => {
        expect(arch.nodes.some((n) => n.decoy)).toBe(true);
      });
      it('no edge references a decoy', () => {
        const decoys = new Set(arch.nodes.filter((n) => n.decoy).map((n) => n.id));
        for (const e of arch.edges) {
          expect(decoys.has(e.from)).toBe(false);
          expect(decoys.has(e.to)).toBe(false);
        }
      });
      it('every edge references real node ids', () => {
        const ids = new Set(arch.nodes.map((n) => n.id));
        for (const e of arch.edges) {
          expect(ids.has(e.from)).toBe(true);
          expect(ids.has(e.to)).toBe(true);
        }
      });
      it('has at least one entry card', () => {
        expect(entryCards(arch).length).toBeGreaterThan(0);
      });
      it('the real topology boots every real node (no unreachable)', () => {
        expect(bootOrder(arch, arch.edges, real).unreachable).toEqual([]);
      });
      it('every required edge is recreatable via judgeWire', () => {
        for (const e of arch.edges) {
          expect(judgeWire(arch, real, e.from, e.to)).toEqual({ ok: true });
        }
      });
    });
  }
});
