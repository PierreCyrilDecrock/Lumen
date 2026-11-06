import type { LogicalPointerEvent } from './input';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/viewport';

/** Fade speed of the pointer dot, in opacity units per second. */
const FADE_SPEED = 8;

/** State of the step-1 demo screen: a dot that follows the pointer. */
export class DemoState {
  x = LOGICAL_WIDTH / 2;
  y = LOGICAL_HEIGHT / 2;
  pressed = false;
  /** Dot opacity, 0 to 1. */
  alpha = 0;
  reducedMotion = false;
  private visible = false;

  handlePointer(e: LogicalPointerEvent): void {
    this.x = clamp(e.x, 0, LOGICAL_WIDTH);
    this.y = clamp(e.y, 0, LOGICAL_HEIGHT);
    switch (e.phase) {
      case 'down':
        this.pressed = true;
        this.visible = true;
        break;
      case 'move':
      case 'hover':
        this.visible = true;
        break;
      case 'up':
      case 'cancel':
        this.pressed = false;
        // A finger lifted leaves nothing behind; a mouse keeps hovering.
        this.visible = e.pointerType === 'mouse';
        break;
    }
  }

  update(dt: number): void {
    const goal = this.visible ? 1 : 0;
    if (this.reducedMotion) {
      this.alpha = goal;
      return;
    }
    const step = FADE_SPEED * dt;
    this.alpha =
      goal > this.alpha ? Math.min(goal, this.alpha + step) : Math.max(goal, this.alpha - step);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
