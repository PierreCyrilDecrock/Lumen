import type { Level, Medium, TraceResult } from '../engine';
import { SPECTRUM, TARGET_THRESHOLD } from '../engine';
import type { Settings } from '../game/settings';
import type { GameCanvas } from './canvas';
import { HaloLayer } from './halo';
import { FogPainter } from './fog';
import {
  drawColorTarget,
  drawCrystal,
  drawDiffuser,
  drawFilter,
  drawPrism,
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
    this.refreshColorCss();
  }

  /** True while a piece is being dragged: halos use their fast path. */
  interactive = false;

  /** Halo quality: 0 = full, 1 = reduced, 2 = minimal (automatic quality). */
  setHaloQuality(level: number): void {
    this.halo.setQuality(level);
  }

  /** Call after re-tracing into the same TraceResult. */
  traceChanged(): void {
    this.halo.invalidate();
    this.refreshColorCss();
  }

  /** CSS colour received by each colour target, computed once per trace. */
  private colorCss: (string | null)[] = [];

  private refreshColorCss(): void {
    const trace = this.trace;
    const count = this.level?.colorTargets?.length ?? 0;
    this.colorCss.length = count;
    if (!trace) return;
    for (let i = 0; i < count; i++) {
      const r = trace.colorLight[i * 3] ?? 0;
      const g = trace.colorLight[i * 3 + 1] ?? 0;
      const b = trace.colorLight[i * 3 + 2] ?? 0;
      const max = Math.max(r, g, b);
      this.colorCss[i] =
        max > 0
          ? `rgb(${Math.round((r / max) * 255)}, ${Math.round((g / max) * 255)}, ${Math.round((b / max) * 255)})`
          : null;
    }
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
    const prisms = level.prisms ?? [];
    const prismOffset = mirrorCount + media.length + (level.diffusers?.length ?? 0);
    for (let i = 0; i < prisms.length; i++) {
      const isSelected = sel !== null && sel.selected === prismOffset + i;
      drawPrism(ctx, prisms[i]!, isSelected ? sel.bounce : 1, isSelected);
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
    const filters = level.filters ?? [];
    const filterOffset = prismOffset + prisms.length;
    for (let i = 0; i < filters.length; i++) {
      const isSelected = sel !== null && sel.selected === filterOffset + i;
      const symbols = this.settings.colorSymbols;
      drawFilter(ctx, filters[i]!, isSelected ? sel.bounce : 1, isSelected, symbols);
    }
    for (let i = 0; i < level.targets.length; i++) {
      drawTarget(ctx, level.targets[i]!, trace.targetsHit[i] === true);
    }
    const colorTargets = level.colorTargets ?? [];
    for (let i = 0; i < colorTargets.length; i++) {
      const lit = trace.colorTargetsLit[i] === true;
      const css = this.colorCss[i] ?? null;
      drawColorTarget(ctx, colorTargets[i]!, lit, css, this.settings.colorSymbols);
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
      const crossing =
        im.kind === 'interface' || im.kind === 'totalReflection' || im.kind === 'prism';
      if (!crossing || im.intensity < TARGET_THRESHOLD) continue;
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

    if (this.halo.update(gc, trace, settings.beamIntensity, media, this.interactive)) {
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
   * Sharp, continuous core of the main rays, unaffected by any setting: white
   * for white light, the band colour for coloured rays (added with 'lighter' so
   * crossing colours mix). Faint rays (partial reflections, fans) are thin lines.
   */
  private drawCore(): void {
    const { trace, gc } = this;
    if (!trace || trace.segments.length === 0) return;
    const ctx = gc.ctx;
    gc.useLogicalSpace();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Faint rays first, then strong coloured rays, then strong white rays.
    for (let band = -1; band < SPECTRUM.length; band++) this.strokeBand(band, false);
    for (let band = 0; band < SPECTRUM.length; band++) this.strokeBand(band, true);
    this.strokeBand(-1, true);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** One stroke for all the strong (or faint) segments of a band. */
  private strokeBand(band: number, strong: boolean): void {
    const trace = this.trace!;
    const ctx = this.gc.ctx;
    const segments = trace.segments;
    let any = false;
    let prev = null;
    ctx.beginPath();
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      if (s.band !== band || s.intensity >= TARGET_THRESHOLD !== strong) {
        prev = null;
        continue;
      }
      if (!prev || prev.x2 !== s.x1 || prev.y2 !== s.y1) ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      prev = s;
      any = true;
    }
    if (!any) return;
    ctx.strokeStyle = band < 0 ? BEAM_CORE_COLOR : SPECTRUM[band]!.hex;
    ctx.globalCompositeOperation = band < 0 ? 'source-over' : 'lighter';
    ctx.globalAlpha = strong ? 1 : WEAK_ALPHA;
    ctx.lineWidth = strong ? BEAM_CORE_WIDTH : WEAK_WIDTH;
    ctx.stroke();
  }
}

/** Piece at a unified index: mirrors, media, diffusers, prisms, then filters. */
function pieceAt(level: Level, index: number): Placed | undefined {
  const groups: readonly (readonly Placed[] | undefined)[] = [
    level.mirrors,
    level.media,
    level.diffusers,
    level.prisms,
    level.filters,
  ];
  let i = index;
  for (const group of groups) {
    const n = group?.length ?? 0;
    if (i < n) return group?.[i];
    i -= n;
  }
  return undefined;
}

function hintRadius(p: Placed): number {
  if ('size' in p) return (p.size as number) / Math.sqrt(3) + 8;
  if ('width' in p && 'height' in p)
    return Math.hypot(p.width as number, p.height as number) / 2 + 6;
  return ('length' in p ? (p.length as number) : 40) / 2 + 10;
}
