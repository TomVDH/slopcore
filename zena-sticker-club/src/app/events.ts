/** The app-level events that drive the finite-state machine. */
export type AppEvent =
  | { type: 'RIP_START' }
  | { type: 'RIP_COMPLETE' }
  | { type: 'REVEAL_DONE' }
  | { type: 'REROLL' };

export type Handler<E> = (event: E) => void;

/** Minimal typed pub/sub. Decouples gestures and render modules from the FSM. */
export class Emitter<E> {
  private handlers = new Set<Handler<E>>();

  on(handler: Handler<E>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: E): void {
    // Snapshot so handlers may unsubscribe during dispatch.
    for (const h of [...this.handlers]) h(event);
  }

  clear(): void {
    this.handlers.clear();
  }
}
