import './style.css';
import { TraceResult, traceRays } from './engine';
import { FrameStats } from './game/frame-stats';
import { GameLoop } from './game/loop';
import { clamp01, createSettings, followReducedMotion, type Settings } from './game/settings';
import { ZIGZAG } from './levels';
import { GameCanvas } from './render/canvas';
import { DebugOverlay } from './render/debug';
import { SceneRenderer } from './render/scene';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game introuvable');

const settings = createSettings();
followReducedMotion(settings);

const gc = new GameCanvas(canvas);
const scene = new SceneRenderer(gc, settings);
const trace = traceRays(ZIGZAG, {}, new TraceResult());
scene.setScene(ZIGZAG, trace);

bindSlider('beam', settings, 'beamIntensity');
bindSlider('impact', settings, 'impactIntensity');
const motion = document.querySelector<HTMLInputElement>('#motion');
if (motion) {
  motion.checked = settings.reducedMotion;
  motion.addEventListener('change', () => {
    settings.reducedMotion = motion.checked;
  });
}

const stats = new FrameStats();
const debug = new DebugOverlay();
debug.bindKey();
void document.fonts.load('600 16px "Space Grotesk"').catch(() => undefined);

let time = 0;
new GameLoop({
  update: (dt) => {
    stats.begin(performance.now());
    time += dt;
  },
  render: () => {
    gc.syncSize();
    scene.draw(time);
    const now = performance.now();
    stats.end(now);
    debug.draw(gc, stats, now);
  },
}).start();

/** Binds a 0-100 range input to a 0-1 setting, live. */
function bindSlider(id: string, target: Settings, key: 'beamIntensity' | 'impactIntensity'): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const output = document.querySelector<HTMLOutputElement>(`#${id}-value`);
  if (!input) return;
  const show = (): void => {
    if (output) output.value = `${input.value} %`;
  };
  input.value = String(Math.round(target[key] * 100));
  show();
  input.addEventListener('input', () => {
    target[key] = clamp01(Number(input.value) / 100);
    show();
  });
}
