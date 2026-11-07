/** Rotation step of the pieces, in degrees. */
export const ANGLE_STEP = 15;
/** Movement grid, in logical units. */
export const GRID_STEP = 10;

/** Angle in [0, 360). */
export function normalizeAngle(degrees: number): number {
  const a = degrees % 360;
  return a < 0 ? a + 360 : a === 0 ? 0 : a; // Also turns -0 into 0.
}

/** Nearest multiple of `step`, normalised to [0, 360). */
export function snapAngle(degrees: number, step = ANGLE_STEP): number {
  return normalizeAngle(Math.round(degrees / step) * step);
}

/** Nearest multiple of `step`. */
export function snapToGrid(value: number, step = GRID_STEP): number {
  return Math.round(value / step) * step + 0;
}

/**
 * Angle shown to the player, within the piece's rotation period: a double-sided
 * mirror looks the same after a half turn, so it is shown in [0, 180).
 * `true` / `false` stand for periods of 180° / 360°.
 */
export function displayAngle(degrees: number, period: number | boolean): number {
  const p = period === true ? 180 : period === false ? 360 : period;
  return normalizeAngle(Math.round(degrees)) % p;
}
