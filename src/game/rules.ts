import type { LevelDefinition } from '../levels/schema';
import type { Diffuser, Level, Medium, Mirror } from '../engine';
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
    if (!piece || piece.type === 'wall' || piece.type === 'fog' || step.angle === undefined)
      continue;
    const symmetric = piece.type !== 'mirror' || piece.doubleSided !== false;
    total += rotationSteps(piece.angle, step.angle, symmetric);
  }
  return total;
}

export type HintKind = 'rotate' | 'move' | 'place' | 'adjust';

/**
 * First piece that is not yet where the reference solution puts it, and what
 * to do with it; null when everything matches.
 */
export function nextHint(
  def: LevelDefinition,
  level: Level,
): { id: string; kind: HintKind } | null {
  for (const step of def.solution) {
    const piece: Mirror | Medium | Diffuser | undefined =
      level.mirrors.find((m) => m.id === step.piece) ??
      level.media?.find((m) => m.id === step.piece) ??
      level.diffusers?.find((d) => d.id === step.piece);
    if (!piece) continue;
    const medium = 'material' in piece;
    if (medium && piece.stored === true) return { id: piece.id, kind: 'place' };
    const xOk = step.x === undefined || step.x === piece.x;
    const yOk = step.y === undefined || step.y === piece.y;
    if (!xOk || !yOk) return { id: piece.id, kind: 'move' };
    const symmetric = !('doubleSided' in piece) || piece.doubleSided !== false;
    if (step.angle !== undefined && rotationSteps(piece.angle, step.angle, symmetric) !== 0) {
      return { id: piece.id, kind: 'rotate' };
    }
    if (step.spread !== undefined && 'spread' in piece && piece.spread !== step.spread) {
      return { id: piece.id, kind: 'adjust' };
    }
  }
  return null;
}
