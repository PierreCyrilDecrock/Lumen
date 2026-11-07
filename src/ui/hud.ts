import type { Interaction } from '../game/interaction';

export interface Hud {
  /** Updates the enabled state of the buttons. */
  refresh(): void;
}

/** Wires the #undo and #redo buttons (when present) to the current board's history. */
export function bindHistoryButtons(
  interaction: () => Interaction | null,
  root: ParentNode = document,
): Hud {
  const undo = root.querySelector<HTMLButtonElement>('#undo');
  const redo = root.querySelector<HTMLButtonElement>('#redo');
  undo?.addEventListener('click', () => interaction()?.undo());
  redo?.addEventListener('click', () => interaction()?.redo());
  const hud: Hud = {
    refresh() {
      const i = interaction();
      if (undo) undo.disabled = !i?.history.canUndo || i.locked;
      if (redo) redo.disabled = !i?.history.canRedo || i.locked;
    },
  };
  hud.refresh();
  return hud;
}
