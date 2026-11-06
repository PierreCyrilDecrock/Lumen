import type { Interaction } from './interaction';
import { ANGLE_STEP } from './snap';

/**
 * Keyboard shortcuts: R / Shift+R and Left / Right arrows rotate the selection by
 * ±15°, Ctrl+Z undoes, Ctrl+Shift+Z (or Ctrl+Y) redoes, Escape deselects.
 * Cmd replaces Ctrl on macOS. Ignored while a form field has the focus.
 */
export function bindKeyboard(
  interaction: Interaction,
  now: () => number,
  target: Window = window,
): void {
  target.addEventListener('keydown', (e) => {
    const el = e.target;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return;
    }
    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    let handled = true;
    if (mod && key === 'z') {
      if (e.shiftKey) interaction.redo();
      else interaction.undo();
    } else if (mod && key === 'y') {
      interaction.redo();
    } else if (mod || e.altKey) {
      handled = false;
    } else if (key === 'r') {
      interaction.rotateSelected(e.shiftKey ? -ANGLE_STEP : ANGLE_STEP, now());
    } else if (key === 'arrowright') {
      interaction.rotateSelected(ANGLE_STEP, now());
    } else if (key === 'arrowleft') {
      interaction.rotateSelected(-ANGLE_STEP, now());
    } else if (key === 'escape') {
      interaction.deselect();
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  });
}
