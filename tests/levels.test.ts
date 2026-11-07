import { describe, expect, it } from 'vitest';
import { MAX_RAYS, traceRays } from '../src/engine';
import { canPlace } from '../src/game/placement';
import { nextHint, solutionRotations } from '../src/game/rules';
import {
  LEVELS,
  LevelValidationError,
  ZIGZAG,
  applySolution,
  parseLevel,
  toEngineLevel,
} from '../src/levels';

describe('demo levels', () => {
  it('« Le Zigzag » reaches its target', () => {
    const r = traceRays(ZIGZAG);
    expect(r.allTargetsHit).toBe(true);
    expect(r.truncated).toBe(false);
  });
});

describe('level catalogue', () => {
  it('has unique ids and 12 reflection levels including « Le Zigzag »', () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const reflection = LEVELS.filter((l) => l.mechanic === 'reflection');
    expect(reflection).toHaveLength(12);
    expect(reflection.some((l) => l.title === 'Le Zigzag')).toBe(true);
  });

  it('has 10 refraction levels with water, glass, diamond and total reflection', () => {
    const refraction = LEVELS.filter((l) => l.mechanic === 'refraction');
    expect(refraction).toHaveLength(10);
    expect(refraction.some((l) => l.title === 'Trois milieux')).toBe(true);
    const materials = new Set(
      refraction.flatMap((l) => l.pieces.flatMap((p) => (p.type === 'medium' ? [p.material] : []))),
    );
    expect([...materials].sort()).toEqual(['diamond', 'glass', 'water']);
    const withTotalReflection = refraction.filter((def) =>
      traceRays(applySolution(def, toEngineLevel(def))).impacts.some(
        (i) => i.kind === 'totalReflection' && i.intensity === 1,
      ),
    );
    expect(withTotalReflection.length).toBeGreaterThanOrEqual(2);
  });

  it('has 10 diffusion levels including « La grotte aux cristaux »', () => {
    const diffusion = LEVELS.filter((l) => l.mechanic === 'diffusion');
    expect(diffusion).toHaveLength(10);
    expect(diffusion.some((l) => l.title === 'La grotte aux cristaux')).toBe(true);
    expect(diffusion.every((l) => l.crystals.length > 0)).toBe(true);
    expect(diffusion.some((l) => l.pieces.some((p) => p.type === 'fog'))).toBe(true);
  });

  it('has 12 dispersion levels including « Arc-en-ciel » and « Mélange »', () => {
    const dispersion = LEVELS.filter((l) => l.mechanic === 'dispersion');
    expect(dispersion).toHaveLength(12);
    const rainbow = dispersion.find((l) => l.title === 'Arc-en-ciel')!;
    expect(new Set(rainbow.colorTargets.map((t) => t.color)).size).toBe(6);
    const mix = dispersion.find((l) => l.title === 'Mélange')!;
    expect(mix.colorTargets.map((t) => t.color)).toEqual(['yellow']);
  });

  describe.each(LEVELS.map((l) => [`${l.id} ${l.title}`, l] as const))('%s', (_, def) => {
    it('is not already solved at the start', () => {
      expect(traceRays(toEngineLevel(def)).solved).toBe(false);
    });

    it('is solved by its reference solution', () => {
      const level = applySolution(def, toEngineLevel(def));
      const result = traceRays(level);
      expect(result.solved).toBe(true);
      expect(result.rayCount).toBeLessThanOrEqual(MAX_RAYS);
      expect(nextHint(def, level)).toBeNull();
    });

    it('has every mirror legally placed, at the start and once solved', () => {
      for (const level of [toEngineLevel(def), applySolution(def, toEngineLevel(def))]) {
        level.mirrors.forEach((m, i) => {
          expect(canPlace(level, 'mirror', i, m.x, m.y, m.angle), m.id).toBe(true);
        });
        level.media?.forEach((m, i) => {
          if (m.stored !== true)
            expect(canPlace(level, 'medium', i, m.x, m.y, m.angle), m.id).toBe(true);
        });
      }
    });

    it('makes 3 stars reachable with the reference solution', () => {
      expect(solutionRotations(def)).toBeLessThanOrEqual(def.stars[0]);
    });

    it('hints at the first piece of the solution at the start', () => {
      const level = toEngineLevel(def);
      const first = def.solution[0]!.piece;
      expect(nextHint(def, level)?.id).toBe(first);
    });
  });
});

describe('parseLevel', () => {
  const valid = {
    id: 'x',
    title: 'Test',
    mechanic: 'reflection',
    board: { width: 390, height: 560 },
    emitters: [{ id: 'e', x: 10, y: 10, angle: 0 }],
    targets: [{ id: 't', x: 100, y: 10 }],
    pieces: [{ type: 'mirror', id: 'm', x: 50, y: 50, angle: 45 }],
    stars: [3, 5],
    solution: [{ piece: 'm', angle: 90 }],
  };

  it('accepts a valid level and fills defaults in the engine level', () => {
    const def = parseLevel(valid);
    const level = toEngineLevel(def);
    expect(level.mirrors[0]!.length).toBe(40);
    expect(level.targets[0]!.radius).toBe(12);
  });

  it('lists every problem with its path', () => {
    const broken = {
      ...valid,
      mechanic: 'magic',
      emitters: [{ id: 'e', x: 'a', y: 10, angle: 0 }],
      pieces: [
        { type: 'mirror', id: 'm', x: 50, y: 900, angle: 40 },
        { type: 'laser', id: 'z', x: 1, y: 1, angle: 0 },
        { type: 'wall', id: 'm', x: 1, y: 1, angle: 0, length: 5 },
      ],
      stars: [5, 3],
      solution: [{ piece: 'nope', angle: 90 }],
    };
    try {
      parseLevel(broken, 'broken.json');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LevelValidationError);
      const msg = (e as Error).message;
      expect(msg).toContain('broken.json.mechanic');
      expect(msg).toContain('emitters[0].x : nombre attendu');
      expect(msg).toContain('pieces[0].y : doit être entre 0 et 560');
      expect(msg).toContain('pieces[0].angle : multiple de 15° attendu');
      expect(msg).toContain('type de pièce inconnu « laser »');
      expect(msg).toContain('identifiant « m » en double');
      expect(msg).toContain('stars');
      expect(msg).toContain('aucune pièce mobile « nope »');
    }
  });

  it('rejects a solution that moves a fixed mirror', () => {
    expect(() => parseLevel({ ...valid, solution: [{ piece: 'm', x: 60 }] })).toThrow(
      /ne se déplace pas/,
    );
  });

  it('rejects something that is not an object', () => {
    expect(() => parseLevel(42)).toThrow(LevelValidationError);
  });
});
