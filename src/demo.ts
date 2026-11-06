import './style.css';
import { startApp } from './app';
import { clamp01, createSettings, followReducedMotion, type Settings } from './game/settings';
import { ZIGZAG, cloneLevel } from './levels';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game introuvable');
document.addEventListener('gesturestart', (e) => e.preventDefault());

const settings = createSettings();
followReducedMotion(settings);

bindSlider('beam', settings, 'beamIntensity');
bindSlider('impact', settings, 'impactIntensity');
const motion = document.querySelector<HTMLInputElement>('#motion');
if (motion) {
  motion.checked = settings.reducedMotion;
  motion.addEventListener('change', () => {
    settings.reducedMotion = motion.checked;
  });
}

startApp(canvas, cloneLevel(ZIGZAG), settings);

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
