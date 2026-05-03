export type Metal = 'XAU' | 'XAG' | 'XPT' | 'XPD';

export type ProviderName = 'stooq' | 'metalpriceapi';

export interface SpotResult {
  metal: Metal;
  priceUsdPerOz: number;
  asOf: Date;
  source: ProviderName;
  stale: boolean;
  staleAgeMs: number;
}

export interface ProviderQuote {
  metal: Metal;
  priceUsdPerOz: number;
  asOf: Date;
}

export type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; statusText: string; text(): Promise<string>; json(): Promise<unknown> }>;

export interface ProviderAdapter {
  readonly name: ProviderName;
  fetchQuote(metal: Metal, opts: { signal?: AbortSignal }): Promise<ProviderQuote>;
}

export class SpotPriceError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SpotPriceError';
    if (cause !== undefined) this.cause = cause;
  }
}
