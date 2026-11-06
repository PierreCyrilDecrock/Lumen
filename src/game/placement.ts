import {
  endpointsOf,
  pointSegmentDistance,
  segmentSegmentDistance,
  type Level,
  type SegmentCoords,
} from '../engine';
import { MIRROR_WIDTH, WALL_THICKNESS } from '../render/theme';

/** Free space kept between a mirror and the board edge. */
const EDGE_MARGIN = 4;
/** Clearance around emitters, measured from their centre. */
const EMITTER_CLEARANCE = 18;

const mine: SegmentCoords = { ax: 0, ay: 0, bx: 0, by: 0 };
const other: SegmentCoords = { ax: 0, ay: 0, bx: 0, by: 0 };

/**
 * True when mirror `index` can stand at (x, y, angle): fully on the board and
 * clear of walls, other mirrors, targets and emitters.
 */
export function canPlaceMirror(
  level: Level,
  index: number,
  x: number,
  y: number,
  angle: number,
): boolean {
  const mirror = level.mirrors[index];
  if (!mirror) return false;
  const m = endpointsOf(mirror, mine, x, y, angle);

  const minX = EDGE_MARGIN;
  const minY = EDGE_MARGIN;
  const maxX = level.width - EDGE_MARGIN;
  const maxY = level.height - EDGE_MARGIN;
  if (!inside(m.ax, m.ay, minX, minY, maxX, maxY) || !inside(m.bx, m.by, minX, minY, maxX, maxY)) {
    return false;
  }

  for (const wall of level.walls) {
    const w = endpointsOf(wall, other);
    const d = segmentSegmentDistance(m.ax, m.ay, m.bx, m.by, w.ax, w.ay, w.bx, w.by);
    if (d < WALL_THICKNESS / 2 + MIRROR_WIDTH / 2) return false;
  }
  for (let i = 0; i < level.mirrors.length; i++) {
    if (i === index) continue;
    const o = endpointsOf(level.mirrors[i]!, other);
    const d = segmentSegmentDistance(m.ax, m.ay, m.bx, m.by, o.ax, o.ay, o.bx, o.by);
    if (d < MIRROR_WIDTH + 2) return false;
  }
  for (const t of level.targets) {
    if (pointSegmentDistance(t.x, t.y, m.ax, m.ay, m.bx, m.by) < t.radius + MIRROR_WIDTH / 2 + 1)
      return false;
  }
  for (const e of level.emitters) {
    if (pointSegmentDistance(e.x, e.y, m.ax, m.ay, m.bx, m.by) < EMITTER_CLEARANCE) return false;
  }
  return true;
}

function inside(
  x: number,
  y: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}
