/**
 * Generated sounds (Web Audio, no files): piece click, rotation notch, crystal
 * chime and victory chord. The audio context starts on the first user gesture,
 * as mobile browsers require.
 */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Creates or resumes the audio context; call from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext as typeof AudioContext | undefined;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** Unlocks audio on the first pointer or key press. */
  bindUnlock(target: Document = document): void {
    const unlock = (): void => {
      this.unlock();
      if (this.ctx) {
        target.removeEventListener('pointerdown', unlock);
        target.removeEventListener('keydown', unlock);
      }
    };
    target.addEventListener('pointerdown', unlock);
    target.addEventListener('keydown', unlock);
  }

  /** A piece is put down or turned. */
  click(): void {
    this.tone({ type: 'triangle', from: 880, to: 520, attack: 0.002, decay: 0.07, volume: 0.12 });
  }

  /** One 15° notch while turning. */
  notch(): void {
    this.tone({ type: 'sine', from: 1500, to: 1300, attack: 0.001, decay: 0.025, volume: 0.04 });
  }

  /** A crystal or a target lights up. */
  chime(): void {
    this.tone({ type: 'sine', from: 1320, to: 1320, attack: 0.005, decay: 0.9, volume: 0.07 });
    this.tone({ type: 'sine', from: 1980, to: 1980, attack: 0.005, decay: 0.6, volume: 0.035 });
  }

  /** Every target is lit: a soft major arpeggio. */
  victory(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone({
        type: 'sine',
        from: f,
        to: f,
        attack: 0.01,
        decay: 1.3,
        volume: 0.07,
        delay: i * 0.09,
      });
      this.tone({
        type: 'triangle',
        from: f / 2,
        to: f / 2,
        attack: 0.01,
        decay: 0.9,
        volume: 0.03,
        delay: i * 0.09,
      });
    });
  }

  private tone(o: {
    type: OscillatorType;
    from: number;
    to: number;
    attack: number;
    decay: number;
    volume: number;
    delay?: number;
  }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!this.enabled || !ctx || !master || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.from, t0);
    if (o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.attack + o.decay);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(o.volume, t0 + o.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.attack + o.decay);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.attack + o.decay + 0.02);
  }
}
