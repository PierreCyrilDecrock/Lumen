import { describe, expect, it } from 'vitest';
import { PARTIAL_REFLECTION, traceRays, type Impact } from '../src/engine';
import { emitter, level, medium, target } from './helpers';

const deg = (rad: number) => (rad * 180) / Math.PI;
const directionAngle = (s: { x1: number; y1: number; x2: number; y2: number }) =>
  deg(Math.atan2(s.y2 - s.y1, s.x2 - s.x1));
const mainImpacts = (impacts: Impact[]) => impacts.filter((i) => i.intensity === 1);

/** A ray hitting the top face (y = 300) of a large block at 50° from the normal. */
function at50(material: 'water' | 'glass' | 'diamond') {
  return traceRays(
    level({
      emitters: [emitter(100, 300 - 100 / Math.tan((40 * Math.PI) / 180), 40)],
      media: [medium(195, 420, 380, 240, material)],
    }),
  );
}

describe('refraction (Snell-Descartes)', () => {
  it.each([
    ['water', 35.2],
    ['glass', 30.7],
    ['diamond', 18.4],
  ] as const)('bends 50° from air into %s to %s°', (material, expected) => {
    const r = at50(material);
    const entry = mainImpacts(r.impacts).find((i) => i.kind === 'interface')!;
    expect(entry.entering).toBe(true);
    expect(entry.incidence).toBeCloseTo(50, 6);
    expect(Math.abs(entry.refraction - expected)).toBeLessThan(0.1);
    // The refracted segment goes down at the refraction angle from the vertical.
    const inside = r.segments.find((s) => s.medium === 0 && s.intensity === 1)!;
    expect(90 - directionAngle(inside)).toBeCloseTo(entry.refraction, 6);
  });

  it('leaves a parallel slab at the angle it entered', () => {
    const r = traceRays(
      level({ emitters: [emitter(60, 160, 40)], media: [medium(195, 300, 380, 60, 'glass')] }),
    );
    const main = r.segments.filter((s) => s.intensity === 1);
    expect(main).toHaveLength(3);
    expect(directionAngle(main[2]!)).toBeCloseTo(40, 9);
    const [entry, exit] = mainImpacts(r.impacts).filter((i) => i.kind === 'interface');
    expect(exit!.entering).toBe(false);
    expect(exit!.refraction).toBeCloseTo(entry!.incidence, 9);
  });

  it('does not deviate a ray at normal incidence', () => {
    const r = traceRays(
      level({ emitters: [emitter(195, 100, 90)], media: [medium(195, 300, 200, 100, 'diamond')] }),
    );
    const entry = r.impacts.find((i) => i.kind === 'interface')!;
    expect(entry.incidence).toBeCloseTo(0, 6);
    expect(entry.refraction).toBeCloseTo(0, 6);
    for (const s of r.segments.filter((x) => x.intensity === 1)) {
      expect(directionAngle(s)).toBeCloseTo(90, 9);
    }
  });

  /** Ray from inside a diamond to its top face (y = 180) at `incidence`. */
  function insideDiamond(incidence: number) {
    return traceRays(
      level({
        emitters: [emitter(150, 300, -90 + incidence)],
        media: [medium(195, 280, 300, 200, 'diamond')],
      }),
    );
  }

  it('reflects totally from diamond to air beyond the critical angle (24.4°)', () => {
    const critical = deg(Math.asin(1 / 2.42));
    expect(critical).toBeCloseTo(24.4, 1);
    const r = insideDiamond(30);
    const first = r.impacts[0]!;
    expect(first.kind).toBe('totalReflection');
    expect(first.incidence).toBeCloseTo(30, 6);
    expect(r.segments[1]!.medium).toBe(0);
    expect(r.segments[1]!.y2).toBeGreaterThan(r.segments[1]!.y1); // Heads back down.

    expect(insideDiamond(25).impacts[0]!.kind).toBe('totalReflection');
    const below = insideDiamond(24).impacts[0]!;
    expect(below.kind).toBe('interface');
    expect(below.refraction).toBeCloseTo(deg(Math.asin(2.42 * Math.sin((24 * Math.PI) / 180))), 6);
  });

  it('sends one faint partial reflection per interface, one level deep', () => {
    const r = at50('glass');
    const weak = r.segments.filter((s) => s.intensity < 1);
    expect(weak.length).toBeGreaterThan(0);
    for (const s of weak) expect(s.intensity).toBeCloseTo(PARTIAL_REFLECTION, 9);
    // The partial reflection at the entry point leaves the top face mirror-like.
    const entry = r.impacts.find((i) => i.kind === 'interface' && i.entering)!;
    const fromEntry = weak.find((s) => Math.hypot(s.x1 - entry.x, s.y1 - entry.y) < 1e-9)!;
    expect(directionAngle(fromEntry)).toBeCloseTo(-40, 6);
    // No reflection of a reflection.
    expect(r.segments.every((s) => s.intensity === 1 || s.intensity === PARTIAL_REFLECTION)).toBe(
      true,
    );
  });

  it('never lights a target with a partial reflection alone', () => {
    // The main ray goes into the glass; the target sits on the 15 % reflection.
    const r = traceRays(
      level({
        emitters: [emitter(60, 160, 40)],
        media: [medium(195, 420, 380, 240, 'glass')],
        targets: [target(300, 239)],
      }),
    );
    const reachesTarget = r.impacts.some((i) => i.kind === 'target');
    expect(reachesTarget).toBe(true);
    expect(r.targetsHit).toEqual([false]);
  });

  it('ignores media stored in the tray', () => {
    const block = { ...medium(195, 300, 200, 100, 'glass'), stored: true };
    const r = traceRays(level({ emitters: [emitter(60, 200, 40)], media: [block] }));
    expect(r.impacts).toHaveLength(0);
  });

  it('starts inside a medium when the emitter is in it', () => {
    const r = traceRays(
      level({ emitters: [emitter(195, 300, 0)], media: [medium(195, 300, 100, 100, 'water')] }),
    );
    expect(r.segments[0]!.medium).toBe(0);
  });
});
