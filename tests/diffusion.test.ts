import { describe, expect, it } from 'vitest';
import {
  CONE_FIELDS,
  FALLOFF_DISTANCE,
  MAX_RAYS,
  TraceResult,
  receivedLight,
  traceRays,
} from '../src/engine';
import { crystal, diffuser, emitter, fog, level, mirror, wall } from './helpers';

const angleOf = (s: { x1: number; y1: number; x2: number; y2: number }) =>
  (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;

/** Emitter shooting right into a vertical frosted plate at x = 150. */
const plate = (spread = 60, extra = {}) =>
  level({ emitters: [emitter(40, 280, 0)], diffusers: [diffuser(150, 280, 90, spread)], ...extra });

describe('diffusion', () => {
  it('replaces the ray by a fan of 9 rays and conserves the total intensity', () => {
    const r = traceRays(plate());
    const fan = r.segments.filter((s) => s.diffused && s.bounce === 1);
    expect(fan).toHaveLength(9);
    expect(fan.reduce((sum, s) => sum + s.intensity, 0)).toBeCloseTo(1, 12);
    expect(r.impacts.filter((i) => i.kind === 'diffuser')).toHaveLength(1);
    expect(r.coneCount).toBe(1);
  });

  it('spreads the fan evenly over the chosen angle, around the far-side normal', () => {
    for (const spread of [20, 45, 90]) {
      const angles = traceRays(plate(spread))
        .segments.filter((s) => s.diffused)
        .map(angleOf)
        .sort((a, b) => a - b);
      expect(angles[0]).toBeCloseTo(-spread / 2, 9);
      expect(angles[8]).toBeCloseTo(spread / 2, 9);
      expect(angles[4]).toBeCloseTo(0, 9);
    }
  });

  it('weights the fan with Lambert’s cosine law', () => {
    const fan = traceRays(plate(90)).segments.filter((s) => s.diffused);
    const byAngle = new Map(fan.map((s) => [Math.round(angleOf(s)), s.intensity]));
    const centre = byAngle.get(0)!;
    expect(byAngle.get(45)! / centre).toBeCloseTo(Math.cos(Math.PI / 4), 9);
    expect(byAngle.get(-45)).toBeCloseTo(byAngle.get(45)!, 12);
  });

  it('aims the fan with the plate orientation', () => {
    const tilted = level({
      emitters: [emitter(40, 280, 0)],
      diffusers: [diffuser(150, 280, 60, 20)],
    });
    const r = traceRays(tilted);
    const axis = r.cones[2]! * (180 / Math.PI);
    expect(axis).toBeCloseTo(-30, 9);
    expect(CONE_FIELDS).toBe(5);
  });

  it('fades diffused light with distance', () => {
    expect(receivedLight(0.5, -1)).toBe(0.5);
    expect(receivedLight(0.5, 0)).toBe(0.5);
    expect(receivedLight(0.5, FALLOFF_DISTANCE)).toBeCloseTo(0.25, 12);
  });

  it('lights a crystal in the cone, not one outside it', () => {
    const r = traceRays(plate(40, { crystals: [crystal(300, 280), crystal(300, 120)] }));
    expect(r.crystalProgress[0]).toBe(1);
    expect(r.crystalProgress[1]).toBe(0);
    expect(r.crystalsLit).toBe(1);
    expect(r.solved).toBe(false);
  });

  it('lets light through a crystal to the next one', () => {
    const r = traceRays(
      level({ emitters: [emitter(40, 280, 0)], crystals: [crystal(150, 280), crystal(300, 280)] }),
    );
    expect(r.crystalProgress).toEqual([1, 1]);
    expect(r.solved).toBe(true);
  });

  it('a thick fog puts out a distant crystal', () => {
    const clear = traceRays(plate(40, { crystals: [crystal(320, 280)] }));
    expect(clear.crystalProgress[0]).toBe(1);
    const foggy = traceRays(
      plate(40, { crystals: [crystal(320, 280)], fogs: [fog(245, 280, 100, 300, 0.03)] }),
    );
    expect(foggy.crystalProgress[0]).toBeLessThan(1);
    expect(foggy.crystalLight[0]).toBeCloseTo(clear.crystalLight[0]! * Math.exp(-0.03 * 100), 9);
  });

  it('absorbs a main ray in fog by exp(-density × length)', () => {
    const r = traceRays(
      level({ emitters: [emitter(20, 280, 0)], fogs: [fog(195, 280, 100, 100, 0.01)] }),
    );
    const after = r.segments.find((s) => s.x1 > 240)!;
    expect(after.intensity).toBeCloseTo(Math.exp(-1), 12);
  });

  it('reflects each fan ray at most once', () => {
    // Fan to the right, between two vertical mirrors that would bounce forever.
    const r = traceRays(
      level({
        emitters: [emitter(40, 280, 0)],
        diffusers: [diffuser(100, 280, 90, 30)],
        mirrors: [mirror(330, 280, 90, 300), mirror(130, 150, 90, 100)],
      }),
    );
    for (const s of r.segments.filter((x) => x.diffused)) expect(s.bounce).toBeLessThanOrEqual(2);
    expect(r.truncated).toBe(false);
  });

  it('never traces more than 200 rays', () => {
    const emitters = Array.from({ length: 40 }, (_, i) => emitter(20, 10 + i * 13, 0));
    const r = traceRays(
      level({
        emitters,
        diffusers: [diffuser(120, 280, 90, 90, 540)],
        walls: [wall(380, 280, 90, 560)],
      }),
      {},
      new TraceResult(),
    );
    expect(r.rayCount).toBeLessThanOrEqual(MAX_RAYS);
    expect(r.truncated).toBe(true);
  });
});
