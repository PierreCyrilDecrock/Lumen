/**
 * Optical pieces. Positions are in logical board units, angles in degrees
 * (0 = towards +x, positive = clockwise on screen since y points down).
 */

/** Light source: emits one white ray from (x, y) along `angle`. */
export interface Emitter {
  id: string;
  x: number;
  y: number;
  angle: number;
}

/**
 * Flat mirror centred on (x, y), oriented along `angle`, `length` long.
 * A single-sided mirror reflects on its front only, whose normal is the mirror
 * direction turned by +90° (clockwise on screen); its back absorbs.
 */
export interface Mirror {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  /** Defaults to true. */
  doubleSided?: boolean;
  /** The player may rotate it (default true). Ignored by the tracer. */
  rotatable?: boolean;
  /** The player may drag it on the grid (default false). Ignored by the tracer. */
  movable?: boolean;
}

/** Opaque wall segment centred on (x, y): absorbs light. */
export interface Wall {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
}

/** Circular target centred on (x, y); absorbs the ray that reaches it. */
export interface Target {
  id: string;
  x: number;
  y: number;
  radius: number;
}

/** Everything the optical engine needs to trace a board. */
export interface Level {
  width: number;
  height: number;
  emitters: readonly Emitter[];
  mirrors: readonly Mirror[];
  walls: readonly Wall[];
  targets: readonly Target[];
}

export const DEFAULT_TARGET_RADIUS = 12;

/** A straight piece: centre, orientation and length. */
export interface LinearPiece {
  x: number;
  y: number;
  angle: number;
  length: number;
}

/** Endpoints of a straight piece. */
export interface SegmentCoords {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Writes the endpoints of `piece` (optionally at another pose) into `out`. */
export function endpointsOf(
  piece: LinearPiece,
  out: SegmentCoords,
  x = piece.x,
  y = piece.y,
  angle = piece.angle,
): SegmentCoords {
  const a = (angle * Math.PI) / 180;
  const hx = (Math.cos(a) * piece.length) / 2;
  const hy = (Math.sin(a) * piece.length) / 2;
  out.ax = x - hx;
  out.ay = y - hy;
  out.bx = x + hx;
  out.by = y + hy;
  return out;
}
