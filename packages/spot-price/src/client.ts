import { TtlCache } from './cache.js';
import { isWithinSanityBand, SANITY_BAND } from './sanity.js';
import { StooqAdapter } from './adapters/stooq.js';
import { MetalPriceApiAdapter } from './adapters/metalpriceapi.js';
import type { FetchLike, Metal, ProviderAdapter, ProviderName, SpotResult } from './types.js';
import { SpotPriceError } from './types.js';

export interface SpotPriceOptions {
  provider?: ProviderName;
  apiKey?: string;
  cacheTtlMs?: number;
  sanityBand?: number;
  fetch?: FetchLike;
  baseUrl?: string;
  now?: () => number;
  adapter?: ProviderAdapter;
}

const DEFAULT_TTL_MS = 60_000;

export class SpotPrice {
  private readonly adapter: ProviderAdapter;
  private readonly cache: TtlCache;
  private readonly sanityBand: number;
  private readonly inflight = new Map<Metal, Promise<SpotResult>>();
  private readonly now: () => number;

  constructor(opts: SpotPriceOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.cache = new TtlCache(opts.cacheTtlMs ?? DEFAULT_TTL_MS, this.now);
    this.sanityBand = opts.sanityBand ?? SANITY_BAND;

    if (opts.adapter) {
      this.adapter = opts.adapter;
    } else {
      const provider: ProviderName = opts.provider ?? 'stooq';
      if (provider === 'metalpriceapi') {
        if (!opts.apiKey) {
          throw new SpotPriceError("MetalPriceAPI provider requires `apiKey`");
        }
        const aopts: ConstructorParameters<typeof MetalPriceApiAdapter>[0] = { apiKey: opts.apiKey };
        if (opts.fetch) aopts.fetch = opts.fetch;
        if (opts.baseUrl) aopts.baseUrl = opts.baseUrl;
        this.adapter = new MetalPriceApiAdapter(aopts);
      } else if (provider === 'stooq') {
        const aopts: ConstructorParameters<typeof StooqAdapter>[0] = {};
        if (opts.fetch) aopts.fetch = opts.fetch;
        if (opts.baseUrl) aopts.baseUrl = opts.baseUrl;
        this.adapter = new StooqAdapter(aopts);
      } else {
        throw new SpotPriceError(`Unknown provider: ${String(provider)}`);
      }
    }
  }

  async getSpot(metal: Metal, opts: { signal?: AbortSignal } = {}): Promise<SpotResult> {
    const cached = this.cache.get(metal);
    if (cached && this.cache.isFresh(cached)) {
      return this.toResult(cached.quote, false, 0);
    }

    let inflight = this.inflight.get(metal);
    if (!inflight) {
      inflight = this.refresh(metal, opts).finally(() => {
        this.inflight.delete(metal);
      });
      this.inflight.set(metal, inflight);
    }
    return inflight;
  }

  private async refresh(metal: Metal, opts: { signal?: AbortSignal }): Promise<SpotResult> {
    const cached = this.cache.get(metal);
    try {
      const fetchOpts: { signal?: AbortSignal } = {};
      if (opts.signal) fetchOpts.signal = opts.signal;
      const quote = await this.adapter.fetchQuote(metal, fetchOpts);
      if (cached && !isWithinSanityBand(quote.priceUsdPerOz, cached.quote.priceUsdPerOz, this.sanityBand)) {
        throw new SpotPriceError(
          `Provider price ${quote.priceUsdPerOz} for ${metal} outside ±${this.sanityBand * 100}% of cached ${cached.quote.priceUsdPerOz}`,
        );
      }
      const entry = this.cache.set(metal, quote);
      return this.toResult(entry.quote, false, 0);
    } catch (err) {
      if (cached) {
        return this.toResult(cached.quote, true, this.cache.ageMs(cached));
      }
      throw err instanceof SpotPriceError
        ? err
        : new SpotPriceError(`Failed to fetch ${metal} and no cached value available`, err);
    }
  }

  private toResult(quote: { metal: Metal; priceUsdPerOz: number; asOf: Date }, stale: boolean, staleAgeMs: number): SpotResult {
    return {
      metal: quote.metal,
      priceUsdPerOz: quote.priceUsdPerOz,
      asOf: quote.asOf,
      source: this.adapter.name,
      stale,
      staleAgeMs,
    };
  }
}
