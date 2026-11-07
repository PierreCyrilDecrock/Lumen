import { TraceResult, traceRays, type Level } from '../engine';
import { GameLoop } from '../game/loop';
import type { Settings } from '../game/settings';
import { GameCanvas } from '../render/canvas';
import { SceneRenderer } from '../render/scene';

const WIDTH = 390;
const HEIGHT = 150;

/** A short beam with one impact and a lit target, to preview the settings live. */
const PREVIEW_LEVEL: Level = {
  width: WIDTH,
  height: HEIGHT,
  emitters: [{ id: 'e', x: 30, y: 112, angle: 0 }],
  mirrors: [{ id: 'm', x: 190, y: 112, angle: 165, length: 40 }],
  walls: [],
  targets: [{ id: 't', x: 319.9, y: 37, radius: 12 }],
};

/** Live preview of the render settings, drawn by the game's own renderer. */
export class SettingsPreview {
  private readonly loop: GameLoop;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    const gc = new GameCanvas(canvas, WIDTH, HEIGHT);
    const scene = new SceneRenderer(gc, settings);
    const trace = traceRays(PREVIEW_LEVEL, {}, new TraceResult());
    scene.setScene(PREVIEW_LEVEL, trace);
    this.loop = new GameLoop({
      update: (dt) => {
        this.time += dt;
      },
      render: () => {
        gc.syncSize();
        scene.draw(this.time);
      },
    });
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }
}
