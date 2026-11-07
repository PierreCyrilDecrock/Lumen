import { describe, expect, it } from 'vitest';
import { traceRays } from '../src/engine';
import { Interaction } from '../src/game/interaction';
import { findLevel, toEngineLevel } from '../src/levels';

function setup(id: string) {
  const def = findLevel(id)!;
  const level = toEngineLevel(def);
  const interaction = new Interaction(level, { captureRadius: () => 22 });
  return { def, level, interaction };
}

describe('tray of materials', () => {
  it('places a block from the tray, sends it back, and undoes both', () => {
    const { level, interaction } = setup('f01');
    expect(interaction.trayCounts()).toEqual({ water: 1 });
    expect(traceRays(level).allTargetsHit).toBe(false);

    expect(interaction.placeFromTray('water', 0)).toBe(true);
    const water = level.media![0]!;
    expect(water.stored).toBe(false);
    expect(interaction.trayCounts()).toEqual({});
    expect(interaction.selectedPiece).toBe(water);
    expect(traceRays(level).allTargetsHit).toBe(true); // Lands on its preferred spot.

    expect(interaction.storeSelected(0)).toBe(true);
    expect(water.stored).toBe(true);
    expect(interaction.selected).toBe(-1);

    interaction.undo();
    expect(water.stored).toBe(false);
    interaction.undo();
    expect(water.stored).toBe(true);
    interaction.redo();
    expect(water.stored).toBe(false);
  });

  it('finds a free spot when the preferred one is taken', () => {
    const { level, interaction } = setup('f02');
    expect(interaction.placeFromTray('glass', 0)).toBe(true);
    const glass = level.media!.find((m) => m.material === 'glass')!;
    expect([glass.x, glass.y]).toEqual([200, 470]);
    // Move it onto the water's landing spot, then take the water out.
    glass.x = 90;
    expect(interaction.placeFromTray('water', 0)).toBe(true);
    const water = level.media!.find((m) => m.material === 'water')!;
    expect(water.x !== 90 || water.y !== 470).toBe(true);
    expect(interaction.canPlace(interaction.indexOf('water'), water.x, water.y, water.angle)).toBe(
      true,
    );
  });

  it('refuses the tray when nothing of that material is left', () => {
    const { interaction } = setup('f01');
    interaction.placeFromTray('water', 0);
    expect(interaction.placeFromTray('water', 0)).toBe(false);
    expect(interaction.placeFromTray('diamond', 0)).toBe(false);
  });
});

describe('rotatable blocks', () => {
  it('rotates a block by 15° steps and counts it like a symmetric piece', () => {
    const { level, interaction } = setup('f03');
    const slab = level.media![0]!;
    interaction.selected = interaction.indexOf('slab');
    interaction.rotateSelected(15, 0);
    interaction.rotateSelected(15, 0);
    expect(slab.angle).toBe(30);
    expect(traceRays(level).allTargetsHit).toBe(true);
    interaction.undo();
    expect(slab.angle).toBe(15);
  });
});

describe('frosted glass slider', () => {
  it('previews live, commits one undoable change, and solves « Éventail »', () => {
    const { level, interaction } = setup('d02');
    const index = interaction.adjustableDiffuser();
    expect(index).toBeGreaterThanOrEqual(0);
    const d = level.diffusers![0]!;
    expect(d.spread).toBe(20);
    for (const value of [40, 60, 80]) interaction.setSpread(index, value, 0, false);
    expect(d.spread).toBe(80);
    expect(interaction.history.size).toBe(0);
    interaction.setSpread(index, 80, 0, true);
    expect(interaction.history.size).toBe(1);
    expect(traceRays(level).solved).toBe(true);
    interaction.undo();
    expect(d.spread).toBe(20);
    expect(traceRays(level).solved).toBe(false);
  });
});
