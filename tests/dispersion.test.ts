import { describe, expect, it } from 'vitest';
import { COLORS, SPECTRUM, colorMatches, traceRays } from '../src/engine';
import { colorTarget, emitter, filter, level, prism } from './helpers';

const angleOf = (s: { x1: number; y1: number; x2: number; y2: number }) =>
  (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;

/** White light from the left into a prism pointing up, near minimum deviation. */
function throughPrism() {
  return traceRays(level({ emitters: [emitter(24, 294, -20)], prisms: [prism(195, 260, 0, 120)] }));
}

/** Direction of each band once it has left the prism (last segment of the band). */
function exitAngles(r: ReturnType<typeof throughPrism>): number[] {
  return SPECTRUM.map((_, b) => {
    const segments = r.segments.filter((s) => s.band === b && s.medium === -1);
    return angleOf(segments[segments.length - 1]!);
  });
}

describe('dispersion', () => {
  it('splits white light into 6 coloured rays', () => {
    const r = throughPrism();
    const bands = new Set(r.segments.filter((s) => s.band >= 0).map((s) => s.band));
    expect([...bands].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const red = r.segments.find((s) => s.band === 0)!;
    expect([red.r, red.g, red.b]).toEqual([1, 0, 0]);
  });

  it('orders the rays like the spectrum, violet deviating more than red', () => {
    const angles = exitAngles(throughPrism());
    // Deviation grows from red to violet: exit angles increase monotonically.
    for (let b = 1; b < angles.length; b++) expect(angles[b]!).toBeGreaterThan(angles[b - 1]!);
    const deviation = (a: number) => a - -20;
    expect(deviation(angles[5]!)).toBeGreaterThan(deviation(angles[0]!));
    expect(angles[5]! - angles[0]!).toBeGreaterThan(5); // Clearly visible fan.
  });

  it('adds colours: red + green = yellow', () => {
    expect(colorMatches(1, 1, 0, COLORS.yellow, 0.2)).toBe(true);
    expect(colorMatches(1, 0, 0, COLORS.yellow, 0.2)).toBe(false);
    expect(colorMatches(1, 0.5, 0, COLORS.orange, 0.2)).toBe(true);
    expect(colorMatches(0.2, 0.2, 0, COLORS.yellow, 0.2)).toBe(false); // Too dim.
  });

  it('lights a yellow target with red + green, not with red alone', () => {
    const red = filter(100, 150, 90, [0]);
    const green = filter(290, 150, 90, [3]);
    const mixed = traceRays(
      level({
        emitters: [emitter(20, 150, 0), emitter(370, 150, 180)],
        filters: [red, green],
        colorTargets: [colorTarget(195, 150, 'yellow')],
      }),
    );
    expect(mixed.colorTargetsLit).toEqual([true]);
    expect(mixed.solved).toBe(true);
    const redOnly = traceRays(
      level({
        emitters: [emitter(20, 150, 0)],
        filters: [red],
        colorTargets: [colorTarget(195, 150, 'yellow')],
      }),
    );
    expect(redOnly.colorTargetsLit).toEqual([false]);
    expect(redOnly.colorLight.slice(0, 3)).toEqual([1, 0, 0]);
  });

  it('filters: white becomes the filter colour, other colours are blocked', () => {
    const r = traceRays(
      level({
        emitters: [emitter(20, 150, 0)],
        filters: [filter(100, 150, 90, [0]), filter(200, 150, 90, [3])],
      }),
    );
    expect(r.segments.some((s) => s.band === 0)).toBe(true);
    expect(r.segments.some((s) => s.band === 3)).toBe(false);
    expect(r.impacts.filter((i) => i.kind === 'filter')).toHaveLength(2);
    const last = r.segments[r.segments.length - 1]!;
    expect(last.x2).toBeCloseTo(200 - 0, 0); // Stopped by the green filter.
  });

  it('lets a matching band through a filter of its family', () => {
    const warm = [0, 1, 2];
    const r = traceRays(
      level({
        emitters: [emitter(20, 150, 0)],
        filters: [filter(100, 150, 90, warm), filter(200, 150, 90, [1])],
        colorTargets: [colorTarget(320, 150, 'orange')],
      }),
    );
    // White → red + orange + yellow; only orange crosses the second filter.
    expect(r.colorTargetsLit).toEqual([true]);
  });

  it('lights an orange target with the warm family alone (red + orange + yellow)', () => {
    const r = traceRays(
      level({
        emitters: [emitter(20, 150, 0)],
        filters: [filter(100, 150, 90, [0, 1, 2])],
        colorTargets: [colorTarget(320, 150, 'orange')],
      }),
    );
    expect(r.colorTargetsLit).toEqual([true]);
  });
});
