import type { LevelDefinition, PieceDef } from '../levels/schema';
import type { Diffuser, Filter, Level, Medium, Mirror, Prism } from '../engine';
import { rotationPeriod } from './interaction';
import { normalizeAngle, ANGLE_STEP } from './snap';

/**
 * 15° steps on the shortest arc between two angles, modulo the piece's period
 * (180° for a double-sided mirror or a block, 120° for a prism, 360° otherwise).
 * `true` / `false` stand for 180° / 360°.
 */
export function rotationSteps(from: number, to: number, period: number | boolean): number {
  const p = period === true ? 180 : period === false ? 360 : period;
  const d = normalizeAngle(to - from) % p;
  return Math.round(Math.min(d, p - d) / ANGLE_STEP);
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
    total += rotationSteps(piece.angle, step.angle, definitionPeriod(piece));
  }
  return total;
}

/** Rotation period of a piece definition (see rotationSteps). */
function definitionPeriod(piece: PieceDef): number {
  if (piece.type === 'prism') return 120;
  if (piece.type === 'mirror' && piece.doubleSided === false) return 360;
  return 180;
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
    const piece: Mirror | Medium | Diffuser | Prism | Filter | undefined =
      level.mirrors.find((m) => m.id === step.piece) ??
      level.media?.find((m) => m.id === step.piece) ??
      level.diffusers?.find((d) => d.id === step.piece) ??
      level.prisms?.find((p) => p.id === step.piece) ??
      level.filters?.find((f) => f.id === step.piece);
    if (!piece) continue;
    const medium = 'material' in piece;
    if (medium && piece.stored === true) return { id: piece.id, kind: 'place' };
    const xOk = step.x === undefined || step.x === piece.x;
    const yOk = step.y === undefined || step.y === piece.y;
    if (!xOk || !yOk) return { id: piece.id, kind: 'move' };
    if (
      step.angle !== undefined &&
      rotationSteps(piece.angle, step.angle, rotationPeriod(piece)) !== 0
    ) {
      return { id: piece.id, kind: 'rotate' };
    }
    if (step.spread !== undefined && 'spread' in piece && piece.spread !== step.spread) {
      return { id: piece.id, kind: 'adjust' };
    }
  }
  return null;
}
