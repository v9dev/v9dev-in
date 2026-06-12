import type { Architecture } from '@content/architectures';
import { describe, expect, it } from 'vitest';
import { SCORE, scoreState } from './scoring';

const arch: Architecture = {
  slug: 's',
  title: 'S',
  subtitle: '',
  objective: 'o',
  difficulty: 'easy',
  nodes: [
    { id: 'a', label: 'A', kind: 'external', hld: '' },
    { id: 'b', label: 'B', kind: 'service', hld: '' },
  ],
  edges: [
    { id: 'a->b', from: 'a', to: 'b', required: true },
    { id: 'b->a', from: 'b', to: 'a', required: true },
  ],
};
const st = (
  over: Partial<{
    edges: typeof arch.edges;
    wrongWires: number;
    hintsUsed: number;
    decoyAdds: number;
    placed: string[];
  }>,
) =>
  ({
    edges: [],
    wrongWires: 0,
    hintsUsed: 0,
    decoyAdds: 0,
    placed: ['a', 'b'],
    ...over,
  }) as never;

describe('scoreState', () => {
  it('a perfect full wiring earns max and grade S', () => {
    const r = scoreState(arch, st({ edges: arch.edges }));
    expect(r.score).toBe(2 * SCORE.CORRECT_WIRE);
    expect(r.max).toBe(2 * SCORE.CORRECT_WIRE);
    expect(r.perfect).toBe(true);
    expect(r.grade).toBe('S');
  });
  it('subtracts penalties and floors at zero', () => {
    const r = scoreState(arch, st({ wrongWires: 100 }));
    expect(r.score).toBe(0);
    expect(r.perfect).toBe(false);
  });
  it('penalties drop the grade below S even at full wiring', () => {
    const r = scoreState(arch, st({ edges: arch.edges, hintsUsed: 1 }));
    expect(r.perfect).toBe(false);
    expect(r.grade).not.toBe('S');
    expect(r.breakdown).toEqual({
      correct: 2 * SCORE.CORRECT_WIRE,
      wrong: 0,
      hints: SCORE.HINT,
      decoys: 0,
    });
  });
});
