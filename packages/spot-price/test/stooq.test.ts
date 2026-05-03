import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StooqAdapter, parseStooqCsv } from '../src/adapters/stooq.js';
import { SpotPriceError } from '../src/types.js';
import type { FetchLike } from '../src/types.js';

const okCsv = (body: string): ReturnType<FetchLike> =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(body),
    json: () => Promise.reject(new Error('not json')),
  });

const httpError = (status: number, statusText = 'Error'): ReturnType<FetchLike> =>
  Promise.resolve({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(''),
    json: () => Promise.reject(new Error('not json')),
  });

describe('parseStooqCsv', () => {
  it('parses a normal Stooq response for XAU', () => {
    const body = 'Symbol,Date,Time,Close\nXAUUSD,2026-04-30,17:00:00,2350.50';
    const q = parseStooqCsv(body, 'XAU');
    assert.equal(q.metal, 'XAU');
    assert.equal(q.priceUsdPerOz, 2350.5);
    assert.equal(q.asOf.toISOString(), '2026-04-30T17:00:00.000Z');
  });

  it('parses XAG/XPT/XPD', () => {
    for (const [metal, sym, price] of [
      ['XAG', 'XAGUSD', 28.42],
      ['XPT', 'XPTUSD', 950.1],
      ['XPD', 'XPDUSD', 1020.7],
    ] as const) {
      const body = `Symbol,Date,Time,Close\n${sym},2026-04-30,17:00:00,${price}`;
      const q = parseStooqCsv(body, metal);
      assert.equal(q.priceUsdPerOz, price);
    }
  });

  it('throws on missing data row', () => {
    assert.throws(() => parseStooqCsv('Symbol,Date,Time,Close', 'XAU'), SpotPriceError);
  });

  it('throws on non-numeric close (Stooq N/D sentinel)', () => {
    const body = 'Symbol,Date,Time,Close\nXAUUSD,N/D,N/D,N/D';
    assert.throws(() => parseStooqCsv(body, 'XAU'), SpotPriceError);
  });

  it('throws on symbol mismatch', () => {
    const body = 'Symbol,Date,Time,Close\nXAGUSD,2026-04-30,17:00:00,2350';
    assert.throws(() => parseStooqCsv(body, 'XAU'), SpotPriceError);
  });

  it('throws on negative price', () => {
    const body = 'Symbol,Date,Time,Close\nXAUUSD,2026-04-30,17:00:00,-1';
    assert.throws(() => parseStooqCsv(body, 'XAU'), SpotPriceError);
  });
});

describe('StooqAdapter', () => {
  it('fetches and returns a quote', async () => {
    let calledUrl = '';
    const fetchFn: FetchLike = (url) => {
      calledUrl = url;
      return okCsv('Symbol,Date,Time,Close\nXAUUSD,2026-04-30,17:00:00,2350.50');
    };
    const a = new StooqAdapter({ fetch: fetchFn });
    const q = await a.fetchQuote('XAU');
    assert.equal(q.priceUsdPerOz, 2350.5);
    assert.equal(a.name, 'stooq');
    assert.match(calledUrl, /xauusd/);
  });

  it('wraps HTTP errors in SpotPriceError', async () => {
    const a = new StooqAdapter({ fetch: () => httpError(503, 'Service Unavailable') });
    await assert.rejects(a.fetchQuote('XAU'), SpotPriceError);
  });

  it('wraps network errors in SpotPriceError', async () => {
    const a = new StooqAdapter({ fetch: () => Promise.reject(new Error('ECONNRESET')) });
    await assert.rejects(a.fetchQuote('XAU'), SpotPriceError);
  });
});
