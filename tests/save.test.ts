import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAVED_SETTINGS,
  SAVE_KEY,
  emptySave,
  isCompleted,
  loadSave,
  migrate,
  recordResult,
  writeSave,
  type StorageLike,
} from '../src/storage';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('save', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const save = recordResult(emptySave(), 'r01', 3, 3);
    expect(writeSave(save, storage)).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded).toEqual(save);
    expect(isCompleted(loaded, 'r01')).toBe(true);
    expect(isCompleted(loaded, 'r02')).toBe(false);
  });

  it('keeps the best result', () => {
    const save = emptySave();
    recordResult(save, 'r01', 2, 8);
    recordResult(save, 'r01', 1, 5);
    recordResult(save, 'r01', 3, 12);
    expect(save.levels.r01).toEqual({ stars: 3, bestRotations: 5 });
    expect(save.lastLevel).toBe('r01');
  });

  it('starts empty on missing, corrupt or unknown data', () => {
    const storage = new MemoryStorage();
    expect(loadSave(storage)).toEqual(emptySave());
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadSave(storage)).toEqual(emptySave());
    storage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 99, levels: {} }));
    expect(loadSave(storage)).toEqual(emptySave());
    storage.setItem(SAVE_KEY, '"hello"');
    expect(loadSave(storage)).toEqual(emptySave());
  });

  it('drops malformed level entries but keeps the good ones', () => {
    const save = migrate({
      schemaVersion: 1,
      levels: {
        r01: { stars: 2, bestRotations: 7 },
        r02: { stars: 'x' },
        r03: 4,
        r04: { stars: 9 },
      },
      lastLevel: 12,
    });
    expect(save).toEqual({
      schemaVersion: 2,
      settings: DEFAULT_SAVED_SETTINGS,
      levels: { r01: { stars: 2, bestRotations: 7 } },
      lastLevel: null,
    });
  });

  it('migrates a version 1 save, adding default settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        levels: { r01: { stars: 3, bestRotations: 3 } },
        lastLevel: 'r01',
      }),
    );
    const save = loadSave(storage);
    expect(save.schemaVersion).toBe(2);
    expect(save.settings).toEqual(DEFAULT_SAVED_SETTINGS);
    expect(save.levels.r01).toEqual({ stars: 3, bestRotations: 3 });
    expect(save.lastLevel).toBe('r01');
  });

  it('round-trips the settings and repairs corrupt values', () => {
    const storage = new MemoryStorage();
    const save = emptySave();
    save.settings = {
      beamIntensity: 0.3,
      impactIntensity: 1,
      reducedMotion: true,
      sound: false,
      colorSymbols: true,
    };
    writeSave(save, storage);
    expect(loadSave(storage).settings).toEqual(save.settings);

    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        settings: { beamIntensity: 7, impactIntensity: 'x', reducedMotion: 'no' },
      }),
    );
    expect(loadSave(storage).settings).toEqual({
      ...DEFAULT_SAVED_SETTINGS,
      beamIntensity: 1,
      impactIntensity: DEFAULT_SAVED_SETTINGS.impactIntensity,
      reducedMotion: null,
    });
  });

  it('survives a storage that throws or is missing', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadSave(broken)).toEqual(emptySave());
    expect(writeSave(emptySave(), broken)).toBe(false);
    expect(loadSave(null)).toEqual(emptySave());
    expect(writeSave(emptySave(), null)).toBe(false);
  });
});
