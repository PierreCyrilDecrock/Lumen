import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_BOUNCES, TraceResult, traceRays } from '../src/engine';
import { BACKSLASH, SLASH, emitter, level, mirror, target, wall } from './helpers';

const dirOf = (s: { x1: number; y1: number; x2: number; y2: number }) => {
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  return { x: (s.x2 - s.x1) / len, y: (s.y2 - s.y1) / len };
};

describe('traceRays: reflection', () => {
  it('turns a ray by 90° on a 45° mirror', () => {
    const r = traceRays(
      level({ emitters: [emitter(54, 280, 0)], mirrors: [mirror(200, 280, BACKSLASH)] }),
    );
    expect(r.segments).toHaveLength(2);
    const [first, second] = r.segments;
    expect(first!.x2).toBeCloseTo(200);
    expect(first!.y2).toBeCloseTo(280);
    expect(dirOf(second!).x).toBeCloseTo(0);
    expect(dirOf(second!).y).toBeCloseTo(1);
    expect(second!.y2).toBeCloseTo(560); // Leaves the board at the bottom.
    expect(second!.bounce).toBe(1);
    expect(r.impacts[0]).toMatchObject({ kind: 'mirror', piece: 0, bounce: 0 });
  });

  it('keeps the angle of incidence equal to the angle of reflection', () => {
    let checked = 0;
    for (let m = 0; m < 180; m += 15) {
      const r = traceRays(
        level({ emitters: [emitter(60, 280, 10)], mirrors: [mirror(200, 305, m, 200)] }),
      );
      if (r.impacts.length === 0 || r.impacts[0]!.kind !== 'mirror') continue;
      const { nx, ny } = r.impacts[0]!;
      const d = dirOf(r.segments[0]!);
      const o = dirOf(r.segments[1]!);
      expect(-(d.x * nx + d.y * ny)).toBeCloseTo(o.x * nx + o.y * ny, 9);
      expect(d.x * ny - d.y * nx).toBeCloseTo(o.x * ny - o.y * nx, 9);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('handles grazing incidence', () => {
    const r = traceRays(
      level({ emitters: [emitter(0, 299, 0.5)], mirrors: [mirror(195, 300, 0, 200)] }),
    );
    expect(r.impacts[0]?.kind).toBe('mirror');
    const out = dirOf(r.segments[1]!);
    expect((Math.atan2(out.y, out.x) * 180) / Math.PI).toBeCloseTo(-0.5, 9);
    expect(Number.isFinite(r.segments[1]!.x2)).toBe(true);
  });

  it('lets a ray travelling along a mirror pass through', () => {
    const r = traceRays(
      level({ emitters: [emitter(0, 300, 0)], mirrors: [mirror(195, 300, 0, 200)] }),
    );
    expect(r.segments).toHaveLength(1);
    expect(r.impacts).toHaveLength(0);
    expect(r.segments[0]!.x2).toBeCloseTo(390);
  });

  it('solves "Le Zigzag": three mirrors lead the ray to the target', () => {
    const r = traceRays(
      level({
        emitters: [emitter(54, 170, 0)],
        mirrors: [
          mirror(200, 170, BACKSLASH),
          mirror(200, 350, BACKSLASH),
          mirror(320, 350, SLASH),
        ],
        targets: [target(320, 230)],
      }),
    );
    expect(r.allTargetsHit).toBe(true);
    const ends = r.segments.map((s) => [Math.round(s.x2), Math.round(s.y2)]);
    expect(ends).toEqual([
      [200, 170],
      [200, 350],
      [320, 350],
      [320, 242],
    ]);
    expect(r.impacts.map((i) => i.kind)).toEqual(['mirror', 'mirror', 'mirror', 'target']);
  });

  it('reflects a ray that hits the very end of a mirror', () => {
    const tipY = 200 + 20 * Math.sin(Math.PI / 4);
    const hit = traceRays(
      level({ emitters: [emitter(50, tipY, 0)], mirrors: [mirror(200, 200, BACKSLASH)] }),
    );
    expect(hit.impacts[0]?.kind).toBe('mirror');
    expect(hit.impacts[0]!.x).toBeCloseTo(tipY);
    expect(dirOf(hit.segments[1]!).y).toBeCloseTo(1);

    const miss = traceRays(
      level({ emitters: [emitter(50, tipY + 0.01, 0)], mirrors: [mirror(200, 200, BACKSLASH)] }),
    );
    expect(miss.impacts).toHaveLength(0);
    expect(miss.segments[0]!.x2).toBeCloseTo(390);
  });

  it('stops two facing parallel mirrors after the bounce limit', () => {
    const parts = {
      emitters: [emitter(200, 280, 0)],
      mirrors: [mirror(100, 280, 90, 100), mirror(300, 280, 90, 100)],
    };
    const r = traceRays(level(parts));
    expect(r.truncated).toBe(true);
    expect(r.segments).toHaveLength(DEFAULT_MAX_BOUNCES + 1);

    const short = traceRays(level(parts), { maxBounces: 5 });
    expect(short.truncated).toBe(true);
    expect(short.segments).toHaveLength(6);
  });

  it('is absorbed by a wall', () => {
    const r = traceRays(
      level({
        emitters: [emitter(54, 280, 0)],
        walls: [wall(200, 280, 90, 80)],
        targets: [target(300, 280)],
      }),
    );
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]!.x2).toBeCloseTo(200);
    expect(r.impacts).toHaveLength(1);
    expect(r.impacts[0]).toMatchObject({ kind: 'wall', piece: 0, nx: -1 });
    expect(r.targetsHit).toEqual([false]);
    expect(r.allTargetsHit).toBe(false);
  });

  it('reports no target hit when the ray goes elsewhere', () => {
    const r = traceRays(
      level({ emitters: [emitter(195, 500, -90)], targets: [target(300, 280), target(80, 100)] }),
    );
    expect(r.targetsHit).toEqual([false, false]);
    expect(r.allTargetsHit).toBe(false);
    expect(r.truncated).toBe(false);
    expect(r.segments[0]!.y2).toBeCloseTo(0);
  });

  it('reflects on the front of a single-sided mirror and absorbs on its back', () => {
    const oneSided = mirror(200, 280, BACKSLASH, 40, false);
    const front = traceRays(level({ emitters: [emitter(54, 280, 0)], mirrors: [oneSided] }));
    expect(front.impacts[0]?.kind).toBe('mirror');
    expect(front.segments).toHaveLength(2);

    const back = traceRays(level({ emitters: [emitter(350, 280, 180)], mirrors: [oneSided] }));
    expect(back.impacts[0]?.kind).toBe('mirrorBack');
    expect(back.segments).toHaveLength(1);
  });

  it('reflects on both faces of a double-sided mirror', () => {
    const m = mirror(200, 280, BACKSLASH);
    const left = traceRays(level({ emitters: [emitter(54, 280, 0)], mirrors: [m] }));
    const right = traceRays(level({ emitters: [emitter(350, 280, 180)], mirrors: [m] }));
    expect(dirOf(left.segments[1]!).y).toBeCloseTo(1);
    expect(dirOf(right.segments[1]!).y).toBeCloseTo(-1);
  });

  it('gives impact normals facing the incoming ray', () => {
    const r = traceRays(
      level({ emitters: [emitter(350, 280, 180)], mirrors: [mirror(200, 280, BACKSLASH)] }),
    );
    const d = dirOf(r.segments[0]!);
    const n = r.impacts[0]!;
    expect(d.x * n.nx + d.y * n.ny).toBeLessThan(0);
    expect(Math.hypot(n.nx, n.ny)).toBeCloseTo(1);
  });

  it('lights a pass-through target and carries on to the next one', () => {
    const r = traceRays(
      level({
        emitters: [emitter(20, 280, 0)],
        targets: [{ ...target(150, 280), passThrough: true }, target(300, 280)],
      }),
    );
    expect(r.targetsHit).toEqual([true, true]);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]!.x2).toBeCloseTo(138);
    expect(r.segments[1]!.x1).toBeCloseTo(162);
    expect(r.segments[1]!.x2).toBeCloseTo(288);
    expect(r.segments[1]!.bounce).toBe(0);
  });

  it('tags segments with their emitter', () => {
    const r = traceRays(level({ emitters: [emitter(10, 100, 0), emitter(10, 400, 0)] }));
    expect(r.segments.map((s) => s.emitter)).toEqual([0, 1]);
    expect(r.segments.every((s) => s.r === 1 && s.g === 1 && s.b === 1)).toBe(true);
  });
});

