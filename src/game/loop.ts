/** Longest step fed to update(), in seconds: avoids huge jumps after a stall. */
export const MAX_DELTA = 0.1;

export interface LoopCallbacks {
  /** Advances the simulation. `dt` is in seconds, clamped to MAX_DELTA. */
  update(dt: number): void;
  /** Draws the current state. */
  render(): void;
}

/** Scheduling primitives, injectable for tests. */
export interface LoopHost {
  requestFrame(cb: (time: number) => void): number;
  cancelFrame(id: number): void;
  isHidden(): boolean;
  onVisibilityChange(cb: () => void): void;
}

const browserHost = (): LoopHost => ({
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
  isHidden: () => document.hidden,
  onVisibilityChange: (cb) => document.addEventListener('visibilitychange', cb),
});

/**
 * requestAnimationFrame loop with delta time. Pauses while the tab is hidden and
 * resumes without a time jump when it becomes visible again.
 */
export class GameLoop {
  private frameId: number | null = null;
  private lastTime: number | null = null;
  private started = false;
  private readonly host: LoopHost;

  constructor(
    private readonly callbacks: LoopCallbacks,
    host?: LoopHost,
  ) {
    this.host = host ?? browserHost();
    this.host.onVisibilityChange(() => {
      if (this.host.isHidden()) this.pause();
      else if (this.started) this.resume();
    });
  }

  get running(): boolean {
    return this.frameId !== null;
  }

  start(): void {
    this.started = true;
    if (!this.host.isHidden()) this.resume();
  }

  stop(): void {
    this.started = false;
    this.pause();
  }

  private resume(): void {
    if (this.frameId !== null) return;
    this.lastTime = null;
    this.frameId = this.host.requestFrame(this.tick);
  }

  private pause(): void {
    if (this.frameId === null) return;
    this.host.cancelFrame(this.frameId);
    this.frameId = null;
  }

  private readonly tick = (time: number): void => {
    const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, MAX_DELTA);
    this.lastTime = time;
    this.callbacks.update(Math.max(dt, 0));
    this.callbacks.render();
    this.frameId = this.host.requestFrame(this.tick);
  };
}
