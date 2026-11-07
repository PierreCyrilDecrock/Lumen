import type { Level, Medium, TraceResult } from '../engine';
import { TARGET_THRESHOLD } from '../engine';
import type { Settings } from '../game/settings';
import type { GameCanvas } from './canvas';
import { HaloLayer } from './halo';
import { FogPainter } from './fog';
import {
  drawCrystal,
  drawDiffuser,
  drawEmitter,
  drawMedium,
  drawMirror,
  drawTarget,
  drawWall,
} from './pieces';
import {
  drawAngleLabel,
  drawHint,
  drawRotationRing,
  type Placed,
  type SelectionView,
} from './selection';
import { makeGlowSprite, makeImpactSprite } from './sprites';
import { AMBER, BACKGROUND, BEAM_CORE_COLOR, BEAM_CORE_WIDTH, NORMAL_COLOR } from './theme';

const COOL: readonly number[] = [170, 225, 255];
const WARM: readonly number[] = [255, 184, 77];
const ICE: readonly number[] = [200, 245, 255];
/** Seconds per target ring pulse. */
const PULSE_PERIOD = 2.2;
/** Faint rays (partial reflections) are thin lines. */
const WEAK_WIDTH = 1.2;
const WEAK_ALPHA = 0.55;
/** Half length of the normals drawn at interfaces. */
const NORMAL_HALF = 14;
const NO_MEDIA: readonly Medium[] = [];

/**
 * Draws a level and its trace in four passes: background, pieces, additive light
 * (halos, impacts, target glow), then the sharp beam core on top.
 */
export class SceneRenderer {
  private level: Level | null = null;
  private trace: TraceResult | null = null;
  private readonly halo = new HaloLayer();
  private readonly impactCool = makeImpactSprite(COOL);
  private readonly impactWarm = makeImpactSprite(WARM);
  private readonly glowWarm = makeGlowSprite(WARM);
  private readonly glowIce = makeGlowSprite(ICE);
  private readonly fog = new FogPainter();

  constructor(
    private readonly gc: GameCanvas,
    private readonly settings: Settings,
  ) {}

  setScene(level: Level, trace: TraceResult): void {
    this.level = level;
    this.trace = trace;
    this.halo.invalidate();
  }

  /** Call after re-tracing into the same TraceResult. */
  traceChanged(): void {
    this.halo.invalidate();
  }

  /**
   * @param time Seconds since start, drives the target pulse.
   * @param selection Player selection to overlay, if any.
   */
  draw(time: number, selection?: SelectionView): void {
    const { gc } = this;
    const ctx = gc.ctx;
    gc.useDeviceSpace();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, gc.canvas.width, gc.canvas.height);

    const { level, trace } = this;
    if (!level || !trace) return;
    const media = level.media ?? NO_MEDIA;
    const mirrorCount = level.mirrors.length;
    const sel = selection && selection.selected >= 0 ? selection : null;
    const selectedPiece: Placed | undefined = sel ? pieceAt(level, sel.selected) : undefined;

    gc.useLogicalSpace();
    for (const f of level.fogs ?? []) this.fog.draw(ctx, f);
    for (let i = 0; i < media.length; i++) {
      const isSelected = sel !== null && sel.selected === mirrorCount + i;
      drawMedium(ctx, media[i]!, isSelected ? sel.bounce : 1, isSelected);
    }
    for (const wall of level.walls) drawWall(ctx, wall);
    for (let i = 0; i < mirrorCount; i++) {
      const isSelected = sel !== null && sel.selected === i;
      drawMirror(ctx, level.mirrors[i]!, isSelected ? sel.bounce : 1, isSelected);
    }
    const diffusers = level.diffusers ?? [];
    const diffuserOffset = mirrorCount + media.length;
    for (let i = 0; i < diffusers.length; i++) {
      const isSelected = sel !== null && sel.selected === diffuserOffset + i;
      drawDiffuser(ctx, diffusers[i]!, isSelected ? sel.bounce : 1, isSelected);
    }
    for (let i = 0; i < level.targets.length; i++) {
      drawTarget(ctx, level.targets[i]!, trace.targetsHit[i] === true);
    }
    const crystals = level.crystals ?? [];
    for (let i = 0; i < crystals.length; i++) {
      drawCrystal(ctx, crystals[i]!, trace.crystalProgress[i] ?? 0);
    }
    this.drawNormals();
    const hinted = selection && selection.hint >= 0 ? pieceAt(level, selection.hint) : undefined;
    if (selection && hinted) drawHint(ctx, hinted, hintRadius(hinted), selection.hintAlpha);
    if (sel && selectedPiece && sel.rotatable) drawRotationRing(ctx, selectedPiece, sel);

