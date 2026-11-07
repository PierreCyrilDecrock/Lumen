import { describe, expect, it } from 'vitest';
import {
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
      schemaVersion: 1,
      levels: { r01: { stars: 2, bestRotations: 7 } },
      lastLevel: null,
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
