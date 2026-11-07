import { rayCircleDistance, raySegmentDistance } from './geometry';
import type { Level, Mirror, Wall } from './pieces';
import { DEG_TO_RAD } from './vec';

export interface TraceOptions {
  /** Maximum number of reflections per emitted ray (default 32). */
  maxBounces?: number;
}

export const DEFAULT_MAX_BOUNCES = 32;
const NO_OPTIONS: TraceOptions = {};

/** Straight piece of a light path. Colour components are 0 to 1. */
export interface BeamSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Number of reflections before this segment (0 = straight from the emitter). */
  bounce: number;
  /** Index of the emitter in `level.emitters`. */
  emitter: number;
  r: number;
  g: number;
  b: number;
}

export type ImpactKind = 'mirror' | 'mirrorBack' | 'wall' | 'target';

/** Point where a ray meets a piece. `nx, ny` is the unit normal facing the incoming ray. */
export interface Impact {
  x: number;
  y: number;
  kind: ImpactKind;
  /** Index of the piece in its list (`level.mirrors`, `level.walls` or `level.targets`). */
  piece: number;
  nx: number;
  ny: number;
  bounce: number;
}

/**
 * Output of traceRays(). Reuse one instance across frames: its segment and impact
 * objects are pooled, so tracing does not allocate once the pools are warm.
 * Consumers must not keep references to the segments or impacts between traces.
 */
export class TraceResult {
  readonly segments: BeamSegment[] = [];
  readonly impacts: Impact[] = [];
  /** `targetsHit[i]` is true when `level.targets[i]` receives light. */
  readonly targetsHit: boolean[] = [];
  /** True when at least one ray was cut by the bounce limit. */
  truncated = false;

  private readonly segmentPool: BeamSegment[] = [];
  private readonly impactPool: Impact[] = [];
  /** Endpoints of mirrors then walls: ax, ay, bx, by for each. */
  geometry = new Float64Array(64);

  /** True when the level has targets and every one of them is lit. */
  get allTargetsHit(): boolean {
    const hits = this.targetsHit;
    if (hits.length === 0) return false;
    for (let i = 0; i < hits.length; i++) if (!hits[i]) return false;
    return true;
  }

  reset(targetCount: number): void {
    this.segments.length = 0;
    this.impacts.length = 0;
    this.targetsHit.length = targetCount;
    this.targetsHit.fill(false);
    this.truncated = false;
  }

  addSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bounce: number,
    emitter: number,
  ): void {
    const i = this.segments.length;
    let s = this.segmentPool[i];
    if (!s) {
      s = { x1: 0, y1: 0, x2: 0, y2: 0, bounce: 0, emitter: 0, r: 1, g: 1, b: 1 };
      this.segmentPool.push(s);
    }
    s.x1 = x1;
    s.y1 = y1;
    s.x2 = x2;
    s.y2 = y2;
    s.bounce = bounce;
    s.emitter = emitter;
    s.r = 1;
    s.g = 1;
    s.b = 1;
    this.segments.push(s);
  }

  addImpact(
    x: number,
    y: number,
    kind: ImpactKind,
    piece: number,
    nx: number,
    ny: number,
    bounce: number,
  ): void {
    const i = this.impacts.length;
    let im = this.impactPool[i];
    if (!im) {
      im = { x: 0, y: 0, kind: 'wall', piece: 0, nx: 0, ny: 0, bounce: 0 };
      this.impactPool.push(im);
    }
    im.x = x;
    im.y = y;
    im.kind = kind;
    im.piece = piece;
    im.nx = nx;
    im.ny = ny;
    im.bounce = bounce;
    this.impacts.push(im);
  }
}

/** Writes mirror then wall endpoints into `out.geometry`. */
function buildGeometry(level: Level, out: TraceResult): void {
  const count = level.mirrors.length + level.walls.length;
  if (out.geometry.length < count * 4) out.geometry = new Float64Array(count * 8);
  const k = writeEndpoints(level.mirrors, out.geometry, 0);
  writeEndpoints(level.walls, out.geometry, k);
}

function writeEndpoints(list: readonly (Mirror | Wall)[], g: Float64Array, start: number): number {
  let k = start;
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    const a = p.angle * DEG_TO_RAD;
    const hx = (Math.cos(a) * p.length) / 2;
    const hy = (Math.sin(a) * p.length) / 2;
    g[k++] = p.x - hx;
    g[k++] = p.y - hy;
    g[k++] = p.x + hx;
    g[k++] = p.y + hy;
  }
  return k;
}

