import type { GameCanvas } from './canvas';
import type { DemoState } from '../game/demo';
import {
  BACKGROUND,
  CYAN,
  FONT_FAMILY,
  TEXT as TITLE_COLOR,
  TEXT_MUTED as SUBTITLE_COLOR,
} from './theme';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport';

const GLOW_RADIUS = 28;

/** Draws the step-1 demo screen. Allocation-free after the first frame. */
export class DemoRenderer {
  private glow: CanvasGradient | null = null;

  constructor(private readonly gc: GameCanvas) {}

  draw(state: DemoState): void {
    const { ctx } = this.gc;

    this.gc.useDeviceSpace();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.gc.canvas.width, this.gc.canvas.height);

    this.gc.useLogicalSpace();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = `600 64px ${FONT_FAMILY}`;
    ctx.fillText('Lumen', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 12);
    ctx.fillStyle = SUBTITLE_COLOR;
    ctx.font = `400 15px ${FONT_FAMILY}`;
    ctx.fillText('Touchez ou survolez l’écran', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 40);

    if (state.alpha <= 0) return;
    const radius = state.pressed ? 9 : 6;
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.globalAlpha = state.alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.getGlow();
    ctx.fillRect(-GLOW_RADIUS, -GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Radial glow centred on the origin, created once and reused. */
  private getGlow(): CanvasGradient {
    if (!this.glow) {
      const g = this.gc.ctx.createRadialGradient(0, 0, 0, 0, 0, GLOW_RADIUS);
      g.addColorStop(0, 'rgba(143, 239, 255, 0.45)');
      g.addColorStop(0.4, 'rgba(143, 239, 255, 0.12)');
      g.addColorStop(1, 'rgba(143, 239, 255, 0)');
      this.glow = g;
    }
    return this.glow;
  }
}
