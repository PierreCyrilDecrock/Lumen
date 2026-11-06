import { describe, expect, it } from 'vitest';
import { fromAngle, intersect, rayCircleDistance, reflect, vec } from '../src/engine';

const ray = (ox: number, oy: number, angle: number) => ({
  origin: vec(ox, oy),
  dir: fromAngle(angle),
});
const seg = (ax: number, ay: number, bx: number, by: number) => ({
  a: vec(ax, ay),
  b: vec(bx, by),
});

describe('intersect (ray / segment)', () => {
  it('returns the distance to a crossing segment', () => {
    expect(intersect(ray(0, 0, 0), seg(10, -5, 10, 5))).toBeCloseTo(10);
  });

  it('ignores segments behind the origin', () => {
    expect(intersect(ray(20, 0, 0), seg(10, -5, 10, 5))).toBe(Infinity);
  });

  it('never hits a parallel or collinear segment', () => {
    expect(intersect(ray(0, 0, 0), seg(5, 1, 15, 1))).toBe(Infinity);
    expect(intersect(ray(0, 0, 0), seg(5, 0, 15, 0))).toBe(Infinity);
  });

  it('includes both endpoints', () => {
    expect(intersect(ray(0, 5, 0), seg(10, -5, 10, 5))).toBeCloseTo(10);
    expect(intersect(ray(0, -5, 0), seg(10, -5, 10, 5))).toBeCloseTo(10);
  });

  it('misses just beyond an endpoint', () => {
    expect(intersect(ray(0, 5.001, 0), seg(10, -5, 10, 5))).toBe(Infinity);
  });

  it('ignores a zero-length segment', () => {
    expect(intersect(ray(0, 0, 0), seg(10, 0, 10, 0))).toBe(Infinity);
  });

  it('does not re-hit the surface it starts on', () => {
    expect(intersect(ray(10, 0, 180), seg(10, -5, 10, 5))).toBe(Infinity);
  });
});

describe('rayCircleDistance', () => {
  it('hits the near side of a circle', () => {
    expect(rayCircleDistance(0, 0, 1, 0, 20, 0, 5)).toBeCloseTo(15);
  });

  it('misses circles off-axis or behind', () => {
    expect(rayCircleDistance(0, 0, 1, 0, 20, 6, 5)).toBe(Infinity);
    expect(rayCircleDistance(0, 0, 1, 0, -20, 0, 5)).toBe(Infinity);
  });

  it('does not count a ray starting inside', () => {
    expect(rayCircleDistance(20, 0, 1, 0, 20, 0, 5)).toBe(Infinity);
  });
});

describe('reflect', () => {
  it('applies r = d - 2(d.n)n', () => {
    const r = reflect(vec(1, 1), vec(0, -1));
    expect(r.x).toBeCloseTo(1);
    expect(r.y).toBeCloseTo(-1);
  });
});
