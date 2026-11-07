import { MATERIALS, TraceResult, traceRays, type Impact, type Level } from './engine';
import { FrameStats } from './game/frame-stats';
import { InputLayer } from './game/input';
import {
  Interaction,
  armStart,
  isMedium,
  isRotatable,
  ringRadius,
  rotationPeriod,
  type PieceChange,
} from './game/interaction';
import { GameLoop } from './game/loop';
import { nextHint, rotationSteps, starsFor, type HintKind } from './game/rules';
import type { Settings } from './game/settings';
import { displayAngle } from './game/snap';
import { toEngineLevel, type LevelDefinition } from './levels/schema';
import { GameCanvas } from './render/canvas';
import { DebugOverlay } from './render/debug';
import { SceneRenderer } from './render/scene';
import { createSelectionView } from './render/selection';

/** Touch targets are at least 44 CSS px wide: 22 px around the piece. */
const CAPTURE_CSS_PX = 22;
/** Drop bounce: duration (s) and amplitude. */
const BOUNCE_DURATION = 0.24;
const BOUNCE_AMPLITUDE = 0.08;
/** Delay between the last target lighting up and the victory screen (s). */
const WIN_DELAY = 0.7;
/** How long a hint stays highlighted (s). */
const HINT_DURATION = 4;

export interface GameViewHooks {
  /** Selection, history, rotation count or hint changed. */
  onChange?(): void;
  /** Every target is lit (after a short pause to enjoy it). */
  onWin?(): void;
  /** A 15° notch was crossed while dragging (sound, vibration). */
  onAngleStep?(pointerType: string): void;
  /** A piece was put down or turned. */
  onCommit?(): void;
  /** The light paths were re-traced. */
  onTrace?(): void;
}

/**
 * The playing board: one canvas reused across levels, with input, interaction,
 * tracing (at most once per frame), rendering, rotation count, victory and hints.
 */
export class GameView {
  readonly gc: GameCanvas;
  readonly trace = new TraceResult();
  readonly stats = new FrameStats();
  interaction: Interaction | null = null;
  definition: LevelDefinition | null = null;
  level: Level | null = null;
  rotations = 0;
  won = false;
  time = 0;
  /** Unified index of the hinted piece, or -1. */
  hint = -1;

  private readonly scene: SceneRenderer;
  private readonly loop: GameLoop;
  private readonly debug = new DebugOverlay();
  private readonly view = createSelectionView();
  private labelAngle = Number.NaN;
  private winAt = Infinity;
  private hintUntil = 0;
  private cursor = '';

  constructor(
    canvas: HTMLCanvasElement,
    private readonly settings: Settings,
    private readonly hooks: GameViewHooks = {},
  ) {
    this.gc = new GameCanvas(canvas);
    this.scene = new SceneRenderer(this.gc, settings);
    new InputLayer(this.gc).on((e) => {
      const interaction = this.interaction;
      if (!interaction) return;
      interaction.handlePointer(e, this.time);
      if (e.pointerType !== 'mouse') return;
      const next = interaction.locked ? 'default' : interaction.cursorAt(e.x, e.y);
      if (next !== this.cursor) {
        this.cursor = next;
        canvas.style.cursor = next;
      }
    });
    this.debug.bindKey();
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
  }

  /** Loads a level definition (or a raw engine level, for demos) and resets the game state. */
  load(source: LevelDefinition | Level): void {
    const isDefinition = 'solution' in source;
    this.definition = isDefinition ? source : null;
    this.level = isDefinition ? toEngineLevel(source) : source;
    this.rotations = 0;
    this.won = false;
    this.winAt = Infinity;
    this.hint = -1;
    this.labelAngle = Number.NaN;
    this.interaction = new Interaction(this.level, {
      captureRadius: () => Math.max(CAPTURE_CSS_PX / this.gc.viewport.scale, 10),
      onAngleStep: (type) => this.hooks.onAngleStep?.(type),
      onChange: () => this.hooks.onChange?.(),
      onCommit: (change) => this.countMove(change),
    });
    this.scene.setScene(this.level, this.trace);
    this.hooks.onChange?.();
  }

  restart(): void {
    if (this.definition) this.load(this.definition);
  }

  /** Stars the current rotation count is worth. */
  get stars(): 1 | 2 | 3 {
    return this.definition ? starsFor(this.rotations, this.definition.stars) : 3;
  }

