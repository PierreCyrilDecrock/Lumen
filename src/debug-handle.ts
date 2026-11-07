import type { GameView } from './game-view';
import type { SaveData } from './storage';

declare global {
  interface Window {
    /** Game state handle for end-to-end tests and debugging in the console. */
    __lumen?: { game: GameView; save?: SaveData };
  }
}

export {};
