import type { Metal, ProviderQuote } from './types.js';

export interface CacheEntry {
  quote: ProviderQuote;
  fetchedAt: number;
}

export class TtlCache {
  private readonly entries = new Map<Metal, CacheEntry>();
  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  get(metal: Metal): CacheEntry | undefined {
    return this.entries.get(metal);
  }

  isFresh(entry: CacheEntry): boolean {
    return this.now() - entry.fetchedAt < this.ttlMs;
  }

  ageMs(entry: CacheEntry): number {
    return Math.max(0, this.now() - entry.fetchedAt);
  }

  set(metal: Metal, quote: ProviderQuote): CacheEntry {
    const entry: CacheEntry = { quote, fetchedAt: this.now() };
    this.entries.set(metal, entry);
    return entry;
  }
}
