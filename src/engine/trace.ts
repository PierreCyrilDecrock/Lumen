import { pointInPolygon, rayCircleDistance, raySegmentDistance, rectCorners } from './geometry';
import {
  AIR_INDEX,
  DEFAULT_FAN_RAYS,
  MATERIALS,
  type Crystal,
  type Diffuser,
  type Fog,
  type Level,
  type Medium,
  type Mirror,
  type Wall,
} from './pieces';
import { DEG_TO_RAD } from './vec';

export interface TraceOptions {
  /** Maximum number of interactions (reflections, refractions) per main ray (default 32). */
  maxBounces?: number;
}

export const DEFAULT_MAX_BOUNCES = 32;
/** Share of light sent back by a partial reflection at an interface. */
export const PARTIAL_REFLECTION = 0.15;
/** Minimum intensity for a ray to light a target. */
export const TARGET_THRESHOLD = 0.5;
/** Hard cap on segments per trace, whatever the level. */
export const MAX_SEGMENTS = 1024;
/** Hard cap on rays per trace (emitted, partial reflections, fans), for 60 fps. */
export const MAX_RAYS = 200;
/** Rays dimmer than this are dropped. */
export const MIN_INTENSITY = 0.005;
/** Distance falloff of diffused light: received = I / (1 + d / FALLOFF_DISTANCE). */
export const FALLOFF_DISTANCE = 200;
/** Interactions allowed to each ray of a fan (one reflection). */
export const FAN_BOUNCES = 1;

const NO_OPTIONS: TraceOptions = {};
const RAD_TO_DEG = 180 / Math.PI;

/** Straight piece of a light path. Colour components and intensity are 0 to 1. */
export interface BeamSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Number of interactions before this segment (0 = straight from the emitter). */
  bounce: number;
  /** Index of the emitter in `level.emitters`. */
  emitter: number;
  r: number;
  g: number;
  b: number;
  /** Intensity at the start of the segment. */
  intensity: number;
  /** Index of the medium the segment travels in, -1 for air. */
  medium: number;
  /** True for the rays of a diffusion fan. */
  diffused: boolean;
}

export type ImpactKind =
  | 'mirror'
  | 'mirrorBack'
  | 'wall'
  | 'target'
  | 'interface'
  | 'totalReflection'
  | 'diffuser'
  | 'crystal';

/** Point where a ray meets a piece. `nx, ny` is the unit normal facing the incoming ray. */
export interface Impact {
  x: number;
  y: number;
  kind: ImpactKind;
  /** Index of the piece in its list (mirrors, walls, targets, media, diffusers, crystals). */
  piece: number;
  nx: number;
  ny: number;
  bounce: number;
  intensity: number;
  /** Angle of incidence from the normal, degrees (interfaces only, else NaN). */
  incidence: number;
  /** Angle of refraction from the normal, degrees (NaN when none). */
  refraction: number;
  /** For interfaces: true when the ray enters the medium. */
  entering: boolean;
}

const KIND_MIRROR = 0;
const KIND_WALL = 1;
const KIND_MEDIUM = 2;
const KIND_DIFFUSER = 3;
const KIND_FOG = 4;
const EDGE_FIELDS = 6;
/** Pending ray: ox, oy, dx, dy, intensity, medium, bounce, generation, skip, dist, fog, budget. */
const RAY_FIELDS = 12;
/** Cone of a fan, for rendering: x, y, axis angle (rad), spread (rad), intensity. */
const CONE_FIELDS = 5;

/**
 * Output of traceRays(). Reuse one instance across frames: its segment and impact
 * objects are pooled, so tracing does not allocate once the pools are warm.
 * Consumers must not keep references to the segments or impacts between traces.
 */
export class TraceResult {
  readonly segments: BeamSegment[] = [];
  readonly impacts: Impact[] = [];
  /** `targetsHit[i]` is true when `level.targets[i]` receives enough light. */
  readonly targetsHit: boolean[] = [];
  /** Light gathered by each crystal. */
  readonly crystalLight: number[] = [];
  /** Progress of each crystal, 0 to 1 (1 = lit). */
  readonly crystalProgress: number[] = [];
  /** True when at least one ray was cut by a limit (bounces, segments, rays). */
  truncated = false;
  /** Rays traced (emitted, partial reflections, fan rays). */
  rayCount = 0;
  /** Fan cones (see CONE_FIELDS), `coneCount` of them. */
  cones = new Float64Array(8 * CONE_FIELDS);
  coneCount = 0;

