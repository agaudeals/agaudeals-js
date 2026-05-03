import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePremium, TROY_OZ_GRAMS } from '../src/index.js';

const closeTo = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);

describe('computePremium — coin and bar fixtures', () => {
  it('American Gold Eagle 1 oz — 22k coin, dealer USD 2,250 over USD 2,000 spot', () => {
    const r = computePremium({
      spotUsdPerOz: 2000,
      dealerPriceUsd: 2250,
      weightTroyOz: 1.0909,
      purity: 0.9167,
    });
    closeTo(r.pricePerOzPure, 2250 / (1.0909 * 0.9167), 1e-4);
    assert.ok(r.premiumPerOz > 0);
    assert.ok(r.premiumPct > 0 && r.premiumPct < 30);
  });

  it('American Gold Eagle 1/10 oz — fractional coin carries higher premium', () => {
    const r = computePremium({
      spotUsdPerOz: 2000,
      dealerPriceUsd: 260,
      weightTroyOz: 0.10909,
      purity: 0.9167,
    });
    const expectedPerOz = 260 / (0.10909 * 0.9167);
    closeTo(r.pricePerOzPure, expectedPerOz, 1e-3);
    assert.ok(r.premiumPct > 20, `fractional eagle premium should be high, got ${r.premiumPct}%`);
  });

  it('American Silver Eagle — 1 oz .999 fine, dealer USD 32 over USD 25 spot', () => {
    const r = computePremium({
      spotUsdPerOz: 25,
      dealerPriceUsd: 32,
      weightTroyOz: 1,
      purity: 0.999,
    });
    closeTo(r.pricePerOzPure, 32 / 0.999, 1e-6);
    closeTo(r.premiumPerOz, 32 / 0.999 - 25, 1e-6);
    closeTo(r.premiumPct, ((32 / 0.999 - 25) / 25) * 100, 1e-6);
  });

  it('Generic 1 oz silver round — .999 fine', () => {
    const r = computePremium({
      spotUsdPerOz: 25,
      dealerPriceUsd: 28.5,
      weightTroyOz: 1,
      purity: 0.999,
    });
    assert.ok(r.premiumPct > 12 && r.premiumPct < 16);
    closeTo(r.pricePerGramPure, r.pricePerOzPure / TROY_OZ_GRAMS, 1e-9);
  });

  it('1 kg gold bar — 32.1507 troy oz, .9999 fine', () => {
    const r = computePremium({
      spotUsdPerOz: 2000,
      dealerPriceUsd: 65000,
      weightTroyOz: 32.1507,
      purity: 0.9999,
    });
    closeTo(r.pricePerOzPure, 65000 / (32.1507 * 0.9999), 1e-6);
    assert.ok(r.premiumPct < 5, `kilo bar premium should be low, got ${r.premiumPct}%`);
  });

  it('90% silver junk-coin bag — purity 0.9, USD 1000 face entry', () => {
    const r = computePremium({
      spotUsdPerOz: 25,
      dealerPriceUsd: 18000,
      weightTroyOz: 715,
      purity: 0.9,
    });
    const totalPureOz = 715 * 0.9;
    closeTo(r.pricePerOzPure, 18000 / totalPureOz, 1e-6);
    assert.ok(Math.abs(r.premiumPct) < 30);
  });

  it('quantity multiplier — 5x silver eagles equal single price * 5 per-oz pure', () => {
    const single = computePremium({
      spotUsdPerOz: 25,
      dealerPriceUsd: 32,
      weightTroyOz: 1,
      purity: 0.999,
    });
    const five = computePremium({
      spotUsdPerOz: 25,
      dealerPriceUsd: 32 * 5,
      weightTroyOz: 1,
      purity: 0.999,
      quantity: 5,
    });
    closeTo(five.pricePerOzPure, single.pricePerOzPure, 1e-9);
    closeTo(five.premiumPct, single.premiumPct, 1e-9);
  });
});

describe('computePremium — invariants', () => {
  it('pricePerGramPure equals pricePerOzPure / TROY_OZ_GRAMS', () => {
    const r = computePremium({
      spotUsdPerOz: 2000,
      dealerPriceUsd: 2100,
      weightTroyOz: 1,
      purity: 1,
    });
    closeTo(r.pricePerGramPure, r.pricePerOzPure / TROY_OZ_GRAMS, 1e-12);
  });

  it('premiumPct equals premiumPerOz / spot * 100', () => {
    const r = computePremium({
      spotUsdPerOz: 2000,
      dealerPriceUsd: 2150,
      weightTroyOz: 1,
      purity: 1,
    });
    closeTo(r.premiumPct, (r.premiumPerOz / 2000) * 100, 1e-12);
  });

  it('zero premium when dealer = spot for 1 oz pure', () => {
    const r = computePremium({
      spotUsdPerOz: 2000,
      dealerPriceUsd: 2000,
      weightTroyOz: 1,
      purity: 1,
    });
    closeTo(r.premiumPerOz, 0);
    closeTo(r.premiumPct, 0);
  });
});

describe('computePremium — input validation', () => {
  it('throws RangeError on purity > 1', () => {
    assert.throws(
      () =>
        computePremium({
          spotUsdPerOz: 2000,
          dealerPriceUsd: 2100,
          weightTroyOz: 1,
          purity: 1.5,
        }),
      (e: unknown) => e instanceof RangeError && /purity/.test((e as Error).message),
    );
  });

  it('throws RangeError on negative dealer price', () => {
    assert.throws(
      () =>
        computePremium({
          spotUsdPerOz: 2000,
          dealerPriceUsd: -5,
          weightTroyOz: 1,
          purity: 1,
        }),
      (e: unknown) => e instanceof RangeError && /dealerPriceUsd/.test((e as Error).message),
    );
  });

  it('throws RangeError on zero weight', () => {
    assert.throws(
      () =>
        computePremium({
          spotUsdPerOz: 2000,
          dealerPriceUsd: 2100,
          weightTroyOz: 0,
          purity: 1,
        }),
      (e: unknown) => e instanceof RangeError,
    );
  });

  it('throws RangeError on NaN spot', () => {
    assert.throws(
      () =>
        computePremium({
          spotUsdPerOz: NaN,
          dealerPriceUsd: 2100,
          weightTroyOz: 1,
          purity: 1,
        }),
      (e: unknown) => e instanceof RangeError,
    );
  });

  it('throws RangeError on purity = 0', () => {
    assert.throws(
      () =>
        computePremium({
          spotUsdPerOz: 2000,
          dealerPriceUsd: 2100,
          weightTroyOz: 1,
          purity: 0,
        }),
      (e: unknown) => e instanceof RangeError,
    );
  });
});
