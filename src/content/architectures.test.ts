import { bootOrder } from '@components/deck/board';
import { describe, expect, it } from 'vitest';
import { architectures } from './architectures';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

describe('architectures (game scenarios)', () => {
  it('exposes at least 4 scenarios', () => {
    expect(architectures.length).toBeGreaterThanOrEqual(4);
  });

  for (const arch of architectures) {
    describe(arch.slug, () => {
      it('has a non-empty objective', () => {
        expect(typeof arch.objective).toBe('string');
        expect(arch.objective.trim().length).toBeGreaterThan(0);
      });

      it('has a difficulty within the union', () => {
        expect(DIFFICULTIES).toContain(arch.difficulty);
      });

      it('every edge references real node ids', () => {
        const ids = new Set(arch.nodes.map((n) => n.id));
        for (const edge of arch.edges) {
          expect(ids.has(edge.from)).toBe(true);
          expect(ids.has(edge.to)).toBe(true);
        }
      });

      it('reference topology boots every node (no unreachable)', () => {
        expect(bootOrder(arch, arch.edges).unreachable).toEqual([]);
      });
    });
  }
});
