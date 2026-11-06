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
