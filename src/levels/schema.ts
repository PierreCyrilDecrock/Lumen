import type { Level, Mirror, Target, Wall } from '../engine';

/** Chapters of the game, in play order. */
export const MECHANICS = ['reflection', 'refraction', 'diffusion', 'dispersion'] as const;
export type Mechanic = (typeof MECHANICS)[number];

export const DEFAULT_MIRROR_LENGTH = 40;
export const DEFAULT_TARGET_RADIUS = 12;

export interface EmitterDef {
  id: string;
  x: number;
  y: number;
  angle: number;
}

export interface TargetDef {
  id: string;
  x: number;
  y: number;
  radius?: number;
  passThrough?: boolean;
}

export interface MirrorDef {
  type: 'mirror';
  id: string;
  x: number;
  y: number;
  angle: number;
  length?: number;
  rotatable?: boolean;
  movable?: boolean;
  doubleSided?: boolean;
}

export interface WallDef {
  type: 'wall';
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
}

export type PieceDef = MirrorDef | WallDef;

/** One step of the reference solution: final pose of a piece. */
export interface SolutionStep {
  piece: string;
  angle?: number;
  x?: number;
  y?: number;
}

/** A level as stored in JSON. Coordinates are logical units, angles degrees. */
export interface LevelDefinition {
  id: string;
  title: string;
  mechanic: Mechanic;
  board: { width: number; height: number };
  emitters: EmitterDef[];
  targets: TargetDef[];
  pieces: PieceDef[];
  /** Maximum rotations (15° steps) for 3 and for 2 stars; finishing gives at least 1. */
  stars: [number, number];
  /** Reference solution, in the order hints reveal it. */
  solution: SolutionStep[];
}

export class LevelValidationError extends Error {
  constructor(
    readonly levelId: string,
    readonly problems: string[],
  ) {
    super(`Niveau « ${levelId} » invalide :\n- ${problems.join('\n- ')}`);
    this.name = 'LevelValidationError';
  }
}

type Json = Record<string, unknown>;

/** Collects every problem instead of stopping at the first one. */
class Checker {
  readonly problems: string[] = [];

  fail(path: string, message: string): void {
    this.problems.push(`${path} : ${message}`);
  }

  object(value: unknown, path: string): Json | null {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Json;
    this.fail(path, 'objet attendu');
    return null;
  }

  array(value: unknown, path: string): unknown[] {
    if (Array.isArray(value)) return value;
    this.fail(path, 'liste attendue');
    return [];
  }

  string(obj: Json, key: string, path: string): string {
    const v = obj[key];
    if (typeof v === 'string' && v.length > 0) return v;
    this.fail(`${path}.${key}`, 'texte non vide attendu');
    return '';
  }

  number(obj: Json, key: string, path: string, min = -Infinity, max = Infinity): number {
    const v = obj[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.fail(`${path}.${key}`, 'nombre attendu');
      return 0;
    }
    if (v < min || v > max) this.fail(`${path}.${key}`, `doit être entre ${min} et ${max} (${v})`);
    return v;
  }

  optionalNumber(obj: Json, key: string, path: string, min = -Infinity): number | undefined {
    return obj[key] === undefined ? undefined : this.number(obj, key, path, min);
  }

  optionalBoolean(obj: Json, key: string, path: string): boolean | undefined {
    const v = obj[key];
    if (v === undefined || typeof v === 'boolean') return v;
    this.fail(`${path}.${key}`, 'booléen attendu');
    return undefined;
  }
}

/** `T` where properties that may be undefined become optional instead. */
type Compact<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

/** Removes undefined fields so optional properties stay truly absent. */
function compact<T extends object>(obj: T): Compact<T> {
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
}

/**
 * Validates raw JSON and returns a typed level. Throws a LevelValidationError
 * listing every problem with its path (e.g. `pieces[2].angle : nombre attendu`).
 */
