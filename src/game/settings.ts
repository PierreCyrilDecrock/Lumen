/** Visual settings read by the renderer on every frame. Values are 0 to 1. */
export interface Settings {
  /** Halo and glow of the beams. Never affects the white core. */
  beamIntensity: number;
  /** Flashes at impacts, target glow and rings. */
  impactIntensity: number;
  /** Disables pulses and animated rings. */
  reducedMotion: boolean;
}

export const DEFAULT_BEAM_INTENSITY = 0.55;
export const DEFAULT_IMPACT_INTENSITY = 0.45;

export function createSettings(reducedMotion = false): Settings {
  return {
    beamIntensity: DEFAULT_BEAM_INTENSITY,
    impactIntensity: DEFAULT_IMPACT_INTENSITY,
    reducedMotion,
  };
}

export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
}

/** Initialises reducedMotion from the OS preference and follows its changes. */
export function followReducedMotion(settings: Settings): void {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  settings.reducedMotion = query.matches;
  query.addEventListener('change', () => {
    settings.reducedMotion = query.matches;
  });
}
