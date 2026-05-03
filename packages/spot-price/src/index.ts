export { SpotPrice } from './client.js';
export type { SpotPriceOptions } from './client.js';
export { StooqAdapter, parseStooqCsv } from './adapters/stooq.js';
export type { StooqAdapterOptions } from './adapters/stooq.js';
export { MetalPriceApiAdapter, parseMetalPriceApiResponse } from './adapters/metalpriceapi.js';
export type { MetalPriceApiAdapterOptions } from './adapters/metalpriceapi.js';
export { isWithinSanityBand, SANITY_BAND } from './sanity.js';
export { SpotPriceError } from './types.js';
export type { Metal, ProviderAdapter, ProviderName, ProviderQuote, SpotResult, FetchLike } from './types.js';
