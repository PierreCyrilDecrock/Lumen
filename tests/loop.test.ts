import { describe, expect, it } from 'vitest';
import { GameLoop, MAX_DELTA, type LoopHost } from '../src/game/loop';

/** Manual frame scheduler standing in for requestAnimationFrame. */
class FakeHost implements LoopHost {
  hidden = false;
  private nextId = 1;
  private pending = new Map<number, (t: number) => void>();
  private visibilityCb: (() => void) | null = null;

  requestFrame(cb: (t: number) => void): number {
    const id = this.nextId++;
    this.pending.set(id, cb);
    return id;
  }
  cancelFrame(id: number): void {
    this.pending.delete(id);
  }
  isHidden(): boolean {
    return this.hidden;
  }
  onVisibilityChange(cb: () => void): void {
    this.visibilityCb = cb;
  }
  get pendingCount(): number {
    return this.pending.size;
  }
  frame(time: number): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const cb of callbacks) cb(time);
  }
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.visibilityCb?.();
  }
}

function setup() {
  const host = new FakeHost();
  const deltas: number[] = [];
  let renders = 0;
  const loop = new GameLoop(
    {
      update: (dt) => deltas.push(dt),
      render: () => {
        renders++;
      },
    },
    host,
  );
  return { host, loop, deltas, renders: () => renders };
}

describe('GameLoop', () => {
  it('passes the elapsed time in seconds, starting at 0', () => {
    const { host, loop, deltas, renders } = setup();
    loop.start();
    host.frame(1000);
    host.frame(1016);
    host.frame(1048);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.016);
    expect(deltas[2]).toBeCloseTo(0.032);
    expect(renders()).toBe(3);
  });

  it('clamps long frames', () => {
    const { host, loop, deltas } = setup();
    loop.start();
    host.frame(0);
    host.frame(5000);
    expect(deltas[1]).toBe(MAX_DELTA);
  });

  it('pauses while hidden and resumes without a time jump', () => {
    const { host, loop, deltas } = setup();
    loop.start();
    host.frame(0);
    host.setHidden(true);
    expect(loop.running).toBe(false);
    expect(host.pendingCount).toBe(0);

    host.setHidden(false);
    expect(loop.running).toBe(true);
    host.frame(60_000);
    expect(deltas.at(-1)).toBe(0);
  });

  it('does not start frames when started in a hidden tab', () => {
    const { host, loop } = setup();
    host.hidden = true;
    loop.start();
    expect(loop.running).toBe(false);
    host.setHidden(false);
    expect(loop.running).toBe(true);
  });

  it('stays stopped after stop(), even when the tab becomes visible', () => {
    const { host, loop } = setup();
    loop.start();
    loop.stop();
    host.setHidden(true);
    host.setHidden(false);
    expect(loop.running).toBe(false);
  });
});
