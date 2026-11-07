import {
  endpointsOf,
  pointPolygonDistance,
  pointSegmentDistance,
  rectCorners,
  type Diffuser,
  type Level,
  type Material,
  type Medium,
  type Mirror,
  type SegmentCoords,
} from '../engine';
import { History } from './history';
import type { LogicalPointerEvent } from './input';
import { canPlace, type PieceKind } from './placement';
import { GRID_STEP, snapAngle, snapToGrid } from './snap';

/** Pose of a piece, as stored in the history. */
export interface Pose {
  x: number;
  y: number;
  angle: number;
  /** For tray blocks: true while in the tray. */
  stored: boolean;
  /** For diffusers: fan opening (NaN otherwise). */
  spread: number;
}

/** One undoable change of a piece (`index` in the unified piece list). */
export interface PieceChange {
  index: number;
  from: Pose;
  to: Pose;
}

export type DragMode = 'none' | 'rotate' | 'move' | 'press';

/** A piece the player can handle: a mirror, a transparent block or frosted glass. */
export type Piece = Mirror | Medium | Diffuser;

export interface InteractionHooks {
  /** Pointer capture radius in logical units (44 CSS px wide zone). */
  captureRadius(): number;
  /** Called on each 15° notch during a pointer rotation (for vibration). */
  onAngleStep?(pointerType: string): void;
  /** Called when the selection, the history or a piece changes. */
  onChange?(): void;
  /** Called for each player move (not for undo / redo). */
  onCommit?(change: PieceChange): void;
}

/** Gap between a piece and its rotation ring. */
const RING_GAP = 16;
const NO_MEDIA: Medium[] = [];
const NO_DIFFUSERS: Diffuser[] = [];

export const isMedium = (p: Piece): p is Medium => 'material' in p;
export const isDiffuser = (p: Piece): p is Diffuser => 'spread' in p;
export const isRotatable = (p: Piece): boolean => p.rotatable !== false;
export const isMovable = (p: Piece): boolean =>
  p.movable === true || (isMedium(p) && p.trayable === true);
const isOnBoard = (p: Piece): boolean => !(isMedium(p) && p.stored === true);
const isSelectable = (p: Piece): boolean => isOnBoard(p) && (isRotatable(p) || isMovable(p));

/** Radius of the rotation ring around a piece. */
export function ringRadius(p: Piece): number {
  return isMedium(p) ? Math.hypot(p.width, p.height) / 2 + RING_GAP - 4 : p.length / 2 + RING_GAP;
}

/** Distance from the centre where the arm to the handle starts. */
export function armStart(p: Piece): number {
  return isMedium(p) ? p.width / 2 : p.length / 2;
}

/** True when the piece looks the same after a half turn. */
export function isHalfTurnSymmetric(p: Piece): boolean {
  return isMedium(p) || isDiffuser(p) || p.doubleSided !== false;
}

/**
 * Selection, rotation, movement, tray and undo/redo of the board's pieces.
 * DOM-free: it consumes pointer events in logical units and mutates the level's
 * pieces in place. Pieces are indexed mirrors first, then media.
 */
export class Interaction {
  selected = -1;
  mode: DragMode = 'none';
  /** True when the level changed and must be re-traced; the caller clears it. */
  dirty = true;
  /** Time (s) of the last drop or keyboard rotation, for the bounce effect. */
  dropTime = -Infinity;
  readonly history = new History<PieceChange>();
  /** While true (pause, victory), the player can no longer change anything. */
  locked = false;

  private readonly start: Pose = { x: 0, y: 0, angle: 0, stored: false, spread: Number.NaN };
  /** Pose before the frosted-glass slider started moving, or null. */
  private spreadStart: Pose | null = null;
  private grabDx = 0;
  private grabDy = 0;
  private grabAngle = 0;
  private readonly seg: SegmentCoords = { ax: 0, ay: 0, bx: 0, by: 0 };
  private readonly poly = new Float64Array(8);
  private readonly media: Medium[];
  private readonly diffusers: Diffuser[];

  constructor(
    readonly level: Level,
    private readonly hooks: InteractionHooks,
  ) {
    this.media = (level.media as Medium[] | undefined) ?? NO_MEDIA;
    this.diffusers = (level.diffusers as Diffuser[] | undefined) ?? NO_DIFFUSERS;
  }

