/** Versioned save in localStorage: one JSON object. Every access is defensive. */

export const SAVE_KEY = 'lumen.save';
export const SCHEMA_VERSION = 2;

export interface LevelProgress {
  /** Best stars earned, 1 to 3. */
  stars: number;
  /** Fewest rotations used to finish. */
  bestRotations: number;
}

export interface SavedSettings {
  /** 0 to 1. */
  beamIntensity: number;
  /** 0 to 1. */
  impactIntensity: number;
  /** null: follow the system preference (prefers-reduced-motion). */
  reducedMotion: boolean | null;
  /** Sound effects on. */
  sound: boolean;
  /** Colour-blind mode: a symbol for each colour on targets and filters. */
  colorSymbols: boolean;
}

export interface SaveData {
  schemaVersion: number;
  settings: SavedSettings;
  levels: Record<string, LevelProgress>;
  lastLevel: string | null;
}

/** Minimal Storage interface, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_SAVED_SETTINGS: Readonly<SavedSettings> = {
  beamIntensity: 0.6,
  impactIntensity: 0.6,
  reducedMotion: null,
  sound: true,
  colorSymbols: false,
};

export function emptySave(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SAVED_SETTINGS },
    levels: {},
    lastLevel: null,
  };
}

/** The browser storage, or null when it is unavailable (privacy mode, sandbox…). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const unit = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : fallback;

/** Keeps only well-formed level entries. */
function sanitizeLevels(raw: unknown): Record<string, LevelProgress> {
  const out: Record<string, LevelProgress> = {};
  if (!isRecord(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const stars = value.stars;
    const best = value.bestRotations;
    if (typeof stars !== 'number' || stars < 1 || stars > 3) continue;
    out[id] = {
      stars: Math.round(stars),
      bestRotations: typeof best === 'number' && best >= 0 ? best : 0,
    };
  }
  return out;
}

function sanitizeSettings(raw: unknown): SavedSettings {
  const s = isRecord(raw) ? raw : {};
  return {
    beamIntensity: unit(s.beamIntensity, DEFAULT_SAVED_SETTINGS.beamIntensity),
    impactIntensity: unit(s.impactIntensity, DEFAULT_SAVED_SETTINGS.impactIntensity),
    reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : null,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SAVED_SETTINGS.sound,
    colorSymbols:
      typeof s.colorSymbols === 'boolean' ? s.colorSymbols : DEFAULT_SAVED_SETTINGS.colorSymbols,
  };
}

/**
 * Turns any parsed JSON into a current save, or null when it cannot be read
 * (unknown or future version, wrong shape). Version 1 had no settings.
 */
export function migrate(raw: unknown): SaveData | null {
  if (!isRecord(raw) || typeof raw.schemaVersion !== 'number') return null;
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    settings:
      raw.schemaVersion === 1 ? { ...DEFAULT_SAVED_SETTINGS } : sanitizeSettings(raw.settings),
    levels: sanitizeLevels(raw.levels),
    lastLevel: typeof raw.lastLevel === 'string' ? raw.lastLevel : null,
  };
}

/** Reads the save; falls back to an empty one on any problem. */
export function loadSave(storage: StorageLike | null = browserStorage()): SaveData {
  if (!storage) return emptySave();
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return emptySave();
    return migrate(JSON.parse(text)) ?? emptySave();
  } catch {
    return emptySave();
  }
}

/** Writes the save. Returns false when the storage refused it (full, blocked…). */
export function writeSave(data: SaveData, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Records a finished level, keeping the best stars and rotation count. */
export function recordResult(
  data: SaveData,
  levelId: string,
  stars: number,
  rotations: number,
): SaveData {
  const previous = data.levels[levelId];
  data.levels[levelId] = {
    stars: Math.max(stars, previous?.stars ?? 0),
    bestRotations: Math.min(rotations, previous?.bestRotations ?? Infinity),
  };
  data.lastLevel = levelId;
  return data;
}

export function isCompleted(data: SaveData, levelId: string): boolean {
  return (data.levels[levelId]?.stars ?? 0) > 0;
}