describe('traceRays: performance', () => {
  const loop = level({
    emitters: [emitter(200, 280, 0)],
    mirrors: [mirror(100, 280, 90, 100), mirror(300, 280, 90, 100)],
    walls: Array.from({ length: 8 }, (_, i) => wall(20 + i * 45, 40, 0, 30)),
    targets: [target(50, 520), target(340, 520)],
  });

  it('reuses its segment and impact objects across traces', () => {
    const out = new TraceResult();
    traceRays(loop, {}, out);
    const firstSegment = out.segments[0];
    const firstImpact = out.impacts[0];
    traceRays(loop, {}, out);
    expect(out.segments[0]).toBe(firstSegment);
    expect(out.impacts[0]).toBe(firstImpact);
    expect(out.segments).toHaveLength(DEFAULT_MAX_BOUNCES + 1);
  });

  it('traces 32 bounces in well under 1 ms', () => {
    const out = new TraceResult();
    for (let i = 0; i < 200; i++) traceRays(loop, {}, out); // Warm-up.
    const runs = 2000;
    const start = performance.now();
    for (let i = 0; i < runs; i++) traceRays(loop, {}, out);
    const perTrace = (performance.now() - start) / runs;
    expect(out.truncated).toBe(true);
    expect(perTrace).toBeLessThan(1);
  });
});
