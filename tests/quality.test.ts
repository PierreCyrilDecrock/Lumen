import { describe, expect, it } from 'vitest';
import { QUALITY_WINDOW, QualityGovernor } from '../src/game/quality';

const feed = (g: QualityGovernor, ms: number, frames = QUALITY_WINDOW) => {
  let changed = false;
  for (let i = 0; i < frames; i++) changed = g.feed(ms) || changed;
  return changed;
};

describe('QualityGovernor', () => {
  it('keeps full quality at 60 fps', () => {
    const g = new QualityGovernor();
    expect(feed(g, 16.7, 300)).toBe(false);
    expect(g.level).toBe(0);
  });

  it('drops one notch per slow window of 60 frames, down to the minimum', () => {
    const g = new QualityGovernor();
    expect(feed(g, 30, QUALITY_WINDOW - 1)).toBe(false);
    expect(g.feed(30)).toBe(true);
    expect(g.level).toBe(1);
    feed(g, 30);
    expect(g.level).toBe(2);
    feed(g, 30);
    expect(g.level).toBe(2);
  });

  it('ignores pauses (huge intervals) and does not raise quality back', () => {
    const g = new QualityGovernor();
    for (let i = 0; i < 200; i++) g.feed(5000);
    expect(g.level).toBe(0);
    feed(g, 40);
    feed(g, 10, 300);
    expect(g.level).toBe(1);
  });
});
