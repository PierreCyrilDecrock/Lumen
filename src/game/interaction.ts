import {
  endpointsOf,
  pointSegmentDistance,
  type Level,
  type Mirror,
  type SegmentCoords,
} from '../engine';
import { History } from './history';
import type { LogicalPointerEvent } from './input';
import { canPlaceMirror } from './placement';
import { snapAngle, snapToGrid } from './snap';

/** Pose of a piece, as stored in the history. */
export interface Pose {
  x: number;
  y: number;
  angle: number;
}

/** One undoable change of a mirror. */
export interface MirrorChange {
  index: number;
  from: Pose;
  to: Pose;
}

export type DragMode = 'none' | 'rotate' | 'move' | 'press';

export interface InteractionHooks {
  /** Pointer capture radius in logical units (44 CSS px wide zone). */
  captureRadius(): number;
  /** Called on each 15° notch during a pointer rotation (for vibration). */
  onAngleStep?(pointerType: string): void;
  /** Called when the selection, the history or a piece changes. */
  onChange?(): void;
  /** Called for each player move (not for undo / redo). */
  onCommit?(change: MirrorChange): void;
}

/** Gap between a mirror's end and its rotation ring. */
const RING_GAP = 16;

export const isRotatable = (m: Mirror): boolean => m.rotatable !== false;
export const isMovable = (m: Mirror): boolean => m.movable === true;
const isSelectable = (m: Mirror): boolean => isRotatable(m) || isMovable(m);

/** Radius of the rotation ring around a mirror. */
export function ringRadius(m: Mirror): number {
  return m.length / 2 + RING_GAP;
}

/**
 * Selection, rotation, movement and undo/redo of mirrors. DOM-free: it consumes
 * pointer events in logical units and mutates the level's mirrors in place.
 */
export class Interaction {
  selected = -1;
  mode: DragMode = 'none';
  /** True when the level changed and must be re-traced; the caller clears it. */
  dirty = true;
  /** Time (s) of the last drop or keyboard rotation, for the bounce effect. */
  dropTime = -Infinity;
  readonly history = new History<MirrorChange>();
  /** While true (pause, victory), the player can no longer change anything. */
  locked = false;

  private readonly start: Pose = { x: 0, y: 0, angle: 0 };
  private grabDx = 0;
  private grabDy = 0;
  private grabAngle = 0;
  private readonly seg: SegmentCoords = { ax: 0, ay: 0, bx: 0, by: 0 };

  constructor(
    readonly level: Level,
    private readonly hooks: InteractionHooks,
  ) {}

  get selectedMirror(): Mirror | null {
    return this.level.mirrors[this.selected] ?? null;
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
    const m = this.selectedMirror;
    if (!m || !isRotatable(m) || this.mode !== 'none' || this.locked) return false;
    const angle = snapAngle(m.angle + delta);
    if (!canPlaceMirror(this.level, this.selected, m.x, m.y, angle)) return false;
    const from = pose(m);
    m.angle = angle;
    const change = { index: this.selected, from, to: pose(m) };
    this.history.push(change);
    this.hooks.onCommit?.(change);
    this.dirty = true;
    this.dropTime = time;
    this.hooks.onChange?.();
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
    return isMovable(this.level.mirrors[index]!) ? 'grab' : 'pointer';
  }

  /** Position of the rotation handle of `m`, written into `out`. */
  handlePosition(m: Mirror, out: { x: number; y: number }): { x: number; y: number } {
    const a = (m.angle * Math.PI) / 180;
    const r = ringRadius(m);
    out.x = m.x + Math.cos(a) * r;
    out.y = m.y + Math.sin(a) * r;
    return out;
  }

