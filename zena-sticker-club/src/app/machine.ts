import type { AppEvent } from '@/app/events';
import { Emitter } from '@/app/events';
import type { Card } from '@/domain/types';

/**
 * App phases. The detailed animation beats (arm / tear / burst / settle) live
 * inside the reveal + pack modules; the machine only tracks the coarse phase.
 *
 *   idle ──RIP_START──▶ ripping ──RIP_COMPLETE──▶ revealing ──REVEAL_DONE──▶ showcase
 *     ▲                                                │                          │
 *     └──────────────────────── REROLL ───────────────┴──────────────────────────┘
 */
export type AppState = 'idle' | 'ripping' | 'revealing' | 'showcase';

/** Per-cycle context, cleared on every return to `idle`. */
export interface CycleContext {
  card: Card | null;
  status: 'need' | 'got' | null;
  isNew: boolean;
  count: number;
  /** Monotonic token; in-flight timeline callbacks compare against it. */
  token: number;
}

type TransitionTable = Record<AppState, Partial<Record<AppEvent['type'], AppState>>>;

const TRANSITIONS: TransitionTable = {
  idle: { RIP_START: 'ripping' },
  ripping: { RIP_COMPLETE: 'revealing' },
  revealing: { REVEAL_DONE: 'showcase', REROLL: 'idle' },
  showcase: { REROLL: 'idle' },
};

export type StateHook = (ctx: CycleContext, prev: AppState) => void;

export class AppMachine {
  private _state: AppState = 'idle';
  private _token = 0;
  readonly events = new Emitter<AppEvent>();
  readonly onEnter: Partial<Record<AppState, StateHook>> = {};
  ctx: CycleContext = { card: null, status: null, isNew: false, count: 0, token: 0 };

  constructor() {
    this.events.on((e) => this.handle(e));
  }

  get state(): AppState {
    return this._state;
  }

  get token(): number {
    return this._token;
  }

  send(event: AppEvent): void {
    this.events.emit(event);
  }

  /** Fire the initial state's onEnter hook once, after wiring is complete. */
  start(): void {
    this.onEnter[this._state]?.(this.ctx, this._state);
  }

  /**
   * Enter `showcase` directly for a binder re-view (no rip, no pull). Bumps the
   * token so any in-flight timeline goes inert, and returns the fresh token so
   * the review's reveal can guard against being superseded.
   */
  beginReview(): number {
    this._token += 1;
    this._state = 'showcase';
    this.ctx = { card: null, status: null, isNew: false, count: 0, token: this._token };
    return this._token;
  }

  private handle(event: AppEvent): void {
    const next = TRANSITIONS[this._state][event.type];
    if (!next) {
      if (import.meta.env.DEV) {
        console.warn(`[machine] ignored "${event.type}" in state "${this._state}"`);
      }
      return;
    }
    const prev = this._state;
    this._state = next;

    if (next === 'idle') {
      // Reset point. Bump the token so any timeline callback scheduled before
      // this reset becomes inert (it guards on ctx.token === machine.token).
      this._token += 1;
      this.ctx = { card: null, status: null, isNew: false, count: 0, token: this._token };
    } else {
      this.ctx.token = this._token;
    }

    this.onEnter[next]?.(this.ctx, prev);
  }
}
