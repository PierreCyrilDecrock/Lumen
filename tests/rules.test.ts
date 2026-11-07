import { describe, expect, it } from 'vitest';
import { rotationSteps, starsFor } from '../src/game/rules';

describe('rotationSteps', () => {
  it('counts 15° steps on the shortest arc', () => {
    expect(rotationSteps(0, 45, false)).toBe(3);
    expect(rotationSteps(350 - 5, 15, false)).toBe(2);
    expect(rotationSteps(90, 270, false)).toBe(12);
  });

  it('treats a double-sided mirror modulo 180°', () => {
    expect(rotationSteps(0, 135, true)).toBe(3);
    expect(rotationSteps(90, 270, true)).toBe(0);
    expect(rotationSteps(45, 225, false)).toBe(12);
  });
});

describe('starsFor', () => {
  it('gives 3, 2 then 1 star', () => {
    expect(starsFor(3, [3, 5])).toBe(3);
    expect(starsFor(4, [3, 5])).toBe(2);
    expect(starsFor(5, [3, 5])).toBe(2);
    expect(starsFor(40, [3, 5])).toBe(1);
  });
});

describe('rotation periods', () => {
  it('uses 120° for a prism', () => {
    expect(rotationSteps(0, 120, 120)).toBe(0);
    expect(rotationSteps(0, 105, 120)).toBe(1);
    expect(rotationSteps(10, 40, 360)).toBe(2);
  });
});
