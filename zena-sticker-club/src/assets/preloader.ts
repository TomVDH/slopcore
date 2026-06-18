import type { Card } from '@/domain/types';

/**
 * Network/decode discipline. We never bulk-load the 48 heroes. The chosen hero
 * is decoded just-in-time at rip start (so the flip never reveals a blank face),
 * the next likely pulls are warmed during idle, and decoded heroes beyond a
 * small cap are dropped so the browser can free their bitmaps.
 */
export class Preloader {
  private decoded = new Set<string>();
  private order: string[] = [];
  private readonly cap = 6;

  /** Warm + decode a card's hero. Resolves when ready (or quietly on failure). */
  async decodeHero(card: Card): Promise<void> {
    if (this.decoded.has(card.code)) {
      this.bump(card.code);
      return;
    }
    try {
      await this.warm(card.images.hero.avif);
    } catch {
      try {
        await this.warm(card.images.hero.webp);
      } catch {
        // Both failed (offline/unsupported). The LQIP behind the flip covers it.
      }
    }
    this.decoded.add(card.code);
    this.bump(card.code);
    this.evict();
  }

  /** Warm a few likely-next heroes during idle time (best effort). */
  prefetch(cards: readonly Card[]): void {
    const run = (): void => {
      for (const c of cards) {
        if (!this.decoded.has(c.code)) void this.decodeHero(c);
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 400);
    }
  }

  has(code: string): boolean {
    return this.decoded.has(code);
  }

  private warm(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = (): void => {
        if (typeof img.decode === 'function') {
          img.decode().then(
            () => resolve(),
            () => resolve(),
          );
        } else {
          resolve();
        }
      };
      img.onerror = (): void => reject(new Error(`image load failed: ${url}`));
      img.src = url;
    });
  }

  private bump(code: string): void {
    this.order = this.order.filter((c) => c !== code);
    this.order.push(code);
  }

  private evict(): void {
    while (this.order.length > this.cap) {
      const oldest = this.order.shift();
      if (oldest) this.decoded.delete(oldest);
    }
  }
}
