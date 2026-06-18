import type { MotionLevel } from '@/domain/types';

/** Watches `prefers-reduced-motion` and notifies consumers when it flips. */
export class MotionPrefs {
  private mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  private listeners = new Set<(level: MotionLevel) => void>();

  constructor() {
    this.mq.addEventListener('change', () => {
      for (const l of [...this.listeners]) l(this.level);
    });
  }

  get level(): MotionLevel {
    return this.mq.matches ? 'reduced' : 'full';
  }

  get reduced(): boolean {
    return this.mq.matches;
  }

  onChange(fn: (level: MotionLevel) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