  /** Pieces are indexed mirrors, then media, then diffusers. */
  get pieceCount(): number {
    return this.level.mirrors.length + this.media.length + this.diffusers.length;
  }

  piece(index: number): Piece | null {
    if (index < 0) return null;
    const m = this.level.mirrors.length;
    if (index < m) return this.level.mirrors[index] ?? null;
    if (index < m + this.media.length) return this.media[index - m] ?? null;
    return this.diffusers[index - m - this.media.length] ?? null;
  }

  kindOf(index: number): PieceKind {
    const m = this.level.mirrors.length;
    return index < m ? 'mirror' : index < m + this.media.length ? 'medium' : 'diffuser';
  }

  /** Index of `index` within its own kind's list. */
  private localIndex(index: number): number {
    const m = this.level.mirrors.length;
    const kind = this.kindOf(index);
    return kind === 'mirror'
      ? index
      : kind === 'medium'
        ? index - m
        : index - m - this.media.length;
  }

  /** The diffuser the « Dépoli » slider acts on: the selected one, else the first adjustable one. */
  adjustableDiffuser(): number {
    const selected = this.selectedPiece;
    if (selected && isDiffuser(selected) && selected.adjustable === true) return this.selected;
    const i = this.diffusers.findIndex((d) => d.adjustable === true);
    return i < 0 ? -1 : this.level.mirrors.length + this.media.length + i;
  }

  /**
   * Sets the fan opening of diffuser `index` (slider). Preview updates are live;
   * `commit` records one undoable change from where the slider started.
   */
  setSpread(index: number, spread: number, time: number, commit: boolean): boolean {
    const p = this.piece(index);
    if (!p || !isDiffuser(p) || p.adjustable !== true || this.locked || this.mode !== 'none')
      return false;
    this.spreadStart ??= poseOf(p);
    if (p.spread !== spread) {
      p.spread = spread;
      this.dirty = true;
    }
    if (commit) {
      const from = this.spreadStart;
      this.spreadStart = null;
      if (from.spread !== p.spread) this.commit(index, from, time);
    }
    return true;
  }

  /** Unified index of the piece with this id, or -1. */
  indexOf(id: string): number {
    for (let i = 0; i < this.pieceCount; i++) if (this.piece(i)?.id === id) return i;
    return -1;
  }

  get selectedPiece(): Piece | null {
    return this.piece(this.selected);
  }

  handlePointer(e: LogicalPointerEvent, time: number): void {
    if (this.locked && this.mode === 'none') return;
    switch (e.phase) {
      case 'down':
        this.onDown(e.x, e.y);
        break;
      case 'move':
        this.onDrag(e.x, e.y, e.pointerType);
        break;
      case 'up':
        this.finishDrag(time);
        break;
      case 'cancel':
        this.cancelDrag();
        break;
      case 'hover':
        break;
    }
  }

  /** Rotates the selection by `delta` degrees (keyboard). */
  rotateSelected(delta: number, time: number): boolean {
    const p = this.selectedPiece;
    if (!p || !isRotatable(p) || this.mode !== 'none' || this.locked) return false;
    const angle = snapAngle(p.angle + delta);
    if (!this.canPlace(this.selected, p.x, p.y, angle)) return false;
    const from = poseOf(p);
    p.angle = angle;
    this.commit(this.selected, from, time);
    return true;
  }

  /** Blocks of each material still in the tray. */
  trayCounts(): Partial<Record<Material, number>> {
    const counts: Partial<Record<Material, number>> = {};
    for (const m of this.media) {
      if (m.trayable === true && m.stored === true)
        counts[m.material] = (counts[m.material] ?? 0) + 1;
    }
    return counts;
  }

  /** Puts a block of `material` from the tray on the board, near its preferred spot. */
  placeFromTray(material: Material, time: number): boolean {
    if (this.locked || this.mode !== 'none') return false;
    const offset = this.level.mirrors.length;
    const i = this.media.findIndex((m) => m.material === material && m.stored === true);
    const block = this.media[i];
    if (!block) return false;
    const spot = this.findFreeSpot(offset + i, block);
    if (!spot) return false;
    const from = poseOf(block);
    block.stored = false;
    block.x = spot.x;
    block.y = spot.y;
    this.selected = offset + i;
    this.commit(offset + i, from, time);
    return true;
  }

