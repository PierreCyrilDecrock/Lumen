import {
  pointPolygonDistance,
  polygonsOverlap,
  rectCorners,
  type Diffuser,
  type Level,
  type Medium,
  type Mirror,
} from '../engine';
import { MIRROR_WIDTH, WALL_THICKNESS } from '../render/theme';

export type PieceKind = 'mirror' | 'medium' | 'diffuser';

/** Free space kept between a piece and the board edge. */
const EDGE_MARGIN = 4;
/** Clearance around emitters, measured from their centre. */
const EMITTER_CLEARANCE = 15;
/** Extra width around mirrors so two mirrors never touch. */
const MIRROR_GAP = 2;

const candidate = new Float64Array(8);
const other = new Float64Array(8);
const NO_MEDIA: readonly Medium[] = [];
const NO_DIFFUSERS: readonly Diffuser[] = [];

function mirrorPolygon(
  m: Mirror | Diffuser,
  x: number,
  y: number,
  angle: number,
  out: Float64Array,
  extra = 0,
) {
  return rectCorners(x, y, m.length, MIRROR_WIDTH + extra, angle, out);
}

/**
 * True when piece `index` of `kind` can stand at (x, y, angle): fully on the
 * board and clear of walls, mirrors, media, targets and emitters.
 */
export function canPlace(
  level: Level,
  kind: PieceKind,
  index: number,
  x: number,
  y: number,
  angle: number,
): boolean {
  const media = level.media ?? NO_MEDIA;
  const diffusers = level.diffusers ?? NO_DIFFUSERS;
  const self =
    kind === 'mirror' ? level.mirrors[index] : kind === 'medium' ? media[index] : diffusers[index];
  if (!self) return false;
  if ('width' in self) rectCorners(x, y, self.width, self.height, angle, candidate);
  else mirrorPolygon(self, x, y, angle, candidate);
  const thin = kind !== 'medium';

  for (let i = 0; i < 4; i++) {
    const px = candidate[i * 2]!;
    const py = candidate[i * 2 + 1]!;
    if (
      px < EDGE_MARGIN ||
      py < EDGE_MARGIN ||
      px > level.width - EDGE_MARGIN ||
      py > level.height - EDGE_MARGIN
    ) {
      return false;
    }
  }
  for (const w of level.walls) {
    if (polygonsOverlap(candidate, rectCorners(w.x, w.y, w.length, WALL_THICKNESS, w.angle, other)))
      return false;
  }
  for (let i = 0; i < level.mirrors.length; i++) {
    if (kind === 'mirror' && i === index) continue;
    const m = level.mirrors[i]!;
    const gap = thin ? MIRROR_GAP * 2 : 0;
    if (polygonsOverlap(candidate, mirrorPolygon(m, m.x, m.y, m.angle, other, gap))) return false;
  }
  for (let i = 0; i < diffusers.length; i++) {
    if (kind === 'diffuser' && i === index) continue;
    const d = diffusers[i]!;
    const gap = thin ? MIRROR_GAP * 2 : 0;
    if (polygonsOverlap(candidate, mirrorPolygon(d, d.x, d.y, d.angle, other, gap))) return false;
  }
  for (let i = 0; i < media.length; i++) {
    if (kind === 'medium' && i === index) continue;
    const m = media[i]!;
    if (m.stored === true) continue;
    if (polygonsOverlap(candidate, rectCorners(m.x, m.y, m.width, m.height, m.angle, other)))
      return false;
  }
  for (const t of level.targets) {
    if (pointPolygonDistance(t.x, t.y, candidate) < t.radius + 1) return false;
  }
  for (const c of level.crystals ?? []) {
    if (pointPolygonDistance(c.x, c.y, candidate) < c.radius + 1) return false;
  }
  for (const e of level.emitters) {
    if (pointPolygonDistance(e.x, e.y, candidate) < EMITTER_CLEARANCE) return false;
  }
  return true;
}

/** Shorthand for mirrors. */
export function canPlaceMirror(
  level: Level,
  index: number,
  x: number,
  y: number,
  angle: number,
): boolean {
  return canPlace(level, 'mirror', index, x, y, angle);
}
