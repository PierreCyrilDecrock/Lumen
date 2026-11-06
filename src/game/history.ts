/** Undo / redo stack. Pushing a new entry discards the redo branch. */
export class History<T> {
  private readonly done: T[] = [];
  private readonly undone: T[] = [];

  constructor(private readonly limit = 200) {}

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  get size(): number {
    return this.done.length;
  }

  push(entry: T): void {
    this.done.push(entry);
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
  }

  /** Returns the entry to revert, or undefined. */
  undo(): T | undefined {
    const entry = this.done.pop();
    if (entry !== undefined) this.undone.push(entry);
    return entry;
  }

  /** Returns the entry to re-apply, or undefined. */
  redo(): T | undefined {
    const entry = this.undone.pop();
    if (entry !== undefined) this.done.push(entry);
    return entry;
  }

  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }
}
