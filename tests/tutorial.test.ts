import { describe, expect, it } from 'vitest';
import { TUTORIALS, Tutorial } from '../src/game/tutorial';
import { findLevel } from '../src/levels';

describe('tutorial', () => {
  it('covers the first three levels, pointing at pieces that exist', () => {
    for (const id of ['r01', 'r02', 'r03']) {
      const steps = TUTORIALS[id]!;
      expect(steps.length).toBeGreaterThan(0);
      const def = findLevel(id)!;
      for (const step of steps) expect(def.pieces.some((p) => p.id === step.piece)).toBe(true);
      for (const step of steps) expect(step.text.length).toBeLessThanOrEqual(60);
    }
  });

  it('shows « tap », then « drag », and disappears once the gesture is done', () => {
    const t = new Tutorial(TUTORIALS.r01!);
    expect(t.current?.until).toBe('select');
    t.update(null, 0);
    expect(t.current?.until).toBe('select');
    t.update('m1', 0);
    expect(t.current?.until).toBe('rotate');
    t.update('m1', 3);
    expect(t.current).toBeNull();
  });

  it('skips a step already done', () => {
    const t = new Tutorial(TUTORIALS.r01!);
    t.update('m1', 1);
    expect(t.current).toBeNull();
  });
});
