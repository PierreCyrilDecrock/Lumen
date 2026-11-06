import type { Level } from '../engine';

/**
 * « Le Zigzag », demo version: three mirrors lead the ray to the target.
 * The full level format arrives in step 5.
 */
export const ZIGZAG: Level = {
  width: 390,
  height: 560,
  emitters: [{ id: 'source', x: 54, y: 170, angle: 0 }],
  mirrors: [
    { id: 'm1', x: 200, y: 170, angle: 45, length: 40 },
    { id: 'm2', x: 200, y: 350, angle: 45, length: 40 },
    { id: 'm3', x: 320, y: 350, angle: 135, length: 40, doubleSided: false },
  ],
  walls: [
    { id: 'w1', x: 290, y: 260, angle: 0, length: 50 },
    { id: 'w2', x: 110, y: 440, angle: 90, length: 70 },
  ],
  targets: [{ id: 'goal', x: 320, y: 230, radius: 12 }],
};
