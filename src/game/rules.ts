import type { LevelDefinition } from '../levels/schema';
import type { Level } from '../engine';
import { normalizeAngle, ANGLE_STEP } from './snap';

/**
 * 15° steps on the shortest arc between two angles. A double-sided mirror is
 * the same after a half turn, so its arc is taken modulo 180°.
 */
export function rotationSteps(from: number, to: number, doubleSided: boolean): number {
  const period = doubleSided ? 180 : 360;
  const d = normalizeAngle(to - from) % period;
  return Math.round(Math.min(d, period - d) / ANGLE_STEP);
}

/** Stars earned for a finished level: 3, 2 or 1. */
export function starsFor(rotations: number, thresholds: readonly [number, number]): 1 | 2 | 3 {
  if (rotations <= thresholds[0]) return 3;
  if (rotations <= thresholds[1]) return 2;
  return 1;
}

/** Fewest rotations needed to reach the reference solution from the start. */
export function solutionRotations(def: LevelDefinition): number {
  let total = 0;
  for (const step of def.solution) {
    const piece = def.pieces.find((p) => p.id === step.piece);
    if (!piece || piece.type !== 'mirror' || step.angle === undefined) continue;
    total += rotationSteps(piece.angle, step.angle, piece.doubleSided !== false);
  }
  return total;
}

/**
 * Index (in `level.mirrors`) of the first mirror that is not yet where the
 * reference solution puts it, or -1 when everything matches.
 */
export function nextHint(def: LevelDefinition, level: Level): number {
  for (const step of def.solution) {
    const i = level.mirrors.findIndex((m) => m.id === step.piece);
    const m = level.mirrors[i];
    if (!m) continue;
    const angleOk =
      step.angle === undefined || rotationSteps(m.angle, step.angle, m.doubleSided !== false) === 0;
    const xOk = step.x === undefined || step.x === m.x;
    const yOk = step.y === undefined || step.y === m.y;
    if (!angleOk || !xOk || !yOk) return i;
  }
  return -1;
}
