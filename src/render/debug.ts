import type { FrameStats } from '../game/frame-stats';
import type { GameCanvas } from './canvas';
import { CYAN } from './theme';

/** Refresh rate of the overlay text, to keep it readable and allocation-light. */
const REFRESH_MS = 250;

/** Frame-time overlay, toggled with the D key. */
export class DebugOverlay {
  visible = false;
  private text = '';
  private nextRefresh = 0;

  draw(gc: GameCanvas, stats: FrameStats, now: number): void {
    if (!this.visible) return;
    if (now >= this.nextRefresh) {
      this.nextRefresh = now + REFRESH_MS;
      this.text =
        `${stats.averageWork.toFixed(2)} ms/frame (max ${stats.maxWork.toFixed(1)})` +
        ` · ${stats.fps.toFixed(0)} fps · dpr ${gc.viewport.dpr}`;
    }
    const ctx = gc.ctx;
    const dpr = gc.viewport.dpr;
    gc.useDeviceSpace();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${12 * dpr}px ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const pad = 6 * dpr;
    const width = ctx.measureText(this.text).width + pad * 2;
    ctx.fillStyle = 'rgba(2, 3, 10, 0.8)';
    ctx.fillRect(8 * dpr, 8 * dpr, width, 12 * dpr + pad * 2);
    ctx.fillStyle = CYAN;
    ctx.fillText(this.text, 8 * dpr + pad, 8 * dpr + pad);
  }

  /** Toggles on D (without modifiers), ignoring text fields. */
  bindKey(target: Window = window): void {
    target.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      const el = e.target;
      if (el instanceof HTMLInputElement && el.type === 'text') return;
      if (el instanceof HTMLTextAreaElement) return;
      this.visible = !this.visible;
    });
  }
}
