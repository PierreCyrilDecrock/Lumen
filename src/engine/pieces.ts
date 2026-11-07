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

/**
 * Circular target centred on (x, y). It absorbs the ray that reaches it, unless
 * `passThrough` is set: the ray then lights it and carries on.
 */
export interface Target {
  id: string;
  x: number;
  y: number;
  radius: number;
  passThrough?: boolean;
}

/** Transparent materials and their refractive index. */
export const MATERIALS = {
  water: { n: 1.33, name: 'Eau' },
  glass: { n: 1.5, name: 'Verre' },
  diamond: { n: 2.42, name: 'Diamant' },
} as const;

export type Material = keyof typeof MATERIALS;

/** Refractive index of air, outside every medium. */
export const AIR_INDEX = 1;

/**
 * Transparent block: a rectangle centred on (x, y), `width` along `angle` and
 * `height` across. Media never overlap; outside them is air.
 */
export interface Medium {
  id: string;
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
  material: Material;
  /** The player may rotate it (default true). */
  rotatable?: boolean;
  /** The player may drag it (default false). */
  movable?: boolean;
  /** Can go back to the tray (implies movable). */
  trayable?: boolean;
  /** Currently in the tray: not on the board, ignored by the tracer. */
  stored?: boolean;
}

/**
 * Frosted glass plate centred on (x, y), along `angle`. A main ray crossing it
 * is replaced by a fan of `rays` rays spread over `spread` degrees around the
 * plate normal on the far side, weighted by Lambert's cosine law.
 */
export interface Diffuser {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  /** Fan opening, 20 to 90 degrees. */
  spread: number;
  /** Number of rays in the fan (default 9). */
  rays?: number;
  rotatable?: boolean;
  movable?: boolean;
  /** The player may change `spread` with the « Dépoli du verre » slider. */
  adjustable?: boolean;
}

/** Crystal: lights up once the light it gathers reaches `threshold`. Light crosses it. */
export interface Crystal {
  id: string;
  x: number;
  y: number;
  radius: number;
  threshold: number;
}

/** Fog bank: a rectangle that absorbs light, I = I0 · exp(-density · length crossed). */
export interface Fog {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  /** Absorption per logical unit. */
  density: number;
}

export const SPREAD_MIN = 20;
export const SPREAD_MAX = 90;
export const DEFAULT_FAN_RAYS = 9;
export const DEFAULT_CRYSTAL_RADIUS = 10;
export const DEFAULT_CRYSTAL_THRESHOLD = 0.06;

/** Everything the optical engine needs to trace a board. */
export interface Level {
  width: number;
  height: number;
  emitters: readonly Emitter[];
  mirrors: readonly Mirror[];
  walls: readonly Wall[];
  targets: readonly Target[];
  media?: readonly Medium[];
  diffusers?: readonly Diffuser[];
  crystals?: readonly Crystal[];
  fogs?: readonly Fog[];
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
