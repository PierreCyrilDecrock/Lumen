import { describe, expect, it } from 'vitest';
import { displayAngle, normalizeAngle, snapAngle, snapToGrid } from '../src/game/snap';

describe('angle snapping', () => {
  it('snaps to the nearest 15° step', () => {
    expect(snapAngle(0)).toBe(0);
    expect(snapAngle(7.4)).toBe(0);
    expect(snapAngle(7.6)).toBe(15);
    expect(snapAngle(44)).toBe(45);
    expect(snapAngle(52.4)).toBe(45);
    expect(snapAngle(52.6)).toBe(60);
  });

  it('normalises to [0, 360)', () => {
    expect(snapAngle(-15)).toBe(345);
    expect(snapAngle(-7)).toBe(0);
    expect(snapAngle(359)).toBe(0);
    expect(snapAngle(375)).toBe(15);
    expect(snapAngle(-725)).toBe(0);
    expect(Object.is(snapAngle(-1), 0)).toBe(true);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(720)).toBe(0);
  });

  it('supports other steps', () => {
    expect(snapAngle(50, 45)).toBe(45);
    expect(snapAngle(70, 45)).toBe(90);
  });

  it('shows double-sided mirrors in [0, 180)', () => {
    expect(displayAngle(225, true)).toBe(45);
    expect(displayAngle(225, false)).toBe(225);
    expect(displayAngle(180, true)).toBe(0);
    expect(displayAngle(-45, false)).toBe(315);
  });
});

describe('grid snapping', () => {
  it('snaps to multiples of 10', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(14)).toBe(10);
    expect(snapToGrid(15)).toBe(20);
    expect(snapToGrid(203.7)).toBe(200);
    expect(Object.is(snapToGrid(-2), 0)).toBe(true);
  });
});
