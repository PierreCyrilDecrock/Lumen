import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEAM_INTENSITY,
  DEFAULT_IMPACT_INTENSITY,
  applyPreset,
  clamp01,
  createSettings,
  currentPreset,
} from '../src/game/settings';
import { FrameStats } from '../src/game/frame-stats';

describe('settings', () => {
  it('starts from the documented defaults', () => {
    const s = createSettings();
    expect(s.beamIntensity).toBe(DEFAULT_BEAM_INTENSITY);
    expect(s.impactIntensity).toBe(DEFAULT_IMPACT_INTENSITY);
    expect(DEFAULT_BEAM_INTENSITY).toBe(0.6);
    expect(DEFAULT_IMPACT_INTENSITY).toBe(0.6);
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

describe('presets', () => {
  it('applies Doux, Normal and Intense and recognises them', () => {
    const s = createSettings();
    expect(currentPreset(s)).toBe('normal');
    applyPreset(s, 'doux');
    expect([s.beamIntensity, s.impactIntensity]).toEqual([0.3, 0.3]);
    expect(currentPreset(s)).toBe('doux');
    applyPreset(s, 'intense');
    expect([s.beamIntensity, s.impactIntensity]).toEqual([1, 1]);
    s.beamIntensity = 0.42;
    expect(currentPreset(s)).toBeNull();
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
