import './style.css';
import './debug-handle';
import { GameView } from './game-view';
import { Sound } from './game/audio';
import { bindKeyboard } from './game/keyboard';
import { createSettings, followReducedMotion } from './game/settings';
import { loadSave } from './storage';
import { GameUi } from './ui/screens';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game introuvable');

// iOS Safari ignores touch-action for pinch on some versions.
document.addEventListener('gesturestart', (e) => e.preventDefault());

const save = loadSave();
const settings = createSettings();
settings.beamIntensity = save.settings.beamIntensity;
settings.impactIntensity = save.settings.impactIntensity;
settings.colorSymbols = save.settings.colorSymbols;
followReducedMotion(settings, () => save.settings.reducedMotion);
const sound = new Sound();
sound.enabled = save.settings.sound;
sound.bindUnlock();

let ui: GameUi | null = null;
const game = new GameView(canvas, settings, {
  onChange: () => ui?.refreshHud(),
  onWin: () => {
    sound.victory();
    ui?.onWin();
  },
  onCommit: () => sound.click(),
  onGoalLit: () => sound.chime(),
  onTrace: () => ui?.refreshOptics(),
  onAngleStep: (pointerType) => {
    sound.notch();
    if (pointerType === 'touch') vibrate(8);
  },
});
ui = new GameUi(game, save, settings, sound);

bindKeyboard({
  interaction: () => (ui?.router.current.name === 'play' ? game.interaction : null),
  now: () => game.time,
  onPause: () => ui?.openPause(),
  onHint: () => ui?.hint(),
});

window.__lumen = { game, save };
ui.start();

function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Some browsers throw when vibration is blocked: it is only a nicety.
  }
}

// Installable version: offline cache, replaced by each new version (production only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
