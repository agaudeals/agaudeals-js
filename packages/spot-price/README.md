# @agaudeals/spot-price

[![npm version](https://img.shields.io/npm/v/@agaudeals/spot-price.svg)](https://www.npmjs.com/package/@agaudeals/spot-price)
[![license](https://img.shields.io/npm/l/@agaudeals/spot-price.svg)](./LICENSE)
[![CI](https://github.com/agaudeals/agaudeals-js/actions/workflows/ci.yml/badge.svg)](https://github.com/agaudeals/agaudeals-js/actions/workflows/ci.yml)

Fetch USD spot prices for gold (XAU), silver (XAG), platinum (XPT), and palladium (XPD) with built-in 60-second caching, ±20% sanity bounds against the last cached value, and stale-while-revalidate on provider failure. Ships **Stooq** (no API key, default) and **MetalPriceAPI** (user-provided key, opt-in real-time) adapters. Part of [agaudeals.com](https://agaudeals.com).

## Install

```sh
npm install @agaudeals/spot-price
```

Requires Node 20+. ESM and CJS entries; full TypeScript types.

## Quick start

```ts
import { SpotPrice } from '@agaudeals/spot-price';

const spot = new SpotPrice(); // defaults to Stooq, 60s TTL
const gold = await spot.getSpot('XAU');

console.log(gold);
// {
//   metal: 'XAU',
//   priceUsdPerOz: 2350.5,
//   asOf: 2026-04-30T17:00:00.000Z,
//   source: 'stooq',
//   stale: false,
//   staleAgeMs: 0,
// }
```

### MetalPriceAPI (real-time, requires key)

```ts
const spot = new SpotPrice({
  provider: 'metalpriceapi',
  apiKey: process.env.METALPRICEAPI_KEY!,
  cacheTtlMs: 30_000,
});
const silver = await spot.getSpot('XAG');
```

## API

### `new SpotPrice(options)`

| option        | type                                | default   | description                                  |
| ------------- | ----------------------------------- | --------- | -------------------------------------------- |
| `provider`    | `'stooq' \| 'metalpriceapi'`        | `'stooq'` | Adapter to use.                              |
| `apiKey`      | `string`                            | —         | Required for `metalpriceapi`.                |
| `cacheTtlMs`  | `number`                            | `60_000`  | TTL for in-memory cache.                     |
| `sanityBand`  | `number` (fraction, e.g. `0.2`)     | `0.2`     | Reject provider prices outside ±band.        |
| `fetch`       | `FetchLike`                         | global    | Inject custom fetch (testing, retries, etc). |
| `adapter`     | `ProviderAdapter`                   | —         | Inject a custom adapter; bypasses provider.  |

### `spot.getSpot(metal, opts?) → Promise<SpotResult>`

`metal` is `'XAU' | 'XAG' | 'XPT' | 'XPD'`. `opts.signal` is an optional `AbortSignal`.

```ts
interface SpotResult {
  metal: 'XAU' | 'XAG' | 'XPT' | 'XPD';
  priceUsdPerOz: number;
  asOf: Date;            // provider-reported observation time
  source: 'stooq' | 'metalpriceapi';
  stale: boolean;        // true if served from cache after a failed refresh
  staleAgeMs: number;    // age of the cached value when stale; 0 when fresh
}
```

## Freshness contract

The library is built around predictable, observable freshness — not the lowest-possible latency. If you need millisecond-fresh prices for execution, use a dedicated market-data feed.

- **Typical latency.** Stooq publishes end-of-period quotes with a delay measured in minutes, not seconds. MetalPriceAPI updates approximately every 60 seconds on the standard tier. The library does not paper over this; `asOf` reflects the provider's reported timestamp.
- **Cache TTL.** A successful fetch is held in-memory for `cacheTtlMs` (default **60 seconds**). Subsequent calls within the TTL return the cached value with `stale: false`, `staleAgeMs: 0` and **do not** hit the network.
- **Stale-while-revalidate.** If a refresh fails (network error, HTTP error, parse error, or sanity-band rejection) and a previously cached value exists, the call returns that cached value with `stale: true` and `staleAgeMs` set to the actual age. The error is swallowed — the contract is *prefer slightly-old data over no data*. If there is no cached value, the error is rethrown as `SpotPriceError`.
- **Sanity bounds.** A new fetch is rejected (and treated as a parse error) if its price is more than ±20% away from the last cached value. This protects callers from upstream data corruption (decimal-point bugs, currency-base errors, "0" sentinel values) without inventing prices.
- **In-flight dedup.** Concurrent `getSpot` calls for the same metal coalesce into one upstream request.
- **Daily reconciliation.** A GitHub Actions cron (`reconcile-lbma.yml`) compares Stooq's gold close against the LBMA London PM fix daily. Drift > 5% fails the run and surfaces in CI.

`stale: true` means: *the upstream is currently unavailable or distrusted; this number is `staleAgeMs` ms old.* It does **not** mean "expired" — it means "we tried to refresh and could not."

## Providers

| provider       | key needed | notes                                                                 |
| -------------- | ---------- | --------------------------------------------------------------------- |
| `stooq`        | no         | Default. CSV endpoint, USD/oz for XAU/XAG/XPT/XPD. Minute-grade fresh. |
| `metalpriceapi`| yes        | Real-time tier. Returns rates `USD → metal`; library inverts to USD/oz. |

Explicitly **not** supported (and won't be added): Yahoo Finance, Kitco scraping, Investing.com.

## Errors

All thrown errors are instances of `SpotPriceError`. They are only thrown on a *cold* failure (no cached value to fall back to) or invalid construction. Refresh failures with cache present resolve to a `stale: true` result.

## License

MIT — see [LICENSE](./LICENSE). Maintained by [AgAu Deals](https://agaudeals.com).