  private onDown(x: number, y: number): void {
    if (this.mode !== 'none') return;
    const current = this.selectedMirror;
    if (current && isRotatable(current) && this.onHandle(x, y)) {
      this.beginRotate(current, x, y);
      return;
    }
    const index = this.pick(x, y);
    if (index >= 0) {
      const changed = index !== this.selected;
      this.selected = index;
      const m = this.level.mirrors[index]!;
      if (isMovable(m)) {
        this.copyStart(m);
        this.grabDx = x - m.x;
        this.grabDy = y - m.y;
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

  private beginRotate(m: Mirror, x: number, y: number): void {
    this.copyStart(m);
    this.grabAngle = m.angle - pointerAngle(m, x, y);
    this.mode = 'rotate';
  }

  private onDrag(x: number, y: number, pointerType: string): void {
    const m = this.selectedMirror;
    if (!m) return;
    if (this.mode === 'rotate') {
      const angle = snapAngle(pointerAngle(m, x, y) + this.grabAngle);
      if (angle === m.angle) return;
      if (!canPlaceMirror(this.level, this.selected, m.x, m.y, angle)) return;
      m.angle = angle;
      this.dirty = true;
      this.hooks.onAngleStep?.(pointerType);
    } else if (this.mode === 'move') {
      const nx = snapToGrid(x - this.grabDx);
      const ny = snapToGrid(y - this.grabDy);
      if (nx === m.x && ny === m.y) return;
      if (!canPlaceMirror(this.level, this.selected, nx, ny, m.angle)) return;
      m.x = nx;
      m.y = ny;
      this.dirty = true;
    }
  }

  private finishDrag(time: number): void {
    const m = this.selectedMirror;
    const mode = this.mode;
    this.mode = 'none';
    if (!m || (mode !== 'rotate' && mode !== 'move')) return;
    const s = this.start;
    if (m.x === s.x && m.y === s.y && m.angle === s.angle) return;
    const change = { index: this.selected, from: { ...s }, to: pose(m) };
    this.history.push(change);
    this.hooks.onCommit?.(change);
    this.dropTime = time;
    this.hooks.onChange?.();
  }

  private cancelDrag(): void {
    const m = this.selectedMirror;
    const mode = this.mode;
    this.mode = 'none';
    if (!m || (mode !== 'rotate' && mode !== 'move')) return;
    m.x = this.start.x;
    m.y = this.start.y;
    m.angle = this.start.angle;
    this.dirty = true;
  }

  private apply(index: number, p: Pose): void {
    const m = this.level.mirrors[index];
    if (!m) return;
    m.x = p.x;
    m.y = p.y;
    m.angle = p.angle;
    this.selected = index;
    this.dirty = true;
    this.hooks.onChange?.();
  }

  /** Nearest selectable mirror within the capture radius, or -1. */
  private pick(x: number, y: number): number {
    const reach = this.hooks.captureRadius();
    let best = -1;
    let bestDistance = Infinity;
    const mirrors = this.level.mirrors;
    for (let i = 0; i < mirrors.length; i++) {
      const m = mirrors[i]!;
      if (!isSelectable(m)) continue;
      const s = endpointsOf(m, this.seg);
      const d = pointSegmentDistance(x, y, s.ax, s.ay, s.bx, s.by);
      if (d <= reach && d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    }
    return best;
  }

  private onHandle(x: number, y: number): boolean {
    const m = this.selectedMirror;
    if (!m || !isRotatable(m)) return false;
    const a = (m.angle * Math.PI) / 180;
    const r = ringRadius(m);
    const hx = m.x + Math.cos(a) * r;
    const hy = m.y + Math.sin(a) * r;
    return Math.hypot(x - hx, y - hy) <= this.hooks.captureRadius();
  }

  /** On the rotation ring band of the selected mirror. */
  private onRing(x: number, y: number): boolean {
    const m = this.selectedMirror;
    if (!m || !isRotatable(m)) return false;
    const d = Math.hypot(x - m.x, y - m.y);
    return Math.abs(d - ringRadius(m)) <= this.hooks.captureRadius() * 0.75;
  }

  private copyStart(m: Mirror): void {
    this.start.x = m.x;
    this.start.y = m.y;
    this.start.angle = m.angle;
  }
}

function pose(m: Mirror): Pose {
  return { x: m.x, y: m.y, angle: m.angle };
}

/** Angle of the pointer seen from the mirror centre, in degrees. */
function pointerAngle(m: Mirror, x: number, y: number): number {
  return (Math.atan2(y - m.y, x - m.x) * 180) / Math.PI;
}