  /** Highlights the next piece of the reference solution. Returns what to do with it. */
  showHint(): HintKind | null {
    const { definition, level, interaction } = this;
    if (!definition || !level || !interaction || this.won) return null;
    const hint = nextHint(definition, level);
    if (!hint) return null;
    this.hint = interaction.indexOf(hint.id);
    this.hintUntil = this.time + HINT_DURATION;
    this.hooks.onChange?.();
    return hint.kind;
  }

  /**
   * Entry and exit angles of the main ray through one block: the selected one,
   * else the first one it crosses. Empty when there is no block in play.
   */
  opticsSummary(): string {
    const { interaction, level } = this;
    const media = level?.media;
    if (!interaction || !media || media.length === 0) return '';
    const selected = interaction.selectedPiece;
    let index = selected && isMedium(selected) ? media.indexOf(selected) : -1;
    const impacts = this.trace.impacts;
    const isMain = (i: Impact): boolean =>
      i.intensity >= 1 && (i.kind === 'interface' || i.kind === 'totalReflection');
    if (index < 0) index = impacts.find(isMain)?.piece ?? -1;
    const block = media[index];
    if (!block) return 'La lumière ne traverse aucun bloc.';
    const parts: string[] = [];
    for (const im of impacts) {
      if (!isMain(im) || im.piece !== index) continue;
      if (im.kind === 'totalReflection') parts.push(`réflexion totale à ${deg(im.incidence)}`);
      else
        parts.push(
          `${im.entering ? 'entrée' : 'sortie'} ${deg(im.incidence)} → ${deg(im.refraction)}`,
        );
      if (parts.length >= 3) break;
    }
    const name = MATERIALS[block.material].name;
    return parts.length > 0 ? `${name} : ${parts.join(' · ')}` : `${name} : pas de lumière`;
  }

  /** Blocks or allows player input (pause, victory). */
  setLocked(locked: boolean): void {
    if (this.interaction) this.interaction.locked = locked || this.won;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  private countMove(change: PieceChange): void {
    const p = this.interaction?.piece(change.index);
    if (p) this.rotations += rotationSteps(change.from.angle, change.to.angle, rotationPeriod(p));
    if (this.hint === change.index) this.hint = -1;
    this.hooks.onCommit?.();
    this.hooks.onChange?.();
  }

  private update(dt: number): void {
    this.stats.begin(performance.now());
    this.time += dt;
    const { interaction, level } = this;
    if (!interaction || !level) return;
    // Re-trace at most once per frame, however many pointer events arrived.
    if (interaction.dirty) {
      traceRays(level, {}, this.trace);
      this.scene.traceChanged();
      interaction.dirty = false;
      this.hooks.onTrace?.();
    }
    // Victory once the player has let go of a piece with every target lit.
    const solved = this.trace.solved && interaction.history.size > 0 && interaction.mode === 'none';
    if (this.definition && solved && !this.won) {
      this.won = true;
      interaction.locked = true;
      interaction.deselect();
      this.winAt = this.time + WIN_DELAY;
      this.hooks.onChange?.();
    }
    if (this.won && this.time >= this.winAt) {
      this.winAt = Infinity;
      this.hooks.onWin?.();
    }
    if (this.hint >= 0 && this.time > this.hintUntil) {
      this.hint = -1;
      this.hooks.onChange?.();
    }
  }

  private render(): void {
    this.gc.syncSize();
    this.updateView();
    this.scene.draw(this.time, this.view);
    const now = performance.now();
    this.stats.end(now);
    this.debug.draw(this.gc, this.stats, now);
  }

  private updateView(): void {
    const view = this.view;
    const interaction = this.interaction;
    view.hint = this.hint;
    view.hintAlpha = this.settings.reducedMotion
      ? 0.8
      : 0.55 + 0.35 * Math.sin(this.time * Math.PI * 2 * 0.9);
    view.selected = interaction?.selected ?? -1;
    const m = interaction?.selectedPiece;
    if (!interaction || !m) return;
    view.rotatable = isRotatable(m);
    view.dragging = interaction.mode === 'rotate' || interaction.mode === 'move';
    view.ringRadius = ringRadius(m);
    view.armStart = armStart(m);
    const shown = displayAngle(m.angle, rotationPeriod(m));
    if (shown !== this.labelAngle) {
      this.labelAngle = shown;
      view.label = `${shown}°`;
    }
    const p = (this.time - interaction.dropTime) / BOUNCE_DURATION;
    view.bounce =
      !this.settings.reducedMotion && p >= 0 && p < 1
        ? 1 + BOUNCE_AMPLITUDE * Math.sin(Math.PI * p)
        : 1;
  }
}

/** Angle in degrees, French style: 35,2°. */
function deg(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}°`;
}
