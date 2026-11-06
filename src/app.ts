import { TraceResult, traceRays, type Level } from './engine';
import { FrameStats } from './game/frame-stats';
import { InputLayer } from './game/input';
import { Interaction, isRotatable, ringRadius } from './game/interaction';
import { bindKeyboard } from './game/keyboard';
import { GameLoop } from './game/loop';
import type { Settings } from './game/settings';
import { displayAngle } from './game/snap';
import { GameCanvas } from './render/canvas';
import { DebugOverlay } from './render/debug';
import { SceneRenderer } from './render/scene';
import { createSelectionView } from './render/selection';
import { bindHistoryButtons, type Hud } from './ui/hud';

/** Touch targets are at least 44 CSS px wide: 22 px around the piece. */
const CAPTURE_CSS_PX = 22;
/** Drop bounce: duration (s) and amplitude. */
const BOUNCE_DURATION = 0.24;
const BOUNCE_AMPLITUDE = 0.08;

export interface App {
  interaction: Interaction;
  trace: TraceResult;
}

declare global {
  interface Window {
    /** Game state handle for end-to-end tests and debugging in the console. */
    __lumen?: App;
  }
}

/** Starts an interactive board: canvas, input, interactions, light rendering. */
export function startApp(canvas: HTMLCanvasElement, level: Level, settings: Settings): App {
  const gc = new GameCanvas(canvas);
  const input = new InputLayer(gc);
  const scene = new SceneRenderer(gc, settings);
  const trace = new TraceResult();
  scene.setScene(level, trace);

  let time = 0;
  let hud: Hud | null = null;
  const interaction = new Interaction(level, {
    captureRadius: () => Math.max(CAPTURE_CSS_PX / gc.viewport.scale, 10),
    onAngleStep: (pointerType) => {
      if (pointerType === 'touch') vibrate(8);
    },
    onChange: () => hud?.refresh(),
  });
  hud = bindHistoryButtons(interaction);
  bindKeyboard(interaction, () => time);

  let cursor = '';
  input.on((e) => {
    interaction.handlePointer(e, time);
    if (e.pointerType !== 'mouse') return;
    const next = interaction.cursorAt(e.x, e.y);
    if (next !== cursor) {
      cursor = next;
      canvas.style.cursor = next;
    }
  });

  const view = createSelectionView();
  let labelAngle = Number.NaN;
  const updateView = (): void => {
    const m = interaction.selectedMirror;
    view.selected = interaction.selected;
    if (!m) return;
    view.rotatable = isRotatable(m);
    view.dragging = interaction.mode === 'rotate' || interaction.mode === 'move';
    view.ringRadius = ringRadius(m);
    const shown = displayAngle(m.angle, m.doubleSided !== false);
    if (shown !== labelAngle) {
      labelAngle = shown;
      view.label = `${shown}°`;
    }
    const p = (time - interaction.dropTime) / BOUNCE_DURATION;
    view.bounce =
      !settings.reducedMotion && p >= 0 && p < 1 ? 1 + BOUNCE_AMPLITUDE * Math.sin(Math.PI * p) : 1;
  };

  const stats = new FrameStats();
  const debug = new DebugOverlay();
  debug.bindKey();
  void document.fonts.load(`600 13px "Space Grotesk"`).catch(() => undefined);

  new GameLoop({
    update: (dt) => {
      stats.begin(performance.now());
      time += dt;
      // Re-trace at most once per frame, however many pointer events arrived.
      if (interaction.dirty) {
        traceRays(level, {}, trace);
        scene.traceChanged();
        interaction.dirty = false;
      }
    },
    render: () => {
      gc.syncSize();
      updateView();
      scene.draw(time, view);
      const now = performance.now();
      stats.end(now);
      debug.draw(gc, stats, now);
    },
  }).start();

  const app: App = { interaction, trace };
  window.__lumen = app;
  return app;
}

function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Some browsers throw when vibration is blocked: it is only a nicety.
  }
}
