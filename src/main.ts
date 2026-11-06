import './style.css';
import { GameCanvas } from './render/canvas';
import { DemoRenderer } from './render/demo';
import { GameLoop } from './game/loop';
import { InputLayer } from './game/input';
import { DemoState } from './game/demo';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game introuvable');

const gc = new GameCanvas(canvas);
const input = new InputLayer(gc);
const state = new DemoState();
const renderer = new DemoRenderer(gc);

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
state.reducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', () => {
  state.reducedMotion = motionQuery.matches;
});

input.on((e) => state.handlePointer(e));

// iOS Safari ignores touch-action for pinch on some versions.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Load the self-hosted font before the first frames so the title does not swap.
void document.fonts.load('600 64px "Space Grotesk"').catch(() => undefined);

new GameLoop({
  update: (dt) => state.update(dt),
  render: () => {
    gc.syncSize();
    renderer.draw(state);
  },
}).start();
