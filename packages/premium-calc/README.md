# @agaudeals/premium-calc

[![npm version](https://img.shields.io/npm/v/@agaudeals/premium-calc.svg)](https://www.npmjs.com/package/@agaudeals/premium-calc)
[![license](https://img.shields.io/npm/l/@agaudeals/premium-calc.svg)](./LICENSE)
[![CI](https://github.com/agaudeals/agaudeals-js/actions/workflows/ci.yml/badge.svg)](https://github.com/agaudeals/agaudeals-js/actions/workflows/ci.yml)

Compute precious-metal dealer premiums (per-oz, percent, per-gram-pure, per-oz-pure) from a spot price, dealer price, weight, and purity. Pure function, **zero runtime dependencies**, full TypeScript types. Part of [agaudeals.com](https://agaudeals.com).

## Install

```sh
npm install @agaudeals/premium-calc
```

Requires Node 20+. ESM and CJS entries.

## Quick start

```ts
import { computePremium } from '@agaudeals/premium-calc';

// American Silver Eagle: 1 oz, .999 fine, dealer asking $32 over $25 spot.
const r = computePremium({
  spotUsdPerOz: 25,
  dealerPriceUsd: 32,
  weightTroyOz: 1,
  purity: 0.999,
});

console.log(r);
// {
//   premiumPerOz: 7.032...,
//   premiumPct: 28.13...,
//   pricePerGramPure: 1.029...,
//   pricePerOzPure: 32.032...,
// }
```

## API

### `computePremium(input) → result`

```ts
interface ComputePremiumInput {
  spotUsdPerOz: number;     // > 0
  dealerPriceUsd: number;   // > 0; total ask for the lot
  weightTroyOz: number;     // > 0; per-unit gross weight
  purity: number;           // (0, 1]; e.g. 0.999, 0.9167, 0.9
  quantity?: number;        // > 0; defaults to 1
}

interface ComputePremiumResult {
  premiumPerOz: number;     // pricePerOzPure − spot
  premiumPct: number;       // (premiumPerOz / spot) * 100
  pricePerGramPure: number; // dealer / (totalPureOz * 31.1034768)
  pricePerOzPure: number;   // dealer / (weight * purity * quantity)
}
```

`TROY_OZ_GRAMS` (`31.1034768`) is exported for callers that want to convert independently.

## Worked example: feeding `@agaudeals/spot-price` into `premium-calc`

```ts
import { SpotPrice } from '@agaudeals/spot-price';
import { computePremium } from '@agaudeals/premium-calc';

const spot = new SpotPrice(); // Stooq, 60s cache

// Listing under evaluation: 1 kg gold bar (32.1507 troy oz, .9999 fine), $65,000 ask.
const xau = await spot.getSpot('XAU');
const result = computePremium({
  spotUsdPerOz: xau.priceUsdPerOz,
  dealerPriceUsd: 65_000,
  weightTroyOz: 32.1507,
  purity: 0.9999,
});

console.log(`Spot: $${xau.priceUsdPerOz.toFixed(2)}/oz (source: ${xau.source}, stale: ${xau.stale})`);
console.log(`Premium: $${result.premiumPerOz.toFixed(2)}/oz pure (${result.premiumPct.toFixed(2)}%)`);
```

## Validation

Any of the following throws `RangeError` with a message naming the bad field:

- `spotUsdPerOz`, `dealerPriceUsd`, `weightTroyOz`, `quantity` — must be finite and `> 0`
- `purity` — must be finite and in `(0, 1]`

```ts
computePremium({ spotUsdPerOz: 2000, dealerPriceUsd: 2100, weightTroyOz: 1, purity: 1.5 });
// → RangeError: purity must be in (0, 1], got 1.5
```

## Out of scope (v0.1)

- Multi-currency (USD only — wrap with your FX layer if needed).
- Comparison/ranking helpers across listings (deferred to v1.0).

## License

MIT — see [LICENSE](./LICENSE). Maintained by [AgAu Deals](https://agaudeals.com).