/** Distance from (ox, oy) along (dx, dy) to the board edge. */
function exitDistance(level: Level, ox: number, oy: number, dx: number, dy: number): number {
  const tx = dx > 0 ? (level.width - ox) / dx : dx < 0 ? -ox / dx : Infinity;
  const ty = dy > 0 ? (level.height - oy) / dy : dy < 0 ? -oy / dy : Infinity;
  return Math.max(Math.min(tx, ty), 0);
}

/**
 * Traces every emitter through the level: reflects on mirrors (r = d - 2(d.n)n),
 * stops on walls, targets, single-sided mirror backs, the board edge, or after
 * `maxBounces` reflections. Pure: reads `level`, writes only into `out`.
 */
export function traceRays(
  level: Level,
  options: TraceOptions = NO_OPTIONS,
  out: TraceResult = new TraceResult(),
): TraceResult {
  const maxBounces = options.maxBounces ?? DEFAULT_MAX_BOUNCES;
  const mirrorCount = level.mirrors.length;
  const segmentCount = mirrorCount + level.walls.length;
  const targets = level.targets;

  out.reset(targets.length);
  buildGeometry(level, out);
  const g = out.geometry;

  for (let e = 0; e < level.emitters.length; e++) {
    const emitter = level.emitters[e]!;
    let ox = emitter.x;
    let oy = emitter.y;
    const a = emitter.angle * DEG_TO_RAD;
    let dx = Math.cos(a);
    let dy = Math.sin(a);
    let skip = -1;

    for (let bounce = 0; ; bounce++) {
      // Nearest straight piece (mirror or wall).
      let best = exitDistance(level, ox, oy, dx, dy);
      let hitSegment = -1;
      for (let i = 0; i < segmentCount; i++) {
        if (i === skip) continue;
        const k = i * 4;
        const t = raySegmentDistance(ox, oy, dx, dy, g[k]!, g[k + 1]!, g[k + 2]!, g[k + 3]!);
        if (t < best) {
          best = t;
          hitSegment = i;
        }
      }
      // Targets in front of it?
      let hitTarget = -1;
      for (let i = 0; i < targets.length; i++) {
        const tg = targets[i]!;
        const t = rayCircleDistance(ox, oy, dx, dy, tg.x, tg.y, tg.radius);
        if (t < best) {
          best = t;
          hitTarget = i;
        }
      }

      const hx = ox + dx * best;
      const hy = oy + dy * best;
      out.addSegment(ox, oy, hx, hy, bounce, e);

      if (hitTarget >= 0) {
        const tg = targets[hitTarget]!;
        out.targetsHit[hitTarget] = true;
        if (tg.passThrough === true) {
          out.addImpact(
            hx,
            hy,
            'target',
            hitTarget,
            (hx - tg.x) / tg.radius,
            (hy - tg.y) / tg.radius,
            bounce,
          );
          // Resume on the far side of the disc, same direction.
          const mx = hx - tg.x;
          const my = hy - tg.y;
          const chord = -2 * (mx * dx + my * dy);
          ox = hx + dx * chord;
          oy = hy + dy * chord;
          skip = -1;
          bounce--; // Crossing a target is not a reflection.
          continue;
        }
        out.addImpact(
          hx,
          hy,
          'target',
          hitTarget,
          (hx - tg.x) / tg.radius,
          (hy - tg.y) / tg.radius,
          bounce,
        );
        break;
      }
      if (hitSegment < 0) break; // Left the board.

      // Unit normal of the segment (front side), then orient it towards the ray.
      const k = hitSegment * 4;
      const sx = g[k + 2]! - g[k]!;
      const sy = g[k + 3]! - g[k + 1]!;
      const len = Math.hypot(sx, sy);
      let nx = -sy / len;
      let ny = sx / len;
      const facing = dx * nx + dy * ny; // < 0: the ray arrives on the front side.
      if (facing > 0) {
        nx = -nx;
        ny = -ny;
      }

      if (hitSegment >= mirrorCount) {
        out.addImpact(hx, hy, 'wall', hitSegment - mirrorCount, nx, ny, bounce);
        break;
      }
      const mirror = level.mirrors[hitSegment]!;
      if (mirror.doubleSided === false && facing > 0) {
        out.addImpact(hx, hy, 'mirrorBack', hitSegment, nx, ny, bounce);
        break;
      }
      out.addImpact(hx, hy, 'mirror', hitSegment, nx, ny, bounce);
      if (bounce >= maxBounces) {
        out.truncated = true;
        break;
      }

      // r = d - 2(d.n)n, renormalised against drift.
      const dn = 2 * (dx * nx + dy * ny);
      dx -= dn * nx;
      dy -= dn * ny;
      const dl = Math.hypot(dx, dy);
      dx /= dl;
      dy /= dl;
      ox = hx;
      oy = hy;
      skip = hitSegment;
    }
  }
  return out;
}
