import { parseLevel, type LevelDefinition, type Mechanic } from './schema';

/** Chapter titles shown to the player. */
export const CHAPTER_TITLES: Record<Mechanic, string> = {
  reflection: 'Réflexion',
  refraction: 'Réfraction',
  diffusion: 'Diffusion',
  dispersion: 'Dispersion',
};

const CHAPTER_ORDER: Record<string, number> = {
  reflection: 0,
  refraction: 1,
  diffusion: 2,
  dispersion: 3,
};

const files = import.meta.glob<unknown>('./*/*.json', { eager: true, import: 'default' });

/**
 * Every level, validated at load time, in play order: chapter folder order
 * (reflection, refraction…) then file name order.
 */
export const LEVELS: readonly LevelDefinition[] = Object.keys(files)
  .sort(compareLevelPaths)
  .map((path) => parseLevel(files[path], path));

function compareLevelPaths(a: string, b: string): number {
  const ca = CHAPTER_ORDER[a.split('/')[1] ?? ''] ?? 99;
  const cb = CHAPTER_ORDER[b.split('/')[1] ?? ''] ?? 99;
  return ca - cb || a.localeCompare(b);
}

export function findLevel(id: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}

/** Level that follows `id`, or undefined for the last one. */
export function nextLevel(id: string): LevelDefinition | undefined {
  const i = levelIndex(id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
