import type { FetchLike, Metal, ProviderAdapter, ProviderQuote } from '../types.js';
import { SpotPriceError } from '../types.js';

export interface MetalPriceApiAdapterOptions {
  apiKey: string;
  fetch?: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = 'https://api.metalpriceapi.com';
const DEFAULT_TIMEOUT_MS = 10_000;

interface MetalPriceApiLatest {
  success?: boolean;
  base?: string;
  timestamp?: number;
  rates?: Partial<Record<string, number>>;
  error?: { code?: number | string; message?: string };
}

export class MetalPriceApiAdapter implements ProviderAdapter {
  readonly name = 'metalpriceapi' as const;
  private readonly fetchFn: FetchLike;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string;

  constructor(opts: MetalPriceApiAdapterOptions) {
    if (!opts.apiKey || typeof opts.apiKey !== 'string') {
      throw new SpotPriceError('MetalPriceAPI requires an apiKey');
    }
    this.apiKey = opts.apiKey;
    this.fetchFn = opts.fetch ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (typeof this.fetchFn !== 'function') {
      throw new SpotPriceError('No fetch implementation available');
    }
  }

  async fetchQuote(metal: Metal, opts: { signal?: AbortSignal } = {}): Promise<ProviderQuote> {
    const url = `${this.baseUrl}/v1/latest?api_key=${encodeURIComponent(this.apiKey)}&base=USD&currencies=${metal}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    const onUserAbort = () => ac.abort();
    if (opts.signal) opts.signal.addEventListener('abort', onUserAbort, { once: true });

    let payload: MetalPriceApiLatest;
    try {
      const res = await this.fetchFn(url, { signal: ac.signal });
      if (!res.ok) {
        throw new SpotPriceError(`MetalPriceAPI HTTP ${res.status} ${res.statusText}`);
      }
      payload = (await res.json()) as MetalPriceApiLatest;
    } catch (err) {
      throw new SpotPriceError(`MetalPriceAPI fetch failed: ${(err as Error).message}`, err);
    } finally {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onUserAbort);
    }

    return parseMetalPriceApiResponse(payload, metal);
  }
}

export function parseMetalPriceApiResponse(payload: MetalPriceApiLatest, metal: Metal): ProviderQuote {
  if (payload.success === false || payload.error) {
    const msg = payload.error?.message ?? 'unknown error';
    throw new SpotPriceError(`MetalPriceAPI error: ${msg}`);
  }
  const rate = payload.rates?.[metal];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new SpotPriceError(`MetalPriceAPI missing rate for ${metal}`);
  }
  // MetalPriceAPI returns rates as base->currency. Base USD, currency XAU means
  // 1 USD = `rate` XAU oz; spot price USD/oz = 1 / rate.
  const priceUsdPerOz = 1 / rate;
  const asOf = payload.timestamp ? new Date(payload.timestamp * 1000) : new Date();
  return { metal, priceUsdPerOz, asOf };
}
