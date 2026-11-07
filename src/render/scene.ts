import type { Level, TraceResult } from '../engine';
import type { Settings } from '../game/settings';
import type { GameCanvas } from './canvas';
import { HaloLayer } from './halo';
import { drawEmitter, drawMirror, drawTarget, drawWall } from './pieces';
import { drawAngleLabel, drawHint, drawRotationRing, type SelectionView } from './selection';
import { makeGlowSprite, makeImpactSprite } from './sprites';
import { AMBER, BACKGROUND, BEAM_CORE_COLOR, BEAM_CORE_WIDTH } from './theme';

const COOL: readonly number[] = [170, 225, 255];
const WARM: readonly number[] = [255, 184, 77];
/** Seconds per target ring pulse. */
const PULSE_PERIOD = 2.2;

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

    gc.useLogicalSpace();
    for (const wall of level.walls) drawWall(ctx, wall);
    const sel = selection && selection.selected >= 0 ? selection : null;
    for (let i = 0; i < level.mirrors.length; i++) {
      const isSelected = sel !== null && sel.selected === i;
      drawMirror(ctx, level.mirrors[i]!, isSelected ? sel.bounce : 1, isSelected);
    }
    const hinted = selection && selection.hint >= 0 ? level.mirrors[selection.hint] : undefined;
    if (selection && hinted) drawHint(ctx, hinted, selection.hintAlpha);
    const selectedMirror = sel ? level.mirrors[sel.selected] : undefined;
    if (sel && selectedMirror && sel.rotatable) drawRotationRing(ctx, selectedMirror, sel);
    for (let i = 0; i < level.targets.length; i++) {
      drawTarget(ctx, level.targets[i]!, trace.targetsHit[i] === true);
    }

    this.drawLight(time);
    this.drawCore();
    gc.useLogicalSpace();
    for (const emitter of level.emitters) drawEmitter(ctx, emitter);
    if (sel && selectedMirror && sel.rotatable) {
      drawAngleLabel(ctx, selectedMirror, sel, trace.segments, level.width, level.height);
    }
  }

  private drawLight(time: number): void {
    const { gc, settings, trace, level } = this;
    if (!trace || !level) return;
    const ctx = gc.ctx;

    if (this.halo.update(gc, trace.segments, settings.beamIntensity)) {
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
        const target = impact.kind === 'target';
        const weak = impact.kind === 'wall' || impact.kind === 'mirrorBack';
        const s = weak ? size * 0.55 : size;
        ctx.globalAlpha = (weak ? 0.35 : 0.9) * k;
        ctx.drawImage(
          target ? this.impactWarm : this.impactCool,
          impact.x - 2 * s,
          impact.y - s,
          4 * s,
          2 * s,
        );
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

  /** Sharp, continuous white core: unaffected by any setting. */
  private drawCore(): void {
    const { trace, gc } = this;
    if (!trace || trace.segments.length === 0) return;
    const ctx = gc.ctx;
    gc.useLogicalSpace();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BEAM_CORE_WIDTH;
    ctx.strokeStyle = BEAM_CORE_COLOR;
    ctx.beginPath();
    const segments = trace.segments;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      const prev = i > 0 ? segments[i - 1]! : null;
      if (!prev || prev.x2 !== s.x1 || prev.y2 !== s.y1) ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
  }
}
