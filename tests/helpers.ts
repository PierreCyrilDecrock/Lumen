import type {
  ColorTarget,
  Crystal,
  Diffuser,
  Emitter,
  Filter,
  Fog,
  Level,
  Medium,
  Mirror,
  Prism,
  Target,
  Wall,
} from '../src/engine';

let nextId = 0;
const id = (prefix: string): string => `${prefix}${nextId++}`;

export const emitter = (x: number, y: number, angle: number): Emitter => ({
  id: id('e'),
  x,
  y,
  angle,
});

export const mirror = (
  x: number,
  y: number,
  angle: number,
  length = 40,
  doubleSided = true,
): Mirror => ({ id: id('m'), x, y, angle, length, doubleSided });

export const wall = (x: number, y: number, angle: number, length: number): Wall => ({
  id: id('w'),
  x,
  y,
  angle,
  length,
});

export const target = (x: number, y: number, radius = 12): Target => ({
  id: id('t'),
  x,
  y,
  radius,
});

export function level(parts: Partial<Level>): Level {
  return { width: 390, height: 560, emitters: [], mirrors: [], walls: [], targets: [], ...parts };
}

/** "\" on screen (y down) is 45°, "/" is 135°. */
export const BACKSLASH = 45;
export const SLASH = 135;

export const medium = (
  x: number,
  y: number,
  width: number,
  height: number,
  material: Medium['material'],
  angle = 0,
): Medium => ({ id: id('n'), x, y, width, height, angle, material });

export const diffuser = (
  x: number,
  y: number,
  angle: number,
  spread = 60,
  length = 40,
): Diffuser => ({ id: id('d'), x, y, angle, spread, length });

export const crystal = (x: number, y: number, threshold = 0.06, radius = 10): Crystal => ({
  id: id('c'),
  x,
  y,
  radius,
  threshold,
});

export const fog = (x: number, y: number, width: number, height: number, density: number): Fog => ({
  id: id('f'),
  x,
  y,
  width,
  height,
  angle: 0,
  density,
});

export const prism = (x: number, y: number, angle = 0, size = 90): Prism => ({
  id: id('p'),
  x,
  y,
  angle,
  size,
});

export const filter = (
  x: number,
  y: number,
  angle: number,
  bands: number[],
  length = 40,
): Filter => ({
  id: id('g'),
  x,
  y,
  angle,
  length,
  bands,
});

export const colorTarget = (
  x: number,
  y: number,
  color: ColorTarget['color'],
  radius = 12,
): ColorTarget => ({
  id: id('k'),
  x,
  y,
  radius,
  color,
  tolerance: 0.2,
});
