const SAMPLES = 60;
const MAX_INTERVAL = 250;

/** Rolling frame timings: CPU time spent per frame and interval between frames. */
export class FrameStats {
  private readonly work = new Float64Array(SAMPLES);
  private readonly interval = new Float64Array(SAMPLES);
  private index = 0;
  private count = 0;
  private intervalIndex = 0;
  private intervalCount = 0;
  private frameStart = 0;
  private lastStart = -1;

  begin(now: number): void {
    // Ignore the gap after a pause (hidden tab) so fps is not skewed.
    const gap = now - this.lastStart;
    if (this.lastStart >= 0 && gap < MAX_INTERVAL) {
      this.interval[this.intervalIndex] = gap;
      this.intervalIndex = (this.intervalIndex + 1) % SAMPLES;
      if (this.intervalCount < SAMPLES) this.intervalCount++;
    }
    this.lastStart = now;
    this.frameStart = now;
  }

  end(now: number): void {
    this.work[this.index] = now - this.frameStart;
    this.index = (this.index + 1) % SAMPLES;
    if (this.count < SAMPLES) this.count++;
  }

  /** Average CPU time per frame, in ms. */
  get averageWork(): number {
    return average(this.work, this.count);
  }

  /** Worst CPU time per frame over the window, in ms. */
  get maxWork(): number {
    let max = 0;
    for (let i = 0; i < this.count; i++) max = Math.max(max, this.work[i]!);
    return max;
  }

  /** Frames per second from the average interval. */
  get fps(): number {
    const avg = average(this.interval, this.intervalCount);
    return avg > 0 ? 1000 / avg : 0;
  }
}

function average(values: Float64Array, count: number): number {
  if (count === 0) return 0;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += values[i]!;
  return sum / count;
}
