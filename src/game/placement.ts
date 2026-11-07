import {
  pointPolygonDistance,
  polygonsOverlap,
  rectCorners,
  triangleCorners,
  type Level,
} from '../engine';
import { DIFFUSER_WIDTH, MIRROR_WIDTH, WALL_THICKNESS } from '../render/theme';

export type PieceKind = 'mirror' | 'medium' | 'diffuser' | 'prism' | 'filter';

const KINDS: readonly PieceKind[] = ['mirror', 'medium', 'diffuser', 'prism', 'filter'];
/** Free space kept between a piece and the board edge. */
const EDGE_MARGIN = 4;
/** Clearance around emitters, measured from their centre. */
const EMITTER_CLEARANCE = 15;
/** Extra width around thin pieces so that two of them never touch. */
const THIN_GAP = 4;

const candidate = new Float64Array(8);
const other = new Float64Array(8);

/** Number of pieces of a kind in the level. */
function countOf(level: Level, kind: PieceKind): number {
  switch (kind) {
    case 'mirror':
      return level.mirrors.length;
    case 'medium':
      return level.media?.length ?? 0;
    case 'diffuser':
      return level.diffusers?.length ?? 0;
    case 'prism':
      return level.prisms?.length ?? 0;
    case 'filter':
      return level.filters?.length ?? 0;
  }
}

/**
 * Outline of piece `index` of `kind` at (x, y, angle), written into `out`.
 * Returns its number of corners, or 0 when the piece is absent or in the tray.
 */
function outline(
  level: Level,
  kind: PieceKind,
  index: number,
  out: Float64Array,
  pose?: { x: number; y: number; angle: number },
  extra = 0,
): number {
  switch (kind) {
    case 'mirror': {
      const m = level.mirrors[index];
      if (!m) return 0;
      const p = pose ?? m;
      rectCorners(p.x, p.y, m.length, MIRROR_WIDTH + extra, p.angle, out);
      return 4;
    }
    case 'medium': {
      const m = level.media?.[index];
      if (!m || (m.stored === true && !pose)) return 0;
      const p = pose ?? m;
      rectCorners(p.x, p.y, m.width, m.height, p.angle, out);
      return 4;
    }
    case 'diffuser': {
      const d = level.diffusers?.[index];
      if (!d) return 0;
      const p = pose ?? d;
      rectCorners(p.x, p.y, d.length, DIFFUSER_WIDTH + extra, p.angle, out);
      return 4;
    }
    case 'prism': {
      const t = level.prisms?.[index];
      if (!t) return 0;
      const p = pose ?? t;
      triangleCorners(p.x, p.y, t.size, p.angle, out);
      return 3;
    }
    case 'filter': {
      const f = level.filters?.[index];
      if (!f) return 0;
      const p = pose ?? f;
      rectCorners(p.x, p.y, f.length, MIRROR_WIDTH + extra, p.angle, out);
      return 4;
    }
  }
}

const isThin = (kind: PieceKind): boolean => kind !== 'medium' && kind !== 'prism';

/**
 * True when piece `index` of `kind` can stand at (x, y, angle): fully on the
 * board and clear of walls, other pieces, targets, crystals and emitters.
 */
export function canPlace(
  level: Level,
  kind: PieceKind,
  index: number,
  x: number,
  y: number,
  angle: number,
): boolean {
  const n = outline(level, kind, index, candidate, { x, y, angle });
  if (n === 0) return false;

  for (let i = 0; i < n; i++) {
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
    const wall = rectCorners(w.x, w.y, w.length, WALL_THICKNESS, w.angle, other);
    if (polygonsOverlap(candidate, wall, n, 4)) return false;
  }
  for (const k of KINDS) {
    const gap = isThin(kind) && isThin(k) ? THIN_GAP : 0;
    for (let i = 0; i < countOf(level, k); i++) {
      if (k === kind && i === index) continue;
      const m = outline(level, k, i, other, undefined, gap);
      if (m > 0 && polygonsOverlap(candidate, other, n, m)) return false;
    }
  }
  const circles = [...level.targets, ...(level.crystals ?? []), ...(level.colorTargets ?? [])];
  for (const c of circles) {
    if (pointPolygonDistance(c.x, c.y, candidate, n) < c.radius + 1) return false;
  }
  for (const e of level.emitters) {
    if (pointPolygonDistance(e.x, e.y, candidate, n) < EMITTER_CLEARANCE) return false;
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