  /** Sends the selected block back to the tray. */
  storeSelected(time: number): boolean {
    const p = this.selectedPiece;
    if (!p || !isMedium(p) || p.trayable !== true || this.locked || this.mode !== 'none')
      return false;
    const index = this.selected;
    const from = poseOf(p);
    p.stored = true;
    this.selected = -1;
    this.commit(index, from, time);
    return true;
  }

  undo(): boolean {
    if (this.mode !== 'none' || this.locked) return false;
    const entry = this.history.undo();
    if (!entry) return false;
    this.apply(entry.index, entry.from);
    return true;
  }

  redo(): boolean {
    if (this.mode !== 'none' || this.locked) return false;
    const entry = this.history.redo();
    if (!entry) return false;
    this.apply(entry.index, entry.to);
    return true;
  }

  deselect(): void {
    if (this.selected < 0 || this.mode !== 'none') return;
    this.selected = -1;
    this.hooks.onChange?.();
  }

  /** CSS cursor for the pointer at (x, y). */
  cursorAt(x: number, y: number): string {
    if (this.mode === 'rotate' || this.mode === 'move') return 'grabbing';
    if (this.onHandle(x, y) || this.onRing(x, y)) return 'grab';
    const index = this.pick(x, y);
    if (index < 0) return 'default';
    return isMovable(this.piece(index)!) ? 'grab' : 'pointer';
  }

  /** Position of the rotation handle of `p`, written into `out`. */
  handlePosition(p: Piece, out: { x: number; y: number }): { x: number; y: number } {
    const a = (p.angle * Math.PI) / 180;
    const r = ringRadius(p);
    out.x = p.x + Math.cos(a) * r;
    out.y = p.y + Math.sin(a) * r;
    return out;
  }

  canPlace(index: number, x: number, y: number, angle: number): boolean {
    return canPlace(this.level, this.kindOf(index), this.localIndex(index), x, y, angle);
  }

  private commit(index: number, from: Pose, time: number): void {
    const p = this.piece(index)!;
    const change = { index, from, to: poseOf(p) };
    this.history.push(change);
    this.hooks.onCommit?.(change);
    this.dirty = true;
    this.dropTime = time;
    this.hooks.onChange?.();
  }

