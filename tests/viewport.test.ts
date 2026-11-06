import { describe, expect, it } from 'vitest';
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MAX_DPR,
  computeViewport,
  createViewport,
  cssToLogicalX,
  cssToLogicalY,
  isOnBoard,
} from '../src/render/viewport';

const noSafe = { top: 0, right: 0, bottom: 0, left: 0 };

describe('computeViewport', () => {
  it('fills the width in a narrow portrait screen and centres vertically', () => {
    const v = computeViewport(createViewport(), 390, 844, 3, noSafe);
    expect(v.scale).toBeCloseTo(1);
    expect(v.offsetX).toBeCloseTo(0);
    expect(v.offsetY).toBeCloseTo((844 - LOGICAL_HEIGHT) / 2);
  });

  it('letterboxes horizontally on a landscape desktop screen', () => {
    const v = computeViewport(createViewport(), 1920, 1080, 1, noSafe);
    expect(v.scale).toBeCloseTo(1080 / LOGICAL_HEIGHT);
    expect(v.offsetY).toBeCloseTo(0);
    expect(v.offsetX).toBeCloseTo((1920 - LOGICAL_WIDTH * v.scale) / 2);
  });

  it('keeps the board inside the safe area', () => {
    const safe = { top: 47, right: 0, bottom: 34, left: 0 };
    const v = computeViewport(createViewport(), 390, 700, 3, safe);
    expect(v.offsetY).toBeGreaterThanOrEqual(safe.top);
    expect(v.offsetY + LOGICAL_HEIGHT * v.scale).toBeLessThanOrEqual(700 - safe.bottom + 1e-9);
  });

  it('caps the device pixel ratio and sizes the backing store', () => {
    const v = computeViewport(createViewport(), 400, 800, 3.5, noSafe);
    expect(v.dpr).toBe(MAX_DPR);
    expect(v.pixelWidth).toBe(400 * MAX_DPR);
    expect(v.pixelHeight).toBe(800 * MAX_DPR);
  });

  it('treats a missing or sub-1 ratio as 1', () => {
    expect(computeViewport(createViewport(), 100, 100, 0, noSafe).dpr).toBe(1);
    expect(computeViewport(createViewport(), 100, 100, 0.5, noSafe).dpr).toBe(1);
  });

  it('survives a zero-sized canvas', () => {
    const v = computeViewport(createViewport(), 0, 0, 1, noSafe);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(v.pixelWidth).toBeGreaterThan(0);
  });
});

describe('logical coordinates', () => {
  it('maps the board corners and centre from CSS pixels', () => {
    const v = computeViewport(createViewport(), 1280, 720, 2, noSafe);
    expect(cssToLogicalX(v, v.offsetX)).toBeCloseTo(0);
    expect(cssToLogicalY(v, v.offsetY)).toBeCloseTo(0);
    expect(cssToLogicalX(v, v.offsetX + LOGICAL_WIDTH * v.scale)).toBeCloseTo(LOGICAL_WIDTH);
    expect(cssToLogicalY(v, v.offsetY + LOGICAL_HEIGHT * v.scale)).toBeCloseTo(LOGICAL_HEIGHT);
    expect(cssToLogicalX(v, 640)).toBeCloseTo(LOGICAL_WIDTH / 2);
    expect(cssToLogicalY(v, 360)).toBeCloseTo(LOGICAL_HEIGHT / 2);
  });

  it('gives the same logical point on mobile and desktop', () => {
    const mobile = computeViewport(createViewport(), 360, 780, 3, noSafe);
    const desktop = computeViewport(createViewport(), 1440, 900, 1, noSafe);
    const lx = 100;
    const ly = 400;
    for (const v of [mobile, desktop]) {
      const cx = v.offsetX + lx * v.scale;
      const cy = v.offsetY + ly * v.scale;
      expect(cssToLogicalX(v, cx)).toBeCloseTo(lx);
      expect(cssToLogicalY(v, cy)).toBeCloseTo(ly);
    }
  });

  it('detects points on and off the board', () => {
    expect(isOnBoard(0, 0)).toBe(true);
    expect(isOnBoard(LOGICAL_WIDTH, LOGICAL_HEIGHT)).toBe(true);
    expect(isOnBoard(-1, 10)).toBe(false);
    expect(isOnBoard(10, LOGICAL_HEIGHT + 1)).toBe(false);
  });
});
