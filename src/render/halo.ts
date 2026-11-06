import type { BeamSegment } from '../engine';
import type { GameCanvas } from './canvas';
import { HALO_AIR } from './theme';

/** The halo canvas is half the resolution of the screen: it is blurred anyway. */
const HALO_SCALE = 0.5;

/** Stroke passes of one halo (wide or medium), from outer to inner. */
interface HaloPass {
  width: number;
  alpha: number;
  blur: number;
}

/**
 * Beam halos (wide and medium) on an offscreen canvas. Redrawn only when the
 * trace, the beam intensity or the screen size change; composited every frame.
 */
export class HaloLayer {
  readonly canvas: HTMLCanvasElement = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly supportsFilter: boolean;
  private dirty = true;
  private lastIntensity = -1;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponible');
    this.ctx = ctx;
    ctx.filter = 'blur(1px)';
    this.supportsFilter = ctx.filter === 'blur(1px)';
    ctx.filter = 'none';
  }

  /** Call when the trace changed. */
  invalidate(): void {
    this.dirty = true;
  }

  /** Brings the cache up to date. Returns false when there is nothing to show. */
  update(gc: GameCanvas, segments: readonly BeamSegment[], intensity: number): boolean {
    if (intensity <= 0 || segments.length === 0) return false;
    const width = Math.max(Math.ceil(gc.canvas.width * HALO_SCALE), 1);
    const height = Math.max(Math.ceil(gc.canvas.height * HALO_SCALE), 1);
    if (
      this.dirty ||
      intensity !== this.lastIntensity ||
      width !== this.lastWidth ||
      height !== this.lastHeight
    ) {
      this.redraw(gc, segments, intensity, width, height);
      this.dirty = false;
      this.lastIntensity = intensity;
      this.lastWidth = width;
      this.lastHeight = height;
    }
    return true;
  }

  private redraw(
    gc: GameCanvas,
    segments: readonly BeamSegment[],
    k: number,
    width: number,
    height: number,
  ): void {
    const { canvas, ctx } = this;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const v = gc.viewport;
    const s = v.dpr * v.scale * HALO_SCALE;
    ctx.setTransform(s, 0, 0, s, v.dpr * v.offsetX * HALO_SCALE, v.dpr * v.offsetY * HALO_SCALE);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Wide halo: three soft passes; medium halo: two tighter passes.
    const wide = 12 + 16 * k;
    const medium = 5 + 4 * k;
    const passes: HaloPass[] = [
      { width: wide, alpha: 0.075 * k, blur: 5 + 5 * k },
      { width: wide * 0.65, alpha: 0.075 * k, blur: 4 + 3 * k },
      { width: wide * 0.35, alpha: 0.075 * k, blur: 3 + 2 * k },
      { width: medium, alpha: 0.2 * k, blur: 1.5 + 1.5 * k },
      { width: medium * 0.55, alpha: 0.2 * k, blur: 1 + k },
    ];
    for (const pass of passes) {
      ctx.lineWidth = pass.width;
      if (this.supportsFilter) ctx.filter = `blur(${(pass.blur * s).toFixed(2)}px)`;
      this.strokeRuns(segments, pass.alpha);
    }
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Strokes each contiguous run of same-coloured segments as one polyline. */
  private strokeRuns(segments: readonly BeamSegment[], alpha: number): void {
    const ctx = this.ctx;
    let i = 0;
    while (i < segments.length) {
      const first = segments[i]!;
      ctx.beginPath();
      ctx.moveTo(first.x1, first.y1);
      let j = i;
      for (; j < segments.length; j++) {
        const s = segments[j]!;
        if (s.r !== first.r || s.g !== first.g || s.b !== first.b) break;
        const prev = segments[j - 1];
        if (j > i && prev && (prev.x2 !== s.x1 || prev.y2 !== s.y1)) ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.strokeStyle = haloColor(first, alpha);
      ctx.stroke();
      i = j;
    }
  }
}

/** White light gets a cool tint in air; coloured light keeps its colour. */
function haloColor(s: BeamSegment, alpha: number): string {
  const white = s.r === 1 && s.g === 1 && s.b === 1;
  const r = white ? HALO_AIR[0] : Math.round(s.r * 255);
  const g = white ? HALO_AIR[1] : Math.round(s.g * 255);
  const b = white ? HALO_AIR[2] : Math.round(s.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