  private readonly segmentPool: BeamSegment[] = [];
  private readonly impactPool: Impact[] = [];
  /** Straight edges: ax, ay, bx, by, then outward normal nx, ny (closed shapes). */
  geometry = new Float64Array(64 * EDGE_FIELDS);
  edgeKind = new Int8Array(64);
  edgePiece = new Int32Array(64);
  rays = new Float64Array(64 * RAY_FIELDS);
  readonly corners = new Float64Array(8);

  /** True when the level has targets and every one of them is lit. */
  get allTargetsHit(): boolean {
    const hits = this.targetsHit;
    if (hits.length === 0) return false;
    for (let i = 0; i < hits.length; i++) if (!hits[i]) return false;
    return true;
  }

  get crystalsLit(): number {
    let n = 0;
    for (let i = 0; i < this.crystalProgress.length; i++) if (this.crystalProgress[i]! >= 1) n++;
    return n;
  }

  /** Every target and every crystal is lit (and there is at least one of them). */
  get solved(): boolean {
    const goals = this.targetsHit.length + this.crystalProgress.length;
    if (goals === 0) return false;
    for (let i = 0; i < this.targetsHit.length; i++) if (!this.targetsHit[i]) return false;
    return this.crystalsLit === this.crystalProgress.length;
  }

  reset(targetCount: number, crystalCount: number): void {
    this.segments.length = 0;
    this.impacts.length = 0;
    this.targetsHit.length = targetCount;
    this.targetsHit.fill(false);
    this.crystalLight.length = crystalCount;
    this.crystalLight.fill(0);
    this.crystalProgress.length = crystalCount;
    this.crystalProgress.fill(0);
    this.truncated = false;
    this.rayCount = 0;
    this.coneCount = 0;
  }

  addSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bounce: number,
    emitter: number,
    intensity: number,
    medium: number,
    diffused = false,
  ): void {
    const i = this.segments.length;
    let s = this.segmentPool[i];
    if (!s) {
      s = {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        bounce: 0,
        emitter: 0,
        r: 1,
        g: 1,
        b: 1,
        intensity: 1,
        medium: -1,
        diffused: false,
      };
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
    s.intensity = intensity;
    s.medium = medium;
    s.diffused = diffused;
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
    intensity: number,
    incidence = Number.NaN,
    refraction = Number.NaN,
    entering = false,
  ): void {
    const i = this.impacts.length;
    let im = this.impactPool[i];
    if (!im) {
      im = {
        x: 0,
        y: 0,
        kind: 'wall',
        piece: 0,
        nx: 0,
        ny: 0,
        bounce: 0,
        intensity: 1,
        incidence: Number.NaN,
        refraction: Number.NaN,
        entering: false,
      };
      this.impactPool.push(im);
    }
    im.x = x;
    im.y = y;
    im.kind = kind;
    im.piece = piece;
    im.nx = nx;
    im.ny = ny;
    im.bounce = bounce;
    im.intensity = intensity;
    im.incidence = incidence;
    im.refraction = refraction;
    im.entering = entering;
    this.impacts.push(im);
  }

  addCone(x: number, y: number, axis: number, spread: number, intensity: number): void {
    if ((this.coneCount + 1) * CONE_FIELDS > this.cones.length) {
      const grown = new Float64Array(this.cones.length * 2);
      grown.set(this.cones);
      this.cones = grown;
    }
    const o = this.coneCount * CONE_FIELDS;
    this.cones[o] = x;
    this.cones[o + 1] = y;
    this.cones[o + 2] = axis;
    this.cones[o + 3] = spread;
    this.cones[o + 4] = intensity;
    this.coneCount++;
  }
}

export { CONE_FIELDS };

const NO_MEDIA: readonly Medium[] = [];
const NO_DIFFUSERS: readonly Diffuser[] = [];
const NO_CRYSTALS: readonly Crystal[] = [];
const NO_FOGS: readonly Fog[] = [];

function ensureEdges(out: TraceResult, count: number): void {
  if (out.edgeKind.length >= count) return;
  out.geometry = new Float64Array(count * 2 * EDGE_FIELDS);
  out.edgeKind = new Int8Array(count * 2);
  out.edgePiece = new Int32Array(count * 2);
}

