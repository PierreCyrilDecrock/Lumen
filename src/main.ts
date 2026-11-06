import './style.css';
import { startApp } from './app';
import { createSettings, followReducedMotion } from './game/settings';
import { zigzagPuzzle } from './levels';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game introuvable');

// iOS Safari ignores touch-action for pinch on some versions.
document.addEventListener('gesturestart', (e) => e.preventDefault());

const settings = createSettings();
followReducedMotion(settings);
startApp(canvas, zigzagPuzzle(), settings);