    this.drawLight(time, media);
    this.drawCore();
    gc.useLogicalSpace();
    for (const emitter of level.emitters) drawEmitter(ctx, emitter);
    if (sel && selectedPiece && sel.rotatable) {
      drawAngleLabel(ctx, selectedPiece, sel, trace.segments, level.width, level.height);
    }
  }

  /** Thin solid normals where main rays cross an interface. */
  private drawNormals(): void {
    const trace = this.trace;
    if (!trace) return;
    const ctx = this.gc.ctx;
    let any = false;
    ctx.beginPath();
    for (const im of trace.impacts) {
      if (
        (im.kind !== 'interface' && im.kind !== 'totalReflection') ||
        im.intensity < TARGET_THRESHOLD
      )
        continue;
      ctx.moveTo(im.x - im.nx * NORMAL_HALF, im.y - im.ny * NORMAL_HALF);
      ctx.lineTo(im.x + im.nx * NORMAL_HALF, im.y + im.ny * NORMAL_HALF);
      any = true;
    }
    if (!any) return;
    ctx.strokeStyle = NORMAL_COLOR;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  private drawLight(time: number, media: readonly Medium[]): void {
    const { gc, settings, trace, level } = this;
    if (!trace || !level) return;
    const ctx = gc.ctx;

    if (this.halo.update(gc, trace, settings.beamIntensity, media)) {
      gc.useDeviceSpace();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.halo.canvas, 0, 0, gc.canvas.width, gc.canvas.height);
    }

    const k = settings.impactIntensity;
    gc.useLogicalSpace();
    ctx.globalCompositeOperation = 'lighter';
    if (k > 0) {
      const size = 7 + 11 * k;
      for (const impact of trace.impacts) {
        if (impact.intensity < TARGET_THRESHOLD) continue;
        const target = impact.kind === 'target';
        const weak =
          impact.kind === 'wall' || impact.kind === 'mirrorBack' || impact.kind === 'interface';
        const s = weak ? size * 0.6 : size;
        ctx.globalAlpha = (impact.kind === 'interface' ? 0.6 : weak ? 0.35 : 0.9) * k;
        ctx.drawImage(
          target ? this.impactWarm : this.impactCool,
          impact.x - 2 * s,
          impact.y - s,
          4 * s,
          2 * s,
        );
      }
    }

    // Crystals glow with the light they gather, fully once lit.
    const crystals = level.crystals ?? [];
    if (k > 0) {
      for (let i = 0; i < crystals.length; i++) {
        const progress = trace.crystalProgress[i] ?? 0;
        if (progress <= 0) continue;
        const c = crystals[i]!;
        const s = c.radius * (progress >= 1 ? 2.4 + 1.4 * k : 1.6);
        ctx.globalAlpha = (progress >= 1 ? 0.55 + 0.45 * k : 0.35 * progress) * k;
        ctx.drawImage(this.glowIce, c.x - s, c.y - s, 2 * s, 2 * s);
      }
    }

    // Lit targets glow; every target has a slow pulsing ring unless motion is reduced.
    const phase = (time / PULSE_PERIOD) % 1;
    for (let i = 0; i < level.targets.length; i++) {
      const t = level.targets[i]!;
      const lit = trace.targetsHit[i] === true;
      if (lit && k > 0) {
        const s = t.radius * (2.2 + 1.3 * k);
        ctx.globalAlpha = 0.5 + 0.5 * k;
        ctx.drawImage(this.glowWarm, t.x - s, t.y - s, 2 * s, 2 * s);
      }
      if (!settings.reducedMotion && k > 0) {
        const fade = (1 - phase) * (1 - phase);
        ctx.globalAlpha = fade * (lit ? 0.75 : 0.35) * k;
        ctx.strokeStyle = AMBER;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius + 2 + 12 * phase, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Sharp, continuous white core of the main rays, unaffected by any setting;
   * faint rays (partial reflections) are thin, dim lines.
   */
  private drawCore(): void {
    const { trace, gc } = this;
    if (!trace || trace.segments.length === 0) return;
    const ctx = gc.ctx;
    gc.useLogicalSpace();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = BEAM_CORE_COLOR;
    for (let pass = 0; pass < 2; pass++) {
      const strong = pass === 1;
      ctx.globalAlpha = strong ? 1 : WEAK_ALPHA;
      ctx.lineWidth = strong ? BEAM_CORE_WIDTH : WEAK_WIDTH;
      ctx.beginPath();
      const segments = trace.segments;
      let prev = null;
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]!;
        if (s.intensity >= TARGET_THRESHOLD !== strong) {
          prev = null;
          continue;
        }
        if (!prev || prev.x2 !== s.x1 || prev.y2 !== s.y1) ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        prev = s;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Piece at a unified index: mirrors, then media, then diffusers. */
function pieceAt(level: Level, index: number): Placed | undefined {
  const m = level.mirrors.length;
  const n = level.media?.length ?? 0;
  if (index < m) return level.mirrors[index];
  if (index < m + n) return level.media?.[index - m];
  return level.diffusers?.[index - m - n];
}

function hintRadius(p: Placed): number {
  if ('width' in p && 'height' in p)
    return Math.hypot(p.width as number, p.height as number) / 2 + 6;
  return ('length' in p ? (p.length as number) : 40) / 2 + 10;
}
