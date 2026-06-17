import { describe, it, expect } from 'vitest';
import { CollectionState } from '@/collection/collection';

describe('CollectionState', () => {
  it('records and counts copies', () => {
    const c = new CollectionState();
    expect(c.record('ARG')).toEqual({ isNew: true, count: 1 });
    expect(c.record('ARG')).toEqual({ isNew: false, count: 2 });
    expect(c.count('ARG')).toBe(2);
    expect(c.has('ARG')).toBe(true);
    expect(c.has('BR')).toBe(false);
    expect(c.uniqueOwned()).toBe(1);
    expect(c.totalCopies()).toBe(2);
  });

  it('reports progress against the full set', () => {
    const c = new CollectionState();
    c.record('ARG');
    c.record('BR');
    const p = c.progress();
    expect(p.owned).toBe(2);
    expect(p.total).toBe(48);
    expect(p.copies).toBe(2);
    expect(p.pct).toBeCloseTo(2 / 48, 6);
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const c = new CollectionState();
    let calls = 0;
    const off = c.subscribe(() => {
      calls += 1;
    });
    c.record('JP');
    c.record('JP');
    expect(calls).toBe(2);
    off();
    c.record('JP');
    expect(calls).toBe(2);
  });

  it('keeps first-acquisition order', () => {
    const c = new CollectionState();
    c.record('BR');
    c.record('ARG');
    c.record('BR');
    expect(c.acquisitionOrder()).toEqual(['BR', 'ARG']);
  });
});
