/** Frames averaged before deciding. */
export const QUALITY_WINDOW = 60;
/** Average frame interval (ms) above which halo quality drops one notch. */
export const SLOW_FRAME_MS = 24;
/** Halo quality levels: 0 = full, 1 = reduced, 2 = minimal. */
export const MIN_QUALITY = 2;

/**
 * Automatic quality: when the average of the last 60 frame intervals exceeds
 * 24 ms, lowers the halo quality by one notch, then waits for a fresh window
 * before deciding again. Never raises it back (avoids oscillating).
 */
export class QualityGovernor {
  level = 0;
  private sum = 0;
  private count = 0;

  /** Feeds one frame interval in ms. Returns true when the level changed. */
  feed(intervalMs: number): boolean {
    if (!(intervalMs > 0) || intervalMs > 250) return false; // Pauses, hidden tab.
    this.sum += intervalMs;
    this.count++;
    if (this.count < QUALITY_WINDOW) return false;
    const average = this.sum / this.count;
    this.sum = 0;
    this.count = 0;
    if (average > SLOW_FRAME_MS && this.level < MIN_QUALITY) {
      this.level++;
      return true;
    }
    return false;
  }
}
