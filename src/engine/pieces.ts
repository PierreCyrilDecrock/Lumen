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

/**
 * The six bands a prism splits white light into, from red to violet: display
 * colour, additive light vector (r, g, b in 0..1) and refractive index in a prism.
 * The spread of indices is exaggerated on purpose (real glass spreads ~1 %), so
 * that the six beams separate clearly on screen.
 */
export const SPECTRUM = [
  { name: 'red', label: 'rouge', hex: '#FF4D5E', rgb: [1, 0, 0], n: 1.45 },
  { name: 'orange', label: 'orange', hex: '#FF9F43', rgb: [1, 0.5, 0], n: 1.5 },
  { name: 'yellow', label: 'jaune', hex: '#FFE14D', rgb: [1, 1, 0], n: 1.55 },
  { name: 'green', label: 'vert', hex: '#5BE37D', rgb: [0, 1, 0], n: 1.61 },
  { name: 'blue', label: 'bleu', hex: '#4DA3FF', rgb: [0, 0, 1], n: 1.67 },
  { name: 'violet', label: 'violet', hex: '#B58CFF', rgb: [0.6, 0, 1], n: 1.73 },
] as const;

/** Band of a ray: -1 for white light, else an index in SPECTRUM. */
export type Band = number;
export const WHITE: Band = -1;

/** Named target colours (additive light vectors). */
export const COLORS = {
  red: [1, 0, 0],
  orange: [1, 0.5, 0],
  yellow: [1, 1, 0],
  green: [0, 1, 0],
  cyan: [0, 1, 1],
  blue: [0, 0, 1],
  violet: [0.6, 0, 1],
  magenta: [1, 0, 1],
  white: [1, 1, 1],
} as const satisfies Record<string, readonly [number, number, number]>;

export type ColorName = keyof typeof COLORS;

/** Display colours for the named target colours. */
export const COLOR_HEX: Record<ColorName, string> = {
  red: '#FF4D5E',
  orange: '#FF9F43',
  yellow: '#FFE14D',
  green: '#5BE37D',
  cyan: '#5FE3E8',
  blue: '#4DA3FF',
  violet: '#B58CFF',
  magenta: '#F06BE0',
  white: '#F2F6FF',
};

/** Labels shown to the player. */
export const COLOR_LABELS: Record<ColorName, string> = {
  red: 'rouge',
  orange: 'orange',
  yellow: 'jaune',
  green: 'vert',
  cyan: 'cyan',
  blue: 'bleu',
  violet: 'violet',
  magenta: 'magenta',
  white: 'blanc',
};

/**
 * Glass prism: an equilateral triangle of side `size` centred on (x, y). One
 * corner points along `angle` - 90° (straight up at 0°). White light entering it
 * is split into the six bands of SPECTRUM, each refracted with its own index.
 */
export interface Prism {
  id: string;
  x: number;
  y: number;
  angle: number;
  size: number;
  rotatable?: boolean;
  movable?: boolean;
}

/** Colour filter: a thin plate letting only some bands through. */
export interface Filter {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  /** Bands (indices in SPECTRUM) that cross it. */
  bands: readonly number[];
  rotatable?: boolean;
  movable?: boolean;
}

/** Target lit only by light of the right colour (several rays add up). */
export interface ColorTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: ColorName;
  /** Maximum difference per component once normalised (default 0.2). */
  tolerance: number;
}

export const DEFAULT_COLOR_TOLERANCE = 0.2;

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
  prisms?: readonly Prism[];
  filters?: readonly Filter[];
  colorTargets?: readonly ColorTarget[];
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
