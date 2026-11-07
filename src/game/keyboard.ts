import type { Interaction } from './interaction';
import { ANGLE_STEP } from './snap';

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
 * Keyboard shortcuts: R / Shift+R and Left / Right arrows rotate the selection by
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
    let handled = true;
    if (mod && key === 'z') {
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
