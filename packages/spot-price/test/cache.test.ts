import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/cache.js';

describe('TtlCache', () => {
  it('returns undefined for unknown metal', () => {
    const cache = new TtlCache(1000, () => 0);
    assert.equal(cache.get('XAU'), undefined);
  });

  it('marks entries fresh within TTL and stale beyond it', () => {
    let now = 1_000_000;
    const cache = new TtlCache(60_000, () => now);
    const entry = cache.set('XAU', { metal: 'XAU', priceUsdPerOz: 2000, asOf: new Date(now) });
    assert.equal(cache.isFresh(entry), true);
    now += 59_999;
    assert.equal(cache.isFresh(entry), true);
    now += 2;
    assert.equal(cache.isFresh(entry), false);
  });

  it('reports age in milliseconds', () => {
    let now = 1_000_000;
    const cache = new TtlCache(60_000, () => now);
    const entry = cache.set('XAG', { metal: 'XAG', priceUsdPerOz: 25, asOf: new Date(now) });
    now += 12_345;
    assert.equal(cache.ageMs(entry), 12_345);
  });
});
