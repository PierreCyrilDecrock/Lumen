import type { Emitter, Level, Medium, Mirror, Target, Wall } from '../src/engine';

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
