import type { ArchEdge, Architecture } from '@content/architectures';
import { objectiveProgress } from './board';

// Score weights. Tunable - keep the math in one place.
export const SCORE = {
  CORRECT_WIRE: 100,
  WRONG_WIRE: 50,
  HINT: 40,
  DECOY_ADD: 40,
} as const;

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export interface ScoreResult {
  score: number;
  max: number;
  grade: Grade;
  perfect: boolean;
  breakdown: { correct: number; wrong: number; hints: number; decoys: number };
}

// Input shape scoreState reads. Defined locally (not Pick<DeckState>) so this
// module does not depend on DeckState carrying the new architect-mode fields
// yet; the real DeckState is structurally compatible once it gains them.
export interface ScoreInput {
  edges: ArchEdge[];
  placed: string[];
  wrongWires: number;
  hintsUsed: number;
  decoyAdds: number;
}

// Pure performance grade for the live state. Win is decided by board.isComplete,
// NOT by score; this only grades the run.
export function scoreState(arch: Architecture, state: ScoreInput): ScoreResult {
  const p = objectiveProgress(arch, state.edges, state.placed);
  const correct = p.satisfied * SCORE.CORRECT_WIRE;
  const wrong = state.wrongWires * SCORE.WRONG_WIRE;
  const hints = state.hintsUsed * SCORE.HINT;
  const decoys = state.decoyAdds * SCORE.DECOY_ADD;
  const score = Math.max(0, correct - wrong - hints - decoys);
  const max = p.total * SCORE.CORRECT_WIRE;
  const perfect = state.wrongWires === 0 && state.hintsUsed === 0 && state.decoyAdds === 0;
  const ratio = max === 0 ? 0 : score / max;
  const grade: Grade =
    perfect && p.satisfied === p.total
      ? 'S'
      : ratio >= 0.9
        ? 'A'
        : ratio >= 0.75
          ? 'B'
          : ratio >= 0.5
            ? 'C'
            : 'D';
  return { score, max, grade, perfect, breakdown: { correct, wrong, hints, decoys } };
}
