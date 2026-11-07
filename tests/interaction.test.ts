import { describe, expect, it, vi } from 'vitest';
import { pointSegmentDistance, segmentSegmentDistance, traceRays, type Level } from '../src/engine';
import type { LogicalPointerEvent, PointerPhase } from '../src/game/input';
import { Interaction, ringRadius } from '../src/game/interaction';
import { canPlaceMirror } from '../src/game/placement';
import { ZIGZAG, cloneLevel, zigzagPuzzle } from '../src/levels';

const ev = (
  phase: PointerPhase,
  x: number,
  y: number,
  pointerType = 'touch',
): LogicalPointerEvent => ({
  phase,
  x,
  y,
  pointerType,
});

function setup(level: Level = cloneLevel(ZIGZAG)) {
  const steps: string[] = [];
  const onChange = vi.fn();
  const interaction = new Interaction(level, {
    captureRadius: () => 22,
    onAngleStep: (type) => steps.push(type),
    onChange,
  });
  return { level, interaction, steps, onChange };
}

/** Polar point around (cx, cy). */
const at = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos((deg * Math.PI) / 180),
  cy + r * Math.sin((deg * Math.PI) / 180),
];

describe('geometry helpers', () => {
  it('measures point-segment and segment-segment distances', () => {
    expect(pointSegmentDistance(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(pointSegmentDistance(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(segmentSegmentDistance(0, 0, 10, 10, 0, 10, 10, 0)).toBe(0);
    expect(segmentSegmentDistance(0, 0, 10, 0, 0, 4, 10, 4)).toBeCloseTo(4);
  });
});

describe('placement', () => {
  it('accepts every piece of the demo levels where it stands', () => {
    for (const level of [ZIGZAG, zigzagPuzzle()]) {
      level.mirrors.forEach((m, i) => {
        expect(canPlaceMirror(level, i, m.x, m.y, m.angle), m.id).toBe(true);
      });
    }
  });

  it('refuses positions off the board or over a wall', () => {
    expect(canPlaceMirror(ZIGZAG, 1, 10, 350, 0)).toBe(false); // Sticks out on the left.
    expect(canPlaceMirror(ZIGZAG, 1, 290, 260, 0)).toBe(false); // On wall w1.
    expect(canPlaceMirror(ZIGZAG, 1, 290, 265, 0)).toBe(false); // Overlapping wall w1.
    expect(canPlaceMirror(ZIGZAG, 1, 290, 270, 0)).toBe(true); // 2 units clear of it.
    expect(canPlaceMirror(ZIGZAG, 1, 290, 300, 0)).toBe(true);
  });

  it('refuses positions over another mirror, a target or an emitter', () => {
    expect(canPlaceMirror(ZIGZAG, 1, 200, 180, 45)).toBe(false);
    expect(canPlaceMirror(ZIGZAG, 1, 320, 230, 0)).toBe(false);
    expect(canPlaceMirror(ZIGZAG, 1, 60, 170, 90)).toBe(false);
  });
});

describe('Interaction', () => {
  it('selects a mirror within the capture zone and deselects on empty space', () => {
    const { interaction, onChange } = setup();
    interaction.handlePointer(ev('down', 200 + 15, 170 - 5), 0); // Near m1, not on it.
    interaction.handlePointer(ev('up', 215, 165), 0);
    expect(interaction.selected).toBe(0);
    interaction.handlePointer(ev('down', 30, 520), 0);
    interaction.handlePointer(ev('up', 30, 520), 0);
    expect(interaction.selected).toBe(-1);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('rotates with the handle, snapping to 15° and notifying each notch', () => {
    const { level, interaction, steps } = setup();
    const m = level.mirrors[0]!;
    interaction.handlePointer(ev('down', 200, 170), 0);
    interaction.handlePointer(ev('up', 200, 170), 0);
    const r = ringRadius(m);
    interaction.handlePointer(ev('down', ...at(200, 170, r, 45)), 0);
    expect(interaction.mode).toBe('rotate');
    interaction.handlePointer(ev('move', ...at(200, 170, r, 50)), 0);
    expect(m.angle).toBe(45);
    interaction.handlePointer(ev('move', ...at(200, 170, r, 66)), 0);
    expect(m.angle).toBe(60);
    interaction.handlePointer(ev('move', ...at(200, 170, r, 89)), 0);
    expect(m.angle).toBe(90);
    interaction.handlePointer(ev('up', ...at(200, 170, r, 89)), 1);
    expect(steps).toEqual(['touch', 'touch']);
    expect(interaction.history.size).toBe(1);
    expect(interaction.dropTime).toBe(1);
  });

  it('turns the ray as the mirror turns', () => {
    const { level, interaction } = setup();
    expect(traceRays(level).allTargetsHit).toBe(true);
    interaction.handlePointer(ev('down', 200, 170), 0);
    interaction.handlePointer(ev('up', 200, 170), 0);
    interaction.rotateSelected(15, 0);
    expect(interaction.dirty).toBe(true);
    expect(traceRays(level).allTargetsHit).toBe(false);
    interaction.undo();
    expect(traceRays(level).allTargetsHit).toBe(true);
  });

  it('moves movable mirrors on the 10-unit grid only', () => {
    const { level, interaction } = setup();
    const m2 = level.mirrors[1]!;
    interaction.handlePointer(ev('down', 203, 352), 0);
    expect(interaction.mode).toBe('move');
    interaction.handlePointer(ev('move', 236, 318), 0);
    expect([m2.x, m2.y]).toEqual([230, 320]);
    interaction.handlePointer(ev('up', 236, 318), 0);
    expect(interaction.history.size).toBe(1);

    // m1 is not movable: dragging it does nothing.
    const m1 = level.mirrors[0]!;
    interaction.handlePointer(ev('down', 200, 170), 0);
    expect(interaction.mode).toBe('press');
    interaction.handlePointer(ev('move', 260, 120), 0);
    interaction.handlePointer(ev('up', 260, 120), 0);
    expect([m1.x, m1.y]).toEqual([200, 170]);
  });

  it('stops a dragged mirror at a wall and at the board edge', () => {
    const { level, interaction } = setup();
    const m2 = level.mirrors[1]!;
    interaction.handlePointer(ev('down', 200, 350), 0);
    interaction.handlePointer(ev('move', 290, 300), 0);
    interaction.handlePointer(ev('move', 290, 262), 0); // Onto wall w1: refused.
    expect([m2.x, m2.y]).toEqual([290, 300]);
    interaction.handlePointer(ev('move', 380, 300), 0); // Would stick out on the right.
    expect(m2.x).toBeLessThan(380);
    interaction.handlePointer(ev('up', 380, 300), 0);
  });

  it('restores the exact previous state with undo and redo', () => {
    const { level, interaction } = setup();
    const before = structuredClone(level.mirrors);
    interaction.handlePointer(ev('down', 200, 350), 0);
    interaction.handlePointer(ev('move', 250, 420), 0);
    interaction.handlePointer(ev('up', 250, 420), 0);
    interaction.rotateSelected(-15, 0);
    interaction.rotateSelected(-15, 0);
    const after = structuredClone(level.mirrors);
    expect(after).not.toEqual(before);

    while (interaction.undo());
    expect(level.mirrors).toEqual(before);
    while (interaction.redo());
    expect(level.mirrors).toEqual(after);
  });

  it('puts the piece back when the gesture is cancelled', () => {
    const { level, interaction } = setup();
    interaction.handlePointer(ev('down', 200, 350), 0);
    interaction.handlePointer(ev('move', 250, 420), 0);
    interaction.handlePointer(ev('cancel', 250, 420), 0);
    expect([level.mirrors[1]!.x, level.mirrors[1]!.y]).toEqual([200, 350]);
    expect(interaction.history.canUndo).toBe(false);
  });

  it('ignores undo while dragging, and a tap that changes nothing', () => {
    const { interaction } = setup();
    interaction.handlePointer(ev('down', 200, 350), 0);
    expect(interaction.undo()).toBe(false);
    interaction.handlePointer(ev('up', 200, 350), 0);
    expect(interaction.history.canUndo).toBe(false);
  });

  it('gives a desktop cursor for each zone', () => {
    const { interaction } = setup();
    expect(interaction.cursorAt(30, 520)).toBe('default');
    expect(interaction.cursorAt(200, 170)).toBe('pointer'); // Rotatable only.
    expect(interaction.cursorAt(200, 350)).toBe('grab'); // Movable.
    interaction.handlePointer(ev('down', 200, 350, 'mouse'), 0);
    expect(interaction.cursorAt(200, 350)).toBe('grabbing');
  });
});

describe('keyboard play', () => {
  it('walks through the pieces with Tab, then lets the focus leave', () => {
    const { interaction } = setup();
    expect(interaction.selectNext(1)).toBe(true);
    expect(interaction.selected).toBe(0);
    expect(interaction.selectNext(1)).toBe(true);
    expect(interaction.selectNext(1)).toBe(true);
    expect(interaction.selected).toBe(2);
    expect(interaction.selectNext(1)).toBe(false);
    expect(interaction.selected).toBe(-1);
    expect(interaction.selectLast()).toBe(true);
    expect(interaction.selected).toBe(2);
    expect(interaction.selectNext(-1)).toBe(true);
    expect(interaction.selectNext(-1)).toBe(true);
    expect(interaction.selectNext(-1)).toBe(false);
  });

  it('moves a movable piece by one grid step, and refuses the others', () => {
    const { level, interaction } = setup();
    interaction.selected = 1; // m2, movable.
    expect(interaction.moveSelected(1, 0, 0)).toBe(true);
    expect([level.mirrors[1]!.x, level.mirrors[1]!.y]).toEqual([210, 350]);
    expect(interaction.history.size).toBe(1);
    interaction.selected = 0; // m1, fixed.
    expect(interaction.moveSelected(0, 1, 0)).toBe(false);
  });
});
