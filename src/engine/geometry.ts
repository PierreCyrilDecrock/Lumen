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

/**
 * Corners of a rectangle centred on (cx, cy), `w` along its angle and `h` across,
 * written into `out` as x0, y0, x1, y1… (4 corners, consistent winding).
 */
export function rectCorners(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angleDeg: number,
  out: Float64Array = new Float64Array(8),
): Float64Array {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const hw = w / 2;
  const hh = h / 2;
  // Corners (-w,-h), (+w,-h), (+w,+h), (-w,+h) in the local frame (x along u, y along u turned +90°).
  for (let i = 0; i < 4; i++) {
    const sx = (i === 1 || i === 2 ? 1 : -1) * hw;
    const sy = (i >= 2 ? 1 : -1) * hh;
    out[i * 2] = cx + ux * sx - uy * sy;
    out[i * 2 + 1] = cy + uy * sx + ux * sy;
  }
  return out;
}

/** Separating-axis test for two convex polygons (flat x, y arrays). Touching counts as apart. */
export function polygonsOverlap(a: Float64Array, b: Float64Array, countA = 4, countB = 4): boolean {
  return !hasSeparatingAxis(a, countA, b, countB) && !hasSeparatingAxis(b, countB, a, countA);
}

function hasSeparatingAxis(a: Float64Array, na: number, b: Float64Array, nb: number): boolean {
  for (let i = 0; i < na; i++) {
    const j = (i + 1) % na;
    const nx = -(a[j * 2 + 1]! - a[i * 2 + 1]!);
    const ny = a[j * 2]! - a[i * 2]!;
    let minA = Infinity;
    let maxA = -Infinity;
    for (let k = 0; k < na; k++) {
      const p = a[k * 2]! * nx + a[k * 2 + 1]! * ny;
      minA = Math.min(minA, p);
      maxA = Math.max(maxA, p);
    }
    let minB = Infinity;
    let maxB = -Infinity;
    for (let k = 0; k < nb; k++) {
      const p = b[k * 2]! * nx + b[k * 2 + 1]! * ny;
      minB = Math.min(minB, p);
      maxB = Math.max(maxB, p);
    }
    const eps = 1e-9 * (Math.abs(nx) + Math.abs(ny));
    if (maxA <= minB + eps || maxB <= minA + eps) return true;
  }
  return false;
}

/** True when (px, py) lies inside a convex polygon (either winding). */
export function pointInPolygon(px: number, py: number, poly: Float64Array, count = 4): boolean {
  let sign = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const c =
      (poly[j * 2]! - poly[i * 2]!) * (py - poly[i * 2 + 1]!) -
      (poly[j * 2 + 1]! - poly[i * 2 + 1]!) * (px - poly[i * 2]!);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Distance from a point to a convex polygon; 0 inside. */
export function pointPolygonDistance(
  px: number,
  py: number,
  poly: Float64Array,
  count = 4,
): number {
  if (pointInPolygon(px, py, poly, count)) return 0;
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    best = Math.min(
      best,
      pointSegmentDistance(px, py, poly[i * 2]!, poly[i * 2 + 1]!, poly[j * 2]!, poly[j * 2 + 1]!),
    );
  }
  return best;
}

/**
 * Corners of an equilateral triangle of side `size` centred on (cx, cy), one
 * corner pointing along angleDeg - 90°, written into `out` (3 corners).
 */
export function triangleCorners(
  cx: number,
  cy: number,
  size: number,
  angleDeg: number,
  out: Float64Array = new Float64Array(6),
): Float64Array {
  const r = size / Math.sqrt(3);
  for (let i = 0; i < 3; i++) {
    const a = ((angleDeg - 90 + i * 120) * Math.PI) / 180;
    out[i * 2] = cx + Math.cos(a) * r;
    out[i * 2 + 1] = cy + Math.sin(a) * r;
  }
  return out;
}
