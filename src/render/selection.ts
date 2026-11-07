import type { BeamSegment } from '../engine';

/** Anything with a centre and an orientation. */
export interface Placed {
  x: number;
  y: number;
  angle: number;
}
import { BACKGROUND, CYAN, FONT_FAMILY } from './theme';

/** What the renderer needs to know about the player's selection. */
export interface SelectionView {
  /** Index of the selected mirror, or -1. */
  selected: number;
  rotatable: boolean;
  /** True while the ring or the piece is being dragged. */
  dragging: boolean;
  ringRadius: number;
  /** Distance from the centre where the arm to the handle starts. */
  armStart: number;
  /** Angle text, e.g. "45°". */
  label: string;
  /** Drop bounce scale applied to the selected mirror (1 = rest). */
  bounce: number;
  /** Index of the mirror highlighted by a hint, or -1. */
  hint: number;
  /** Opacity of the hint highlight (pulses unless motion is reduced). */
  hintAlpha: number;
}

export function createSelectionView(): SelectionView {
  return {
    selected: -1,
    rotatable: false,
    dragging: false,
    ringRadius: 0,
    armStart: 0,
    label: '',
    bounce: 1,
    hint: -1,
    hintAlpha: 0,
  };
}

const TICKS = 24; // One per 15°.

/** Rotation ring with 15° ticks and the handle aligned with the mirror. */
export function drawRotationRing(
  ctx: CanvasRenderingContext2D,
  m: Placed,
  view: SelectionView,
): void {
  const r = view.ringRadius;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = CYAN;
  ctx.lineCap = 'round';

  ctx.globalAlpha = view.dragging ? 0.9 : 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = view.dragging ? 0.6 : 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * Math.PI * 2;
    const inner = r - (i % 6 === 0 ? 6 : 3.5);
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.moveTo(c * inner, s * inner);
    ctx.lineTo(c * r, s * r);
  }
  ctx.stroke();

  // Arm from the mirror end to the handle, then the handle itself.
  const a = (m.angle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c * view.armStart, s * view.armStart);
  ctx.lineTo(c * (r - 8), s * (r - 8));
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(c * r, s * r, view.dragging ? 9 : 8, 0, Math.PI * 2);
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c * r, s * r, 3, 0, Math.PI * 2);
  ctx.fillStyle = BACKGROUND;
  ctx.fill();
  ctx.restore();
}

const LABEL_HEIGHT = 22;

/**
 * Angle label in a dark pill next to the ring. Tries above, below, right and left,
 * and keeps the first spot that covers no beam and stays on the board.
 */
export function drawAngleLabel(
  ctx: CanvasRenderingContext2D,
  m: Placed,
  view: SelectionView,
  beams: readonly BeamSegment[],
  boardWidth: number,
  boardHeight: number,
): void {
  if (!view.label) return;
  ctx.font = `600 13px ${FONT_FAMILY}`;
  const w = ctx.measureText(view.label).width + 14;
  const vertical = view.ringRadius + 18;
  const horizontal = view.ringRadius + w / 2 + 8;

  let x = m.x;
  let y = m.y - vertical;
  for (let i = 0; i < 4; i++) {
    const cx = i === 2 ? m.x + horizontal : i === 3 ? m.x - horizontal : m.x;
    const cy = i === 0 ? m.y - vertical : i === 1 ? m.y + vertical : m.y;
    if (labelFits(cx, cy, w, beams, boardWidth, boardHeight)) {
      x = cx;
      y = cy;
      break;
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = BACKGROUND;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - LABEL_HEIGHT / 2, w, LABEL_HEIGHT, LABEL_HEIGHT / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = CYAN;
  ctx.fillText(view.label, x, y + 0.5);
}

/** True when a label box centred on (cx, cy) is on the board and clear of every beam. */
function labelFits(
  cx: number,
  cy: number,
  w: number,
  beams: readonly BeamSegment[],
  boardWidth: number,
  boardHeight: number,
): boolean {
  const hw = w / 2 + 3;
  const hh = LABEL_HEIGHT / 2 + 3;
  if (cx - hw < 0 || cx + hw > boardWidth || cy - hh < 0 || cy + hh > boardHeight) return false;
  for (let i = 0; i < beams.length; i++) {
    const b = beams[i]!;
    if (segmentHitsBox(b.x1, b.y1, b.x2, b.y2, cx - hw, cy - hh, cx + hw, cy + hh)) return false;
  }
  return true;
}

/** Segment / axis-aligned box overlap (Liang-Barsky clipping), allocation-free. */
function segmentHitsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  clipRange.t0 = 0;
  clipRange.t1 = 1;
  return clip(-dx, x1 - minX) && clip(dx, maxX - x1) && clip(-dy, y1 - minY) && clip(dy, maxY - y1);
}

const clipRange = { t0: 0, t1: 1 };

function clip(p: number, q: number): boolean {
  if (p === 0) return q >= 0;
  const t = q / p;
  if (p < 0) clipRange.t0 = Math.max(clipRange.t0, t);
  else clipRange.t1 = Math.min(clipRange.t1, t);
  return clipRange.t0 <= clipRange.t1;
}

/** Hint highlight: a soft cyan double ring of radius `r` around the piece to act on. */
export function drawHint(ctx: CanvasRenderingContext2D, m: Placed, r: number, alpha: number): void {
  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.35;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(m.x, m.y, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
