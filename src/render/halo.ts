import { CONE_FIELDS, SPECTRUM, type BeamSegment, type Medium, type TraceResult } from '../engine';
import type { GameCanvas } from './canvas';
import { CONE_LENGTH, HALO_AIR, MEDIUM_STYLE } from './theme';

const NO_MEDIA: readonly Medium[] = [];

/** Halo canvas resolution per quality level (it is blurred anyway). */
const HALO_SCALES = [0.5, 0.35, 0.25] as const;

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
  private media: readonly Medium[] = NO_MEDIA;
  /** 0 = full (blur filter, 5 passes), 1 = reduced (3 passes), 2 = minimal (2 passes). */
  private quality = 0;

  /** Quality used for the drawing in the cache. */
  private drawnQuality = -1;
  /** Quality to draw with now: never full while a piece is being dragged. */
  private effective = 0;

  private get scale(): number {
    return HALO_SCALES[this.effective] ?? 0.5;
  }

  /** Lowers or raises halo quality (automatic quality); forces a redraw. */
  setQuality(level: number): void {
    const q = Math.min(Math.max(Math.round(level), 0), HALO_SCALES.length - 1);
    if (q === this.quality) return;
    this.quality = q;
    this.dirty = true;
  }
  private trace: TraceResult | null = null;

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
  update(
    gc: GameCanvas,
    trace: TraceResult,
    intensity: number,
    media: readonly Medium[] = NO_MEDIA,
    interactive = false,
  ): boolean {
    const segments = trace.segments;
    if (intensity <= 0 || segments.length === 0) return false;
    this.trace = trace;
    // While dragging, the trace changes every frame: use the fast path, then
    // redraw once at full quality when the piece is let go.
    this.effective = interactive ? Math.max(this.quality, 1) : this.quality;
    if (this.effective !== this.drawnQuality) this.dirty = true;
    const width = Math.max(Math.ceil(gc.canvas.width * this.scale), 1);
    const height = Math.max(Math.ceil(gc.canvas.height * this.scale), 1);
    if (
      this.dirty ||
      intensity !== this.lastIntensity ||
      width !== this.lastWidth ||
      height !== this.lastHeight
    ) {
      this.media = media;
      this.redraw(gc, segments, intensity, width, height);
      this.dirty = false;
      this.drawnQuality = this.effective;
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
    const scale = this.scale;
    const s = v.dpr * v.scale * scale;
    ctx.setTransform(s, 0, 0, s, v.dpr * v.offsetX * scale, v.dpr * v.offsetY * scale);
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
    // Fewer, wider passes and no blur filter at lower quality.
    const used =
      this.effective === 0
        ? passes
        : this.effective === 1
          ? [passes[0]!, passes[2]!, passes[3]!]
          : [passes[0]!, passes[3]!];
    const blur = this.supportsFilter && this.effective === 0;
    for (const pass of used) {
      ctx.lineWidth = pass.width;
      if (blur) ctx.filter = `blur(${(pass.blur * s).toFixed(2)}px)`;
      this.strokeRuns(segments, pass.alpha);
    }
    ctx.filter = 'none';
    this.drawCones(k);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Diffusion fans: soft gradient volumes under the thin rays. */
  private drawCones(k: number): void {
    const trace = this.trace;
    if (!trace || trace.coneCount === 0) return;
    const ctx = this.ctx;
    const c = trace.cones;
    for (let i = 0; i < trace.coneCount; i++) {
      const o = i * CONE_FIELDS;
      const x = c[o]!;
      const y = c[o + 1]!;
      const axis = c[o + 2]!;
      const spread = c[o + 3]!;
      const intensity = c[o + 4]!;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, CONE_LENGTH);
      const a = 0.22 * k * intensity;
      gradient.addColorStop(
        0,
        `rgba(${HALO_AIR[0]}, ${HALO_AIR[1]}, ${HALO_AIR[2]}, ${a.toFixed(3)})`,
      );
      gradient.addColorStop(1, `rgba(${HALO_AIR[0]}, ${HALO_AIR[1]}, ${HALO_AIR[2]}, 0)`);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, CONE_LENGTH, axis - spread / 2, axis + spread / 2);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
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
        if (
          s.r !== first.r ||
          s.g !== first.g ||
          s.b !== first.b ||
          s.medium !== first.medium ||
          s.band !== first.band ||
          s.intensity !== first.intensity
        ) {
          break;
        }
        const prev = segments[j - 1];
        if (j > i && prev && (prev.x2 !== s.x1 || prev.y2 !== s.y1)) ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.strokeStyle = haloColor(first, alpha * first.intensity, this.media);
      ctx.stroke();
      i = j;
    }
  }
}

/**
 * White light gets a cool tint in air and the tint of the medium it crosses
 * (water cyan, glass lavender, diamond pink); coloured light keeps its colour.
 */
function haloColor(s: BeamSegment, alpha: number, media: readonly Medium[]): string {
  const white = s.band < 0;
  const medium = s.medium >= 0 ? media[s.medium] : undefined;
  const tint = medium ? MEDIUM_STYLE[medium.material].halo : HALO_AIR;
  const band = white ? null : hexToRgb(SPECTRUM[s.band]!.hex);
  const r = band ? band[0] : tint[0];
  const g = band ? band[1] : tint[1];
  const b = band ? band[2] : tint[2];
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/** "#RRGGBB" to [r, g, b] in 0-255. */
export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
