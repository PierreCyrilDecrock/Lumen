import { describe, expect, it } from 'vitest';
import { parentOf, parseHash, toHash } from '../src/ui/router';

describe('routes', () => {
  it('round-trips hashes', () => {
    for (const hash of ['#/', '#/niveaux', '#/niveau/r03']) {
      expect(toHash(parseHash(hash))).toBe(hash);
    }
  });

  it('falls back to the menu on unknown hashes', () => {
    expect(parseHash('')).toEqual({ name: 'menu' });
    expect(parseHash('#/nimporte/quoi')).toEqual({ name: 'menu' });
    expect(parseHash('#/niveau/')).toEqual({ name: 'menu' });
  });

  it('knows the parent screen', () => {
    expect(parentOf({ name: 'play', id: 'r01' })).toEqual({ name: 'levels' });
    expect(parentOf({ name: 'levels' })).toEqual({ name: 'menu' });
    expect(parentOf({ name: 'menu' })).toBeNull();
  });
});
