import type { Vec2 } from './vec';

/** Line segment from `a` to `b`. */
export interface Segment {
  a: Vec2;
  b: Vec2;
}

/** Half-line starting at `origin`, along the unit vector `dir`. */
export interface Ray {
  origin: Vec2;
  dir: Vec2;
}

/** Minimum travel before a hit counts: avoids re-hitting the surface just left. */
export const EPSILON_DISTANCE = 1e-6;
/** Tolerance on the segment parameter, so a ray aimed at an endpoint still hits it. */
export const EPSILON_ENDPOINT = 1e-9;
/** Below this |sin| between ray and segment, they are treated as parallel. */
export const EPSILON_PARALLEL = 1e-9;

/**
 * Distance along a ray (unit direction) to a segment, or Infinity when missed.
 * Scalar form, allocation-free, for the tracing loop.
 * Parallel and collinear rays never hit; endpoints are inclusive.
 */
export function raySegmentDistance(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const sx = bx - ax;
  const sy = by - ay;
  const denom = dx * sy - dy * sx;
  const segLen = Math.hypot(sx, sy);
  if (segLen === 0 || Math.abs(denom) <= EPSILON_PARALLEL * segLen) return Infinity;

  const wx = ax - ox;
  const wy = ay - oy;
  const t = (wx * sy - wy * sx) / denom;
  if (t <= EPSILON_DISTANCE) return Infinity;
  const u = (wx * dy - wy * dx) / denom;
  if (u < -EPSILON_ENDPOINT || u > 1 + EPSILON_ENDPOINT) return Infinity;
  return t;
}

/** Distance along `ray` to `segment`, or Infinity when missed. */
export function intersect(ray: Ray, segment: Segment): number {
  return raySegmentDistance(
    ray.origin.x,
    ray.origin.y,
    ray.dir.x,
    ray.dir.y,
    segment.a.x,
    segment.a.y,
    segment.b.x,
    segment.b.y,
  );
}

/**
 * Distance along a ray (unit direction) to the entry point of a circle, or Infinity.
 * A ray starting inside the circle does not count as a hit.
 */
export function rayCircleDistance(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  const mx = ox - cx;
  const my = oy - cy;
  const b = mx * dx + my * dy;
  const c = mx * mx + my * my - radius * radius;
  if (c > 0 && b > 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > EPSILON_DISTANCE ? t : Infinity;
}

/** Distance from point (px, py) to segment [a, b]. */
export function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const sx = bx - ax;
  const sy = by - ay;
  const len2 = sx * sx + sy * sy;
  let t = len2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * sx), py - (ay + t * sy));
}

/** Shortest distance between segments [a, b] and [c, d]; 0 when they cross. */
export function segmentSegmentDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number {
  const d1 = orient(cx, cy, dx, dy, ax, ay);
  const d2 = orient(cx, cy, dx, dy, bx, by);
  const d3 = orient(ax, ay, bx, by, cx, cy);
  const d4 = orient(ax, ay, bx, by, dx, dy);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    pointSegmentDistance(ax, ay, cx, cy, dx, dy),
    pointSegmentDistance(bx, by, cx, cy, dx, dy),
    pointSegmentDistance(cx, cy, ax, ay, bx, by),
    pointSegmentDistance(dx, dy, ax, ay, bx, by),
  );
}

/** Sign of the turn a -> b -> p (cross product). */
function orient(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}
