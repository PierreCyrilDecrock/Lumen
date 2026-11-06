import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEAM_INTENSITY,
  DEFAULT_IMPACT_INTENSITY,
  clamp01,
  createSettings,
} from '../src/game/settings';
import { FrameStats } from '../src/game/frame-stats';

describe('settings', () => {
  it('starts from the documented defaults', () => {
    const s = createSettings();
    expect(s.beamIntensity).toBe(DEFAULT_BEAM_INTENSITY);
    expect(s.impactIntensity).toBe(DEFAULT_IMPACT_INTENSITY);
    expect(DEFAULT_BEAM_INTENSITY).toBe(0.55);
    expect(DEFAULT_IMPACT_INTENSITY).toBe(0.45);
    expect(s.reducedMotion).toBe(false);
    expect(createSettings(true).reducedMotion).toBe(true);
  });

  it('clamps intensities to 0..1', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(7)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('FrameStats', () => {
  it('averages frame work and derives fps from intervals', () => {
    const stats = new FrameStats();
    for (let i = 0; i < 10; i++) {
      const t = i * 16;
      stats.begin(t);
      stats.end(t + 2);
    }
    expect(stats.averageWork).toBeCloseTo(2);
    expect(stats.maxWork).toBeCloseTo(2);
    expect(stats.fps).toBeCloseTo(62.5);
  });

  it('ignores the gap after a pause', () => {
    const stats = new FrameStats();
    stats.begin(0);
    stats.end(1);
    stats.begin(16);
    stats.end(17);
    stats.begin(10_000);
    stats.end(10_001);
    expect(stats.fps).toBeGreaterThan(30);
  });
});
