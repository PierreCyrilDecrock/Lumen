import type { Interaction } from './interaction';
import { ANGLE_STEP } from './snap';
import { isMovable } from './interaction';

export interface KeyboardActions {
  /** Current board, or null when no level is being played. */
  interaction(): Interaction | null;
  now(): number;
  /** Escape with nothing selected. */
  onPause?(): void;
  /** H key. */
  onHint?(): void;
}

/**
 * Keyboard play: Tab / Shift+Tab on the board choose a piece, arrows move it on
 * the grid (or turn it, Left / Right, when it cannot move), R / Shift+R turn it by
 * ±15°, Ctrl+Z undoes, Ctrl+Shift+Z (or Ctrl+Y) redoes, Escape deselects (or
 * pauses), H shows a hint. Cmd replaces Ctrl on macOS. Ignored while a form
 * field has the focus.
 */
export function bindKeyboard(actions: KeyboardActions, target: Window = window): void {
  target.addEventListener('keydown', (e) => {
    const el = e.target;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return;
    }
    const interaction = actions.interaction();
    if (!interaction) return;
    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const now = actions.now();
    const onBoard = el instanceof HTMLCanvasElement;
    const movable = (): boolean => {
      const p = interaction.selectedPiece;
      return !!p && isMovable(p);
    };
    let handled = true;
    if (key === 'tab' && !mod && !e.altKey) {
      // On the board, Tab walks through the pieces, then lets the focus leave.
      if (!onBoard) return;
      const moved =
        e.shiftKey && interaction.selected < 0
          ? interaction.selectLast()
          : interaction.selectNext(e.shiftKey ? -1 : 1);
      if (!moved) return;
    } else if (key.startsWith('arrow') && !mod && movable()) {
      const dx = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0;
      const dy = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0;
      interaction.moveSelected(dx, dy, now);
    } else if (mod && key === 'z') {
      if (e.shiftKey) interaction.redo();
      else interaction.undo();
    } else if (mod && key === 'y') {
      interaction.redo();
    } else if (mod || e.altKey) {
      handled = false;
    } else if (key === 'r') {
      interaction.rotateSelected(e.shiftKey ? -ANGLE_STEP : ANGLE_STEP, now);
    } else if (key === 'arrowright') {
      interaction.rotateSelected(ANGLE_STEP, now);
    } else if (key === 'arrowleft') {
      interaction.rotateSelected(-ANGLE_STEP, now);
    } else if (key === 'escape') {
      if (interaction.selected >= 0) interaction.deselect();
      else if (actions.onPause) actions.onPause();
      else handled = false;
    } else if (key === 'h' && actions.onHint) {
      actions.onHint();
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  });
}
