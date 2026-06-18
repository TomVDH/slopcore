import type { CountryCode } from '@/domain/types';
import { TOTAL_NATIONS } from '@/domain/types';

export interface RecordResult {
  isNew: boolean;
  count: number;
}

export interface Progress {
  owned: number;
  total: number;
  pct: number;
  copies: number;
}

type Listener = () => void;

/**
 * In-memory ownership state. NO persistence in V1 (refresh = fresh album, by
 * design). A `PersistenceAdapter` could later wrap this in one module without
 * touching consumers. Emits `changed` so the binder/panel re-render reactively.
 */
export class CollectionState {
  private counts = new Map<CountryCode, number>();
  private order: CountryCode[] = [];
  private listeners = new Set<Listener>();

  /** Record one pull. Returns whether it was the first copy + the new count. */
  record(code: CountryCode): RecordResult {
    const prev = this.counts.get(code) ?? 0;
    const count = prev + 1;
    this.counts.set(code, count);
    const isNew = prev === 0;
    if (isNew) this.order.push(code);
    this.emit();
    return { isNew, count };
  }

  count(code: CountryCode): number {
    return this.counts.get(code) ?? 0;
  }

  has(code: CountryCode): boolean {
    return (this.counts.get(code) ?? 0) > 0;
  }

  uniqueOwned(): number {
    return this.counts.size;
  }

  totalCopies(): number {
    let total = 0;
    for (const v of this.counts.values()) total += v;
    return total;
  }

  progress(): Progress {
    const owned = this.counts.size;
    return {
      owned,
      total: TOTAL_NATIONS,
      pct: owned / TOTAL_NATIONS,
      copies: this.totalCopies(),
    };
  }

  /** Codes in first-acquisition order. */
  acquisitionOrder(): readonly CountryCode[] {
    return this.order;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of [...this.listeners]) l();
  }
}