  /** Preferred spot of a block, else the nearest free grid spot around it. */
  private findFreeSpot(index: number, block: Medium): { x: number; y: number } | null {
    const cx = snapToGrid(block.x);
    const cy = snapToGrid(block.y);
    for (let ring = 0; ring <= 40; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = cx + dx * GRID_STEP;
          const y = cy + dy * GRID_STEP;
          block.stored = false;
          const ok = this.canPlace(index, x, y, block.angle);
          block.stored = true;
          if (ok) return { x, y };
        }
      }
    }
    return null;
  }

  private onDown(x: number, y: number): void {
    if (this.mode !== 'none') return;
    const current = this.selectedPiece;
    if (current && isRotatable(current) && this.onHandle(x, y)) {
      this.beginRotate(current, x, y);
      return;
    }
    const index = this.pick(x, y);
    if (index >= 0) {
      const changed = index !== this.selected;
      this.selected = index;
      const p = this.piece(index)!;
      if (isMovable(p)) {
        copyPose(p, this.start);
        this.grabDx = x - p.x;
        this.grabDy = y - p.y;
        this.mode = 'move';
      } else {
        this.mode = 'press';
      }
      if (changed) this.hooks.onChange?.();
      return;
    }
    if (current && isRotatable(current) && this.onRing(x, y)) {
      this.beginRotate(current, x, y);
      return;
    }
    this.deselect();
  }

  private beginRotate(p: Piece, x: number, y: number): void {
    copyPose(p, this.start);
    this.grabAngle = p.angle - pointerAngle(p, x, y);
    this.mode = 'rotate';
  }

  private onDrag(x: number, y: number, pointerType: string): void {
    const p = this.selectedPiece;
    if (!p) return;
    if (this.mode === 'rotate') {
      const angle = snapAngle(pointerAngle(p, x, y) + this.grabAngle);
      if (angle === p.angle) return;
      if (!this.canPlace(this.selected, p.x, p.y, angle)) return;
      p.angle = angle;
      this.dirty = true;
      this.hooks.onAngleStep?.(pointerType);
    } else if (this.mode === 'move') {
      const nx = snapToGrid(x - this.grabDx);
      const ny = snapToGrid(y - this.grabDy);
      if (nx === p.x && ny === p.y) return;
      if (!this.canPlace(this.selected, nx, ny, p.angle)) return;
      p.x = nx;
      p.y = ny;
      this.dirty = true;
    }
  }

  private finishDrag(time: number): void {
    const p = this.selectedPiece;
    const mode = this.mode;
    this.mode = 'none';
    if (!p || (mode !== 'rotate' && mode !== 'move')) return;
    const s = this.start;
    if (p.x === s.x && p.y === s.y && p.angle === s.angle) return;
    this.commit(this.selected, { ...s }, time);
  }

  private cancelDrag(): void {
    const p = this.selectedPiece;
    const mode = this.mode;
    this.mode = 'none';
    if (!p || (mode !== 'rotate' && mode !== 'move')) return;
    p.x = this.start.x;
    p.y = this.start.y;
    p.angle = this.start.angle;
    this.dirty = true;
  }

  private apply(index: number, pose: Pose): void {
    const p = this.piece(index);
    if (!p) return;
    p.x = pose.x;
    p.y = pose.y;
    p.angle = pose.angle;
    if (isMedium(p) && p.trayable === true) p.stored = pose.stored;
    if (isDiffuser(p) && !Number.isNaN(pose.spread)) p.spread = pose.spread;
    this.selected = pose.stored ? -1 : index;
    this.dirty = true;
    this.hooks.onChange?.();
  }

  /** Distance from (x, y) to a piece on the board. */
  private distanceTo(p: Piece, x: number, y: number): number {
    if (isMedium(p)) {
      return pointPolygonDistance(
        x,
        y,
        rectCorners(p.x, p.y, p.width, p.height, p.angle, this.poly),
      );
    }
    const s = endpointsOf(p, this.seg);
    return pointSegmentDistance(x, y, s.ax, s.ay, s.bx, s.by);
  }

  /** Nearest selectable piece within the capture radius, or -1 (mirrors win ties over blocks). */
  private pick(x: number, y: number): number {
    const reach = this.hooks.captureRadius();
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < this.pieceCount; i++) {
      const p = this.piece(i)!;
      if (!isSelectable(p)) continue;
      const d = this.distanceTo(p, x, y);
      if (d <= reach && d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    }
    return best;
  }

  private onHandle(x: number, y: number): boolean {
    const p = this.selectedPiece;
    if (!p || !isRotatable(p)) return false;
    const a = (p.angle * Math.PI) / 180;
    const r = ringRadius(p);
    return (
      Math.hypot(x - (p.x + Math.cos(a) * r), y - (p.y + Math.sin(a) * r)) <=
      this.hooks.captureRadius()
    );
  }

  /** On the rotation ring band of the selected piece. */
  private onRing(x: number, y: number): boolean {
    const p = this.selectedPiece;
    if (!p || !isRotatable(p)) return false;
    const d = Math.hypot(x - p.x, y - p.y);
    return Math.abs(d - ringRadius(p)) <= this.hooks.captureRadius() * 0.75;
  }
}

function poseOf(p: Piece): Pose {
  return {
    x: p.x,
    y: p.y,
    angle: p.angle,
    stored: isMedium(p) && p.stored === true,
    spread: isDiffuser(p) ? p.spread : Number.NaN,
  };
}

function copyPose(p: Piece, out: Pose): void {
  out.x = p.x;
  out.y = p.y;
  out.angle = p.angle;
  out.stored = isMedium(p) && p.stored === true;
  out.spread = isDiffuser(p) ? p.spread : Number.NaN;
}

/** Angle of the pointer seen from the piece centre, in degrees. */
function pointerAngle(p: Piece, x: number, y: number): number {
  return (Math.atan2(y - p.y, x - p.x) * 180) / Math.PI;
}