export function parseLevel(raw: unknown, source = 'niveau'): LevelDefinition {
  const c = new Checker();
  const root = c.object(raw, source) ?? {};
  const id = c.string(root, 'id', source);
  const title = c.string(root, 'title', source);
  const mechanic = root.mechanic as Mechanic;
  if (!MECHANICS.includes(mechanic)) {
    c.fail(`${source}.mechanic`, `une valeur parmi ${MECHANICS.join(', ')} attendue`);
  }

  const boardRaw = c.object(root.board, `${source}.board`) ?? {};
  const board = {
    width: c.number(boardRaw, 'width', 'board', 50, 4000),
    height: c.number(boardRaw, 'height', 'board', 50, 4000),
  };
  const inX = (o: Json, path: string): number => c.number(o, 'x', path, 0, board.width);
  const inY = (o: Json, path: string): number => c.number(o, 'y', path, 0, board.height);

  const ids = new Set<string>();
  const claimId = (o: Json, path: string): string => {
    const pieceId = c.string(o, 'id', path);
    if (pieceId && ids.has(pieceId)) c.fail(`${path}.id`, `identifiant « ${pieceId} » en double`);
    ids.add(pieceId);
    return pieceId;
  };

  const emitters = c.array(root.emitters, 'emitters').map((e, i): EmitterDef => {
    const path = `emitters[${i}]`;
    const o = c.object(e, path) ?? {};
    return {
      id: claimId(o, path),
      x: inX(o, path),
      y: inY(o, path),
      angle: c.number(o, 'angle', path),
    };
  });
  if (emitters.length === 0) c.fail('emitters', 'au moins un émetteur attendu');

  const targets = c.array(root.targets, 'targets').map((t, i): TargetDef => {
    const path = `targets[${i}]`;
    const o = c.object(t, path) ?? {};
    return compact({
      id: claimId(o, path),
      x: inX(o, path),
      y: inY(o, path),
      radius: c.optionalNumber(o, 'radius', path, 4),
      passThrough: c.optionalBoolean(o, 'passThrough', path),
    });
  });
  if (targets.length === 0) c.fail('targets', 'au moins une cible attendue');

  const pieces = c.array(root.pieces, 'pieces').flatMap((p, i): PieceDef[] => {
    const path = `pieces[${i}]`;
    const o = c.object(p, path) ?? {};
    const base = {
      id: claimId(o, path),
      x: inX(o, path),
      y: inY(o, path),
      angle: c.number(o, 'angle', path),
    };
    if (o.type === 'mirror') {
      if (base.angle % 15 !== 0) c.fail(`${path}.angle`, 'multiple de 15° attendu');
      return [
        compact({
          type: 'mirror' as const,
          ...base,
          length: c.optionalNumber(o, 'length', path, 10),
          rotatable: c.optionalBoolean(o, 'rotatable', path),
          movable: c.optionalBoolean(o, 'movable', path),
          doubleSided: c.optionalBoolean(o, 'doubleSided', path),
        }),
      ];
    }
    if (o.type === 'wall') {
      return [{ type: 'wall', ...base, length: c.number(o, 'length', path, 1) }];
    }
    c.fail(`${path}.type`, `type de pièce inconnu « ${String(o.type)} »`);
    return [];
  });

  const starsRaw = c.array(root.stars, 'stars');
  const three = typeof starsRaw[0] === 'number' ? starsRaw[0] : NaN;
  const two = typeof starsRaw[1] === 'number' ? starsRaw[1] : NaN;
  if (starsRaw.length !== 2 || !(three >= 0) || !(two >= three)) {
    c.fail('stars', '[rotations pour 3 étoiles, rotations pour 2 étoiles] attendu, croissant');
  }

  const solution = c.array(root.solution, 'solution').map((s, i): SolutionStep => {
    const path = `solution[${i}]`;
    const o = c.object(s, path) ?? {};
    const piece = c.string(o, 'piece', path);
    const mirror = pieces.find((p): p is MirrorDef => p.type === 'mirror' && p.id === piece);
    if (piece && !mirror) c.fail(`${path}.piece`, `aucun miroir « ${piece} »`);
    const step = compact({
      piece,
      angle: c.optionalNumber(o, 'angle', path),
      x: c.optionalNumber(o, 'x', path),
      y: c.optionalNumber(o, 'y', path),
    });
    if (step.angle !== undefined && step.angle % 15 !== 0)
      c.fail(`${path}.angle`, 'multiple de 15° attendu');
    if (mirror && step.angle !== undefined && mirror.rotatable === false) {
      c.fail(`${path}.angle`, `le miroir « ${piece} » ne tourne pas`);
    }
    if (mirror && (step.x !== undefined || step.y !== undefined) && mirror.movable !== true) {
      c.fail(path, `le miroir « ${piece} » ne se déplace pas`);
    }
    return step;
  });
  if (solution.length === 0) c.fail('solution', 'au moins une étape attendue');

  if (c.problems.length > 0) throw new LevelValidationError(id || source, c.problems);
  return {
    id,
    title,
    mechanic,
    board,
    emitters,
    targets,
    pieces,
    stars: [three, two],
    solution,
  };
}

/** Builds the mutable engine level for a definition (fresh objects every call). */
export function toEngineLevel(def: LevelDefinition): Level {
  const mirrors: Mirror[] = [];
  const walls: Wall[] = [];
  for (const p of def.pieces) {
    if (p.type === 'mirror') {
      const { type: _type, length, ...rest } = p;
      mirrors.push({ ...rest, length: length ?? DEFAULT_MIRROR_LENGTH });
    } else {
      const { type: _type, ...rest } = p;
      walls.push({ ...rest });
    }
  }
  const targets: Target[] = def.targets.map((t) => ({
    ...t,
    radius: t.radius ?? DEFAULT_TARGET_RADIUS,
  }));
  return {
    width: def.board.width,
    height: def.board.height,
    emitters: def.emitters.map((e) => ({ ...e })),
    mirrors,
    walls,
    targets,
  };
}

/** Applies the reference solution to an engine level built from `def`. */
export function applySolution(def: LevelDefinition, level: Level): Level {
  for (const step of def.solution) {
    const m = level.mirrors.find((mirror) => mirror.id === step.piece);
    if (!m) continue;
    if (step.angle !== undefined) m.angle = step.angle;
    if (step.x !== undefined) m.x = step.x;
    if (step.y !== undefined) m.y = step.y;
  }
  return level;
}