/** Fills the edge table: mirrors, walls, diffusers, then the sides of media and fogs. */
function buildGeometry(level: Level, out: TraceResult): number {
  const media = level.media ?? NO_MEDIA;
  const fogs = level.fogs ?? NO_FOGS;
  const diffusers = level.diffusers ?? NO_DIFFUSERS;
  let count = level.mirrors.length + level.walls.length + diffusers.length + fogs.length * 4;
  for (const m of media) if (m.stored !== true) count += 4;
  ensureEdges(out, count);
  let e = writeLinear(level.mirrors, KIND_MIRROR, out, 0);
  e = writeLinear(level.walls, KIND_WALL, out, e);
  e = writeLinear(diffusers, KIND_DIFFUSER, out, e);
  for (let i = 0; i < media.length; i++) {
    const m = media[i]!;
    if (m.stored === true) continue;
    e = writeRect(out, e, KIND_MEDIUM, i, m.x, m.y, m.width, m.height, m.angle);
  }
  for (let i = 0; i < fogs.length; i++) {
    const f = fogs[i]!;
    e = writeRect(out, e, KIND_FOG, i, f.x, f.y, f.width, f.height, f.angle);
  }
  return e;
}

function writeRect(
  out: TraceResult,
  start: number,
  kind: number,
  piece: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
): number {
  const g = out.geometry;
  const c = rectCorners(cx, cy, w, h, angle, out.corners);
  let e = start;
  for (let k = 0; k < 4; k++) {
    const j = (k + 1) % 4;
    const ax = c[k * 2]!;
    const ay = c[k * 2 + 1]!;
    const bx = c[j * 2]!;
    const by = c[j * 2 + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    let nx = -(by - ay) / len;
    let ny = (bx - ax) / len;
    if (((ax + bx) / 2 - cx) * nx + ((ay + by) / 2 - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const o = e * EDGE_FIELDS;
    g[o] = ax;
    g[o + 1] = ay;
    g[o + 2] = bx;
    g[o + 3] = by;
    g[o + 4] = nx;
    g[o + 5] = ny;
    out.edgeKind[e] = kind;
    out.edgePiece[e] = piece;
    e++;
  }
  return e;
}

function writeLinear(
  list: readonly (Mirror | Wall | Diffuser)[],
  kind: number,
  out: TraceResult,
  start: number,
): number {
  const g = out.geometry;
  let e = start;
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    const a = p.angle * DEG_TO_RAD;
    const hx = (Math.cos(a) * p.length) / 2;
    const hy = (Math.sin(a) * p.length) / 2;
    const o = e * EDGE_FIELDS;
    g[o] = p.x - hx;
    g[o + 1] = p.y - hy;
    g[o + 2] = p.x + hx;
    g[o + 3] = p.y + hy;
    out.edgeKind[e] = kind;
    out.edgePiece[e] = i;
    e++;
  }
  return e;
}

/** Distance from (ox, oy) along (dx, dy) to the board edge. */
function exitDistance(level: Level, ox: number, oy: number, dx: number, dy: number): number {
  const tx = dx > 0 ? (level.width - ox) / dx : dx < 0 ? -ox / dx : Infinity;
  const ty = dy > 0 ? (level.height - oy) / dy : dy < 0 ? -oy / dy : Infinity;
  return Math.max(Math.min(tx, ty), 0);
}

/** Index of the medium containing a point, or -1 for air. */
function mediumAt(level: Level, x: number, y: number, corners: Float64Array): number {
  const media = level.media ?? NO_MEDIA;
  for (let i = 0; i < media.length; i++) {
    const m = media[i]!;
    if (m.stored === true) continue;
    if (pointInPolygon(x, y, rectCorners(m.x, m.y, m.width, m.height, m.angle, corners))) return i;
  }
  return -1;
}

/** Absorption density of the fog containing a point, or 0. */
function fogAt(level: Level, x: number, y: number, corners: Float64Array): number {
  for (const f of level.fogs ?? NO_FOGS) {
    if (pointInPolygon(x, y, rectCorners(f.x, f.y, f.width, f.height, f.angle, corners)))
      return f.density;
  }
  return 0;
}

/** Pushes a pending ray, unless the ray budget is spent. Returns the new stack top. */
function pushRay(
  out: TraceResult,
  top: number,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  intensity: number,
  medium: number,
  bounce: number,
  generation: number,
  skip: number,
  dist: number,
  fog: number,
  budget: number,
): number {
  if (out.rayCount >= MAX_RAYS) {
    out.truncated = true;
    return top;
  }
  out.rayCount++;
  if ((top + 1) * RAY_FIELDS > out.rays.length) {
    const grown = new Float64Array(out.rays.length * 2);
    grown.set(out.rays);
    out.rays = grown;
  }
  const r = out.rays;
  const o = top * RAY_FIELDS;
  r[o] = ox;
  r[o + 1] = oy;
  r[o + 2] = dx;
  r[o + 3] = dy;
  r[o + 4] = intensity;
  r[o + 5] = medium;
  r[o + 6] = bounce;
  r[o + 7] = generation;
  r[o + 8] = skip;
  r[o + 9] = dist;
  r[o + 10] = fog;
  r[o + 11] = budget;
  return top + 1;
}

/** Light actually received from a ray: diffused light fades with distance. */
export function receivedLight(intensity: number, distSinceDiffusion: number): number {
  return distSinceDiffusion < 0
    ? intensity
    : intensity / (1 + distSinceDiffusion / FALLOFF_DISTANCE);
}

/**
 * Traces every emitter through the level.
 * - Mirrors reflect (r = d - 2(d.n)n).
 * - Media refract (n1 sin t1 = n2 sin t2), reflect totally beyond the critical
 *   angle, and send back a weak partial reflection (main rays only).
 * - A diffuser replaces a main ray by a fan (Lambert weights, total conserved);
 *   fan rays fade with distance and may be reflected once.
 * - Fog absorbs: I = I0 exp(-density * length).
 * - Crystals gather light and let it through.
 * Rays stop on walls, absorbing targets, single-sided mirror backs, the board
 * edge, or at a limit. Pure: writes only into `out`.
 */
export function traceRays(
  level: Level,
  options: TraceOptions = NO_OPTIONS,
  out: TraceResult = new TraceResult(),
): TraceResult {
  const maxBounces = options.maxBounces ?? DEFAULT_MAX_BOUNCES;
  const targets = level.targets;
  const media = level.media ?? NO_MEDIA;
  const diffusers = level.diffusers ?? NO_DIFFUSERS;
  const crystals = level.crystals ?? NO_CRYSTALS;
  const fogs = level.fogs ?? NO_FOGS;

  out.reset(targets.length, crystals.length);
  const edgeCount = buildGeometry(level, out);
  const g = out.geometry;

  for (let e = 0; e < level.emitters.length; e++) {
    const emitter = level.emitters[e]!;
    const a = emitter.angle * DEG_TO_RAD;
    let top = pushRay(
      out,
      0,
      emitter.x,
      emitter.y,
      Math.cos(a),
      Math.sin(a),
      1,
      mediumAt(level, emitter.x, emitter.y, out.corners),
      0,
      0,
      -1,
      -1,
      fogAt(level, emitter.x, emitter.y, out.corners),
      maxBounces,
    );

    while (top > 0) {
      top--;
      const o = top * RAY_FIELDS;
      const r = out.rays;
      let ox = r[o]!;
      let oy = r[o + 1]!;
      let dx = r[o + 2]!;
      let dy = r[o + 3]!;
      let intensity = r[o + 4]!;
      let medium = r[o + 5]!;
      let bounce = r[o + 6]!;
      const generation = r[o + 7]!;
      let skip = r[o + 8]!;
      let dist = r[o + 9]!;
      let fog = r[o + 10]!;
      let budget = r[o + 11]!;
      const diffused = dist >= 0;
      // Crystal just crossed, ignored on the way out.
      let skipCrystal = -1;

      for (;;) {
        if (out.segments.length >= MAX_SEGMENTS) {
          out.truncated = true;
          break;
        }
        let best = exitDistance(level, ox, oy, dx, dy);
        let hitEdge = -1;
        for (let i = 0; i < edgeCount; i++) {
          if (i === skip) continue;
          const k = i * EDGE_FIELDS;
          const t = raySegmentDistance(ox, oy, dx, dy, g[k]!, g[k + 1]!, g[k + 2]!, g[k + 3]!);
          if (t < best) {
            best = t;
            hitEdge = i;
          }
        }
        let hitTarget = -1;
        for (let i = 0; i < targets.length; i++) {
          const tg = targets[i]!;
          const t = rayCircleDistance(ox, oy, dx, dy, tg.x, tg.y, tg.radius);
          if (t < best) {
            best = t;
            hitTarget = i;
          }
        }
        let hitCrystal = -1;
        for (let i = 0; i < crystals.length; i++) {
          if (i === skipCrystal) continue;
          const c = crystals[i]!;
          const t = rayCircleDistance(ox, oy, dx, dy, c.x, c.y, c.radius);
          if (t < best) {
            best = t;
            hitCrystal = i;
            hitTarget = -1;
          }
        }
        if (hitCrystal >= 0) hitEdge = -1;
        else if (hitTarget >= 0) hitEdge = -1;

        const hx = ox + dx * best;
        const hy = oy + dy * best;
        out.addSegment(ox, oy, hx, hy, bounce, e, intensity, medium, diffused);
        // Travelled distance: fog absorption and diffused falloff.
        if (fog > 0) intensity *= Math.exp(-fog * best);
        if (dist >= 0) dist += best;
        if (intensity < MIN_INTENSITY) break;

        if (hitCrystal >= 0) {
          const c = crystals[hitCrystal]!;
          const light = receivedLight(intensity, dist);
          out.crystalLight[hitCrystal]! += light;
          out.crystalProgress[hitCrystal] = Math.min(
            1,
            out.crystalLight[hitCrystal]! / c.threshold,
          );
          out.addImpact(
            hx,
            hy,
            'crystal',
            hitCrystal,
            (hx - c.x) / c.radius,
            (hy - c.y) / c.radius,
            bounce,
            light,
          );
          // Cross the crystal and carry on.
          const chord = -2 * ((hx - c.x) * dx + (hy - c.y) * dy);
          ox = hx + dx * chord;
          oy = hy + dy * chord;
          if (dist >= 0) dist += chord;
          skip = -1;
          skipCrystal = hitCrystal;
          continue;
        }
        skipCrystal = -1;

        if (hitTarget >= 0) {
          const tg = targets[hitTarget]!;
          if (receivedLight(intensity, dist) >= TARGET_THRESHOLD) out.targetsHit[hitTarget] = true;
          const tnx = (hx - tg.x) / tg.radius;
          const tny = (hy - tg.y) / tg.radius;
          out.addImpact(hx, hy, 'target', hitTarget, tnx, tny, bounce, intensity);
          if (tg.passThrough !== true) break;
          // Resume on the far side of the disc, same direction.
          const chord = -2 * ((hx - tg.x) * dx + (hy - tg.y) * dy);
          ox = hx + dx * chord;
          oy = hy + dy * chord;
          if (dist >= 0) dist += chord;
          skip = -1;
          continue;
        }
        if (hitEdge < 0) break; // Left the board.

        const k = hitEdge * EDGE_FIELDS;
        const kind = out.edgeKind[hitEdge]!;
        const piece = out.edgePiece[hitEdge]!;

        if (kind === KIND_FOG) {
          // Crossing a fog boundary: no deviation, change the absorption.
          const entering = dx * g[k + 4]! + dy * g[k + 5]! < 0;
          fog = entering ? fogs[piece]!.density : 0;
          ox = hx;
          oy = hy;
          skip = hitEdge;
          continue;
        }
        if (kind === KIND_WALL) {
          const n = segmentNormalFacing(g, k, dx, dy);
          out.addImpact(hx, hy, 'wall', piece, n.x, n.y, bounce, intensity);
          break;
        }
        if (kind === KIND_DIFFUSER) {
          if (diffused) {
            // Fans go through frosted glass unchanged.
            ox = hx;
            oy = hy;
            skip = hitEdge;
            continue;
          }
          const n = segmentNormalFacing(g, k, dx, dy);
          out.addImpact(hx, hy, 'diffuser', piece, n.x, n.y, bounce, intensity);
          top = spawnFan(
            out,
            top,
            diffusers[piece]!,
            hx,
            hy,
            -n.x,
            -n.y,
            intensity,
            medium,
            bounce,
            hitEdge,
            fog,
          );
          break;
        }
        if (budget <= 0) {
          if (!diffused) out.truncated = true;
          break;
        }

        if (kind === KIND_MIRROR) {
          const n = segmentNormalFacing(g, k, dx, dy);
          const mirror = level.mirrors[piece]!;
          if (mirror.doubleSided === false && n.front === false) {
            out.addImpact(hx, hy, 'mirrorBack', piece, n.x, n.y, bounce, intensity);
            break;
          }
          out.addImpact(hx, hy, 'mirror', piece, n.x, n.y, bounce, intensity);
          const dn = 2 * (dx * n.x + dy * n.y);
          dx -= dn * n.x;
          dy -= dn * n.y;
        } else {
          // Interface of a medium. Outward normal stored with the edge.
          const onx = g[k + 4]!;
          const ony = g[k + 5]!;
          const entering = dx * onx + dy * ony < 0;
          const mat = media[piece]!.material;
          const n1 = entering
            ? medium >= 0
              ? MATERIALS[media[medium]!.material].n
              : AIR_INDEX
            : MATERIALS[mat].n;
          const n2 = entering ? MATERIALS[mat].n : AIR_INDEX;
          // Normal facing the incoming ray.
          const nx = entering ? onx : -onx;
          const ny = entering ? ony : -ony;
          const cosi = Math.min(1, -(dx * nx + dy * ny));
          const eta = n1 / n2;
          const k2 = 1 - eta * eta * (1 - cosi * cosi);
          const incidence = Math.acos(cosi) * RAD_TO_DEG;
          // Reflected direction (used for total and partial reflection).
          const rx = dx + 2 * cosi * nx;
          const ry = dy + 2 * cosi * ny;
          if (k2 < 0) {
            out.addImpact(hx, hy, 'totalReflection', piece, nx, ny, bounce, intensity, incidence);
            dx = rx;
            dy = ry;
          } else {
            const cost = Math.sqrt(k2);
            const refraction = Math.acos(Math.min(1, cost)) * RAD_TO_DEG;
            out.addImpact(
              hx,
              hy,
              'interface',
              piece,
              nx,
              ny,
              bounce,
              intensity,
              incidence,
              refraction,
              entering,
            );
            if (generation === 0) {
              top = pushRay(
                out,
                top,
                hx,
                hy,
                rx,
                ry,
                intensity * PARTIAL_REFLECTION,
                medium,
                bounce + 1,
                1,
                hitEdge,
                dist,
                fog,
                budget - 1,
              );
            }
            dx = eta * dx + (eta * cosi - cost) * nx;
            dy = eta * dy + (eta * cosi - cost) * ny;
            medium = entering ? piece : -1;
          }
        }
        const dl = Math.hypot(dx, dy);
        dx /= dl;
        dy /= dl;
        ox = hx;
        oy = hy;
        skip = hitEdge;
        bounce++;
        budget--;
      }
    }
  }
  return out;
}

/**
 * Replaces a ray by a fan of rays around the exit normal (nx, ny), weighted by
 * Lambert's cosine law and normalised so the total intensity is conserved.
 */
function spawnFan(
  out: TraceResult,
  top: number,
  diffuser: Diffuser,
  x: number,
  y: number,
  nx: number,
  ny: number,
  intensity: number,
  medium: number,
  bounce: number,
  edge: number,
  fog: number,
): number {
  const count = Math.max(1, Math.round(diffuser.rays ?? DEFAULT_FAN_RAYS));
  const spread = diffuser.spread * DEG_TO_RAD;
  const axis = Math.atan2(ny, nx);
  out.addCone(x, y, axis, spread, intensity);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.cos(fanOffset(i, count, spread));
  for (let i = 0; i < count; i++) {
    const offset = fanOffset(i, count, spread);
    const w = Math.cos(offset) / total;
    const a = axis + offset;
    top = pushRay(
      out,
      top,
      x,
      y,
      Math.cos(a),
      Math.sin(a),
      intensity * w,
      medium,
      bounce + 1,
      1,
      edge,
      0,
      fog,
      FAN_BOUNCES,
    );
  }
  return top;
}

/** Angle of ray `i` of a fan of `count` rays, relative to its axis. */
function fanOffset(i: number, count: number, spread: number): number {
  return count === 1 ? 0 : -spread / 2 + (i * spread) / (count - 1);
}

/** Scratch result of segmentNormalFacing (no allocation). */
const facing = { x: 0, y: 0, front: true };

/**
 * Unit normal of edge `k` turned towards the incoming ray. `front` tells whether
 * the ray arrives on the front side (direction turned +90°, for mirrors).
 */
function segmentNormalFacing(g: Float64Array, k: number, dx: number, dy: number): typeof facing {
  const sx = g[k + 2]! - g[k]!;
  const sy = g[k + 3]! - g[k + 1]!;
  const len = Math.hypot(sx, sy);
  let nx = -sy / len;
  let ny = sx / len;
  const d = dx * nx + dy * ny;
  facing.front = d <= 0;
  if (d > 0) {
    nx = -nx;
    ny = -ny;
  }
  facing.x = nx;
  facing.y = ny;
  return facing;
}
