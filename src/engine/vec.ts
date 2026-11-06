/** 2D vector in logical board units (y points down). */
export interface Vec2 {
  x: number;
  y: number;
}

export const DEG_TO_RAD = Math.PI / 180;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** z component of the 3D cross product. */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** Normalises `v` into `out` (a zero vector stays zero). */
export function normalize(v: Vec2, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  const len = Math.hypot(v.x, v.y);
  out.x = len > 0 ? v.x / len : 0;
  out.y = len > 0 ? v.y / len : 0;
  return out;
}

/**
 * Unit direction for an angle in degrees, measured from +x towards +y.
 * With y pointing down, positive angles turn clockwise on screen.
 */
export function fromAngle(degrees: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  const a = degrees * DEG_TO_RAD;
  out.x = Math.cos(a);
  out.y = Math.sin(a);
  return out;
}

/** Mirror reflection r = d - 2(d.n)n, with `n` a unit normal. */
export function reflect(d: Vec2, n: Vec2, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  const k = 2 * (d.x * n.x + d.y * n.y);
  out.x = d.x - k * n.x;
  out.y = d.y - k * n.y;
  return out;
}
