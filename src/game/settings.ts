/** Visual settings read by the renderer on every frame. Intensities are 0 to 1. */
export interface Settings {
  /** Halo and glow of the beams. Never affects the beam core. */
  beamIntensity: number;
  /** Flashes at impacts, glows and rings. */
  impactIntensity: number;
  /** Disables pulses and animated rings. */
  reducedMotion: boolean;
}

export const DEFAULT_BEAM_INTENSITY = 0.6;
export const DEFAULT_IMPACT_INTENSITY = 0.6;

/** Presets shown on the settings screen. */
export const PRESETS = {
  doux: { label: 'Doux', beamIntensity: 0.3, impactIntensity: 0.3 },
  normal: { label: 'Normal', beamIntensity: 0.6, impactIntensity: 0.6 },
  intense: { label: 'Intense', beamIntensity: 1, impactIntensity: 1 },
} as const;

export type PresetName = keyof typeof PRESETS;

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

export function applyPreset(settings: Settings, name: PresetName): void {
  settings.beamIntensity = PRESETS[name].beamIntensity;
  settings.impactIntensity = PRESETS[name].impactIntensity;
}

/** The preset matching the current intensities, or null. */
export function currentPreset(settings: Settings): PresetName | null {
  for (const name of Object.keys(PRESETS) as PresetName[]) {
    const p = PRESETS[name];
    if (
      Math.abs(p.beamIntensity - settings.beamIntensity) < 0.005 &&
      Math.abs(p.impactIntensity - settings.impactIntensity) < 0.005
    ) {
      return name;
    }
  }
  return null;
}

/**
 * Sets reducedMotion from the player's choice, or from prefers-reduced-motion
 * while the player has not chosen (`choice()` returns null); follows changes.
 */
export function followReducedMotion(
  settings: Settings,
  choice: () => boolean | null = () => null,
): void {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  settings.reducedMotion = choice() ?? query.matches;
  query.addEventListener('change', () => {
    settings.reducedMotion = choice() ?? query.matches;
  });
}

/** True when the system asks for reduced motion. */
export function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
