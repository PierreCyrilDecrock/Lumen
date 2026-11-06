import type { Interaction } from '../game/interaction';

export interface Hud {
  /** Updates the enabled state of the buttons. */
  refresh(): void;
}

/** Wires the #undo and #redo buttons (when present) to the interaction history. */
export function bindHistoryButtons(interaction: Interaction, root: ParentNode = document): Hud {
  const undo = root.querySelector<HTMLButtonElement>('#undo');
  const redo = root.querySelector<HTMLButtonElement>('#redo');
  undo?.addEventListener('click', () => interaction.undo());
  redo?.addEventListener('click', () => interaction.redo());
  const hud: Hud = {
    refresh() {
      if (undo) undo.disabled = !interaction.history.canUndo;
      if (redo) redo.disabled = !interaction.history.canRedo;
    },
  };
  hud.refresh();
  return hud;
}
