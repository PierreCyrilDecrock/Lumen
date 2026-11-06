import { describe, expect, it } from 'vitest';
import { History } from '../src/game/history';

describe('History', () => {
  it('starts empty', () => {
    const h = new History<number>();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBeUndefined();
  });

  it('undoes in reverse order and redoes in order', () => {
    const h = new History<number>();
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toBe(2);
    expect(h.redo()).toBe(3);
    expect(h.redo()).toBeUndefined();
    expect(h.size).toBe(3);
  });

  it('drops the redo branch on a new entry', () => {
    const h = new History<string>();
    h.push('a');
    h.push('b');
    h.undo();
    h.push('c');
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe('c');
    expect(h.undo()).toBe('a');
  });

  it('keeps at most `limit` entries, forgetting the oldest', () => {
    const h = new History<number>(3);
    for (let i = 1; i <= 5; i++) h.push(i);
    expect(h.size).toBe(3);
    expect([h.undo(), h.undo(), h.undo(), h.undo()]).toEqual([5, 4, 3, undefined]);
  });

  it('clears both stacks', () => {
    const h = new History<number>();
    h.push(1);
    h.push(2);
    h.undo();
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});
