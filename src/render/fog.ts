import type { Fog } from '../engine';

const NOISE_SIZE = 96;

/**
 * Fog texture: smooth value noise generated once on an offscreen canvas and
 * used as a repeating pattern. Never animated.
 */
export class FogPainter {
  private pattern: CanvasPattern | null = null;

  draw(ctx: CanvasRenderingContext2D, fog: Fog): void {
    const pattern = this.getPattern(ctx);
    ctx.save();
    ctx.translate(fog.x, fog.y);
    ctx.rotate((fog.angle * Math.PI) / 180);
    ctx.beginPath();
    ctx.roundRect(-fog.width / 2, -fog.height / 2, fog.width, fog.height, 14);
    ctx.fillStyle = 'rgba(140, 150, 180, 0.07)';
    ctx.fill();
    if (pattern) {
      ctx.globalAlpha = Math.min(0.75, 0.25 + fog.density * 18);
      ctx.fillStyle = pattern;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private getPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.pattern) return this.pattern;
    const canvas = document.createElement('canvas');
    canvas.width = NOISE_SIZE;
    canvas.height = NOISE_SIZE;
    const c = canvas.getContext('2d');
    if (!c) return null;
    // Value noise: a coarse random grid, bilinearly interpolated, two octaves.
    const image = c.createImageData(NOISE_SIZE, NOISE_SIZE);
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const octave = (cells: number): Float32Array => {
      const grid = new Float32Array(cells * cells);
      for (let i = 0; i < grid.length; i++) grid[i] = random();
      const out = new Float32Array(NOISE_SIZE * NOISE_SIZE);
      for (let y = 0; y < NOISE_SIZE; y++) {
        for (let x = 0; x < NOISE_SIZE; x++) {
          const gx = (x / NOISE_SIZE) * cells;
          const gy = (y / NOISE_SIZE) * cells;
          const x0 = Math.floor(gx);
          const y0 = Math.floor(gy);
          const fx = gx - x0;
          const fy = gy - y0;
          const sx = fx * fx * (3 - 2 * fx);
          const sy = fy * fy * (3 - 2 * fy);
          const v = (i: number, j: number): number => grid[(j % cells) * cells + (i % cells)]!;
          const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
          const bottom = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
          out[y * NOISE_SIZE + x] = top + (bottom - top) * sy;
        }
      }
      return out;
    };
    const a = octave(6);
    const b = octave(12);
    for (let i = 0; i < NOISE_SIZE * NOISE_SIZE; i++) {
      const n = a[i]! * 0.65 + b[i]! * 0.35;
      image.data[i * 4] = 175;
      image.data[i * 4 + 1] = 185;
      image.data[i * 4 + 2] = 210;
      image.data[i * 4 + 3] = Math.round(Math.max(0, n - 0.3) * 255 * 0.55);
    }
    c.putImageData(image, 0, 0);
    this.pattern = ctx.createPattern(canvas, 'repeat');
    return this.pattern;
  }
}
