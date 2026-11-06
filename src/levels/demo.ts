import type { Level } from '../engine';

/**
 * « Le Zigzag », solved: three mirrors lead the ray to the target.
 * The full level format arrives in step 5.
 */
export const ZIGZAG: Level = {
  width: 390,
  height: 560,
  emitters: [{ id: 'source', x: 54, y: 170, angle: 0 }],
  mirrors: [
    { id: 'm1', x: 200, y: 170, angle: 45, length: 40 },
    { id: 'm2', x: 200, y: 350, angle: 45, length: 40, movable: true },
    { id: 'm3', x: 320, y: 350, angle: 135, length: 40, doubleSided: false },
  ],
  walls: [
    { id: 'w1', x: 290, y: 260, angle: 0, length: 50 },
    { id: 'w2', x: 110, y: 440, angle: 90, length: 70 },
  ],
  targets: [{ id: 'goal', x: 320, y: 230, radius: 12 }],
};

/** Deep copy, so that playing never mutates the original. */
export function cloneLevel(level: Level): Level {
  return structuredClone(level);
}

/** Playground for step 4: « Le Zigzag » scrambled, to solve by hand. */
export function zigzagPuzzle(): Level {
  const level = cloneLevel(ZIGZAG);
  const [m1, m2, m3] = level.mirrors;
  if (m1) m1.angle = 0;
  if (m2) {
    m2.x = 110;
    m2.y = 300;
  }
  if (m3) m3.angle = 90;
  return level;
}
