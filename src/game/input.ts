import type { GameCanvas } from '../render/canvas';
import { cssToLogicalX, cssToLogicalY } from '../render/viewport';

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel' | 'hover';

/**
 * Pointer event in logical board units. A single instance is reused for every
 * event: listeners must copy what they need instead of keeping a reference.
 */
export interface LogicalPointerEvent {
  phase: PointerPhase;
  x: number;
  y: number;
  pointerType: string;
}

export type PointerListener = (e: LogicalPointerEvent) => void;

/**
 * Pointer Events layer (finger, mouse, pen) converted to logical coordinates.
 * Only one pointer is active at a time; other simultaneous pointers are ignored.
 * Mouse movement without a pressed button is reported as 'hover'.
 */
export class InputLayer {
  private activeId: number | null = null;
  private readonly listeners: PointerListener[] = [];
  private readonly event: LogicalPointerEvent = { phase: 'hover', x: 0, y: 0, pointerType: '' };

  constructor(private readonly target: GameCanvas) {
    const el = target.canvas;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('lostpointercapture', this.onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** True while the active pointer is pressed. */
  get isPressed(): boolean {
    return this.activeId !== null;
  }

  on(listener: PointerListener): void {
    this.listeners.push(listener);
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.activeId !== null || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.target.canvas.setPointerCapture(e.pointerId);
    this.emit('down', e);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.activeId) this.emit('move', e);
    else if (this.activeId === null && e.pointerType === 'mouse') this.emit('hover', e);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.release(e);
    this.emit('up', e);
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.release(e);
    this.emit('cancel', e);
  };

  private release(e: PointerEvent): void {
    this.activeId = null;
    const el = this.target.canvas;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  private emit(phase: PointerPhase, e: PointerEvent): void {
    const v = this.target.viewport;
    const ev = this.event;
    ev.phase = phase;
    ev.x = cssToLogicalX(v, this.target.clientToCssX(e.clientX));
    ev.y = cssToLogicalY(v, this.target.clientToCssY(e.clientY));
    ev.pointerType = e.pointerType;
    for (const listener of this.listeners) listener(ev);
  }
}
