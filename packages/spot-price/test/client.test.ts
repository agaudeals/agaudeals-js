import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpotPrice } from '../src/client.js';
import { SpotPriceError } from '../src/types.js';
import type { Metal, ProviderAdapter, ProviderQuote } from '../src/types.js';

class MockAdapter implements ProviderAdapter {
  readonly name = 'stooq' as const;
  calls = 0;
  responder: (metal: Metal, attempt: number) => Promise<ProviderQuote> | ProviderQuote;
  constructor(responder: MockAdapter['responder']) {
    this.responder = responder;
  }
  async fetchQuote(metal: Metal): Promise<ProviderQuote> {
    this.calls += 1;
    return this.responder(metal, this.calls);
  }
}

const Q = (priceUsdPerOz: number, metal: Metal = 'XAU', asOf = new Date(0)): ProviderQuote => ({
  metal,
  priceUsdPerOz,
  asOf,
});

describe('SpotPrice constructor', () => {
  it('rejects metalpriceapi without apiKey', () => {
    assert.throws(() => new SpotPrice({ provider: 'metalpriceapi' }), SpotPriceError);
  });

  it('defaults to stooq when no provider specified', async () => {
    const adapter = new MockAdapter(() => Q(2000));
    const sp = new SpotPrice({ adapter });
    const r = await sp.getSpot('XAU');
    assert.equal(r.source, 'stooq');
  });

  it('rejects unknown provider', () => {
    assert.throws(
      () => new SpotPrice({ provider: 'kitco' as unknown as 'stooq' }),
      SpotPriceError,
    );
  });
});

describe('SpotPrice cache + freshness contract', () => {
  it('returns fresh result on first fetch (stale=false, staleAgeMs=0)', async () => {
    const adapter = new MockAdapter(() => Q(2000));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000 });
    const r = await sp.getSpot('XAU');
    assert.equal(r.metal, 'XAU');
    assert.equal(r.priceUsdPerOz, 2000);
    assert.equal(r.stale, false);
    assert.equal(r.staleAgeMs, 0);
    assert.equal(r.source, 'stooq');
  });

  it('serves cache hits within TTL without re-fetching', async () => {
    let now = 1_000_000;
    const adapter = new MockAdapter(() => Q(2000));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000, now: () => now });
    await sp.getSpot('XAU');
    now += 30_000;
    const r = await sp.getSpot('XAU');
    assert.equal(adapter.calls, 1);
    assert.equal(r.stale, false);
    assert.equal(r.staleAgeMs, 0);
  });

  it('refreshes after TTL expires', async () => {
    let now = 1_000_000;
    const adapter = new MockAdapter((_m, attempt) => Q(attempt === 1 ? 2000 : 2050));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000, now: () => now });
    await sp.getSpot('XAU');
    now += 60_001;
    const r = await sp.getSpot('XAU');
    assert.equal(adapter.calls, 2);
    assert.equal(r.priceUsdPerOz, 2050);
    assert.equal(r.stale, false);
  });
});

describe('SpotPrice stale-while-revalidate', () => {
  it('returns last cached value with stale=true when provider errors after TTL', async () => {
    let now = 1_000_000;
    const adapter = new MockAdapter((_m, attempt) => {
      if (attempt === 1) return Q(2000);
      throw new SpotPriceError('boom');
    });
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000, now: () => now });
    await sp.getSpot('XAU');
    now += 90_000;
    const r = await sp.getSpot('XAU');
    assert.equal(r.priceUsdPerOz, 2000);
    assert.equal(r.stale, true);
    assert.equal(r.staleAgeMs, 90_000);
  });

  it('throws when provider errors and there is no cached value', async () => {
    const adapter = new MockAdapter(() => {
      throw new SpotPriceError('cold start failure');
    });
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000 });
    await assert.rejects(sp.getSpot('XAU'), SpotPriceError);
  });

  it('wraps non-SpotPriceError adapter failures', async () => {
    const adapter = new MockAdapter(() => {
      throw new Error('TypeError-ish');
    });
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000 });
    await assert.rejects(sp.getSpot('XAU'), SpotPriceError);
  });
});

describe('SpotPrice ±20% sanity bounds', () => {
  it('falls through to stale cache when provider returns out-of-band price', async () => {
    let now = 1_000_000;
    const adapter = new MockAdapter((_m, attempt) => Q(attempt === 1 ? 2000 : 5000));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000, now: () => now });
    await sp.getSpot('XAU');
    now += 60_001;
    const r = await sp.getSpot('XAU');
    assert.equal(r.priceUsdPerOz, 2000);
    assert.equal(r.stale, true);
  });

  it('accepts in-band price changes', async () => {
    let now = 1_000_000;
    const adapter = new MockAdapter((_m, attempt) => Q(attempt === 1 ? 2000 : 2300));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000, now: () => now });
    await sp.getSpot('XAU');
    now += 60_001;
    const r = await sp.getSpot('XAU');
    assert.equal(r.priceUsdPerOz, 2300);
    assert.equal(r.stale, false);
  });

  it('honors a custom sanityBand', async () => {
    let now = 1_000_000;
    const adapter = new MockAdapter((_m, attempt) => Q(attempt === 1 ? 2000 : 2150));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000, sanityBand: 0.05, now: () => now });
    await sp.getSpot('XAU');
    now += 60_001;
    const r = await sp.getSpot('XAU');
    assert.equal(r.priceUsdPerOz, 2000);
    assert.equal(r.stale, true);
  });
});

describe('SpotPrice in-flight dedup', () => {
  it('coalesces concurrent getSpot calls into a single fetch', async () => {
    const adapter = new MockAdapter(() => new Promise((resolve) => setTimeout(() => resolve(Q(2000)), 10)));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000 });
    const [a, b, c] = await Promise.all([sp.getSpot('XAU'), sp.getSpot('XAU'), sp.getSpot('XAU')]);
    assert.equal(adapter.calls, 1);
    assert.equal(a.priceUsdPerOz, 2000);
    assert.equal(b.priceUsdPerOz, 2000);
    assert.equal(c.priceUsdPerOz, 2000);
  });

  it('does not dedup across distinct metals', async () => {
    const adapter = new MockAdapter((m) => Q(m === 'XAU' ? 2000 : 25, m));
    const sp = new SpotPrice({ adapter, cacheTtlMs: 60_000 });
    const [au, ag] = await Promise.all([sp.getSpot('XAU'), sp.getSpot('XAG')]);
    assert.equal(adapter.calls, 2);
    assert.equal(au.priceUsdPerOz, 2000);
    assert.equal(ag.priceUsdPerOz, 25);
  });
});

describe('SpotPrice supports all four metals', () => {
  it('handles XAU/XAG/XPT/XPD independently', async () => {
    const prices: Record<Metal, number> = { XAU: 2350, XAG: 28.42, XPT: 950, XPD: 1020 };
    const adapter = new MockAdapter((m) => Q(prices[m], m));
    const sp = new SpotPrice({ adapter });
    for (const m of Object.keys(prices) as Metal[]) {
      const r = await sp.getSpot(m);
      assert.equal(r.metal, m);
      assert.equal(r.priceUsdPerOz, prices[m]);
    }
  });
});
