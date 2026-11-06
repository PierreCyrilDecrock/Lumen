import { describe, expect, it } from 'vitest';
import { traceRays } from '../src/engine';
import { ZIGZAG } from '../src/levels';

describe('demo levels', () => {
  it('« Le Zigzag » reaches its target', () => {
    const r = traceRays(ZIGZAG);
    expect(r.allTargetsHit).toBe(true);
    expect(r.truncated).toBe(false);
  });
});
