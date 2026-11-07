/** What the player must do to dismiss a tutorial bubble. */
export type TutorialGoal = 'select' | 'rotate';

export interface TutorialStep {
  /** Short text, no long explanations. */
  text: string;
  /** Piece the bubble points at. */
  piece: string;
  /** Point at the piece itself or at its rotation handle. */
  anchor: 'piece' | 'handle';
  /** Gesture shown in the bubble. */
  gesture: 'tap' | 'drag';
  until: TutorialGoal;
}

/** Bubbles of the first three levels. */
export const TUTORIALS: Readonly<Record<string, readonly TutorialStep[]>> = {
  r01: [
    { text: 'Touchez le miroir', piece: 'm1', anchor: 'piece', gesture: 'tap', until: 'select' },
    {
      text: 'Glissez la poignée pour le tourner',
      piece: 'm1',
      anchor: 'handle',
      gesture: 'drag',
      until: 'rotate',
    },
  ],
  r02: [
    {
      text: 'Chaque miroir tourne par crans de 15°',
      piece: 'm1',
      anchor: 'piece',
      gesture: 'drag',
      until: 'rotate',
    },
  ],
  r03: [
    {
      text: 'Côté sombre : ce miroir ne renvoie la lumière que d’un côté',
      piece: 'm3',
      anchor: 'piece',
      gesture: 'drag',
      until: 'rotate',
    },
  ],
};

/** Progress through a level's tutorial; DOM-free. */
export class Tutorial {
  private index = 0;

  constructor(private readonly steps: readonly TutorialStep[]) {}

  get current(): TutorialStep | null {
    return this.steps[this.index] ?? null;
  }

  /**
   * Advances past every step whose goal is met.
   * @param selectedId Id of the selected piece, or null.
   * @param rotations Rotations made so far.
   */
  update(selectedId: string | null, rotations: number): void {
    for (;;) {
      const step = this.current;
      if (!step) return;
      const done = step.until === 'select' ? selectedId === step.piece : rotations > 0;
      if (!done) return;
      this.index++;
    }
  }
}
