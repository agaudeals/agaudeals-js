import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MetalPriceApiAdapter,
  parseMetalPriceApiResponse,
} from '../src/adapters/metalpriceapi.js';
import { SpotPriceError } from '../src/types.js';
import type { FetchLike } from '../src/types.js';

const okJson = (payload: unknown): ReturnType<FetchLike> =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(JSON.stringify(payload)),
    json: () => Promise.resolve(payload),
  });

describe('parseMetalPriceApiResponse', () => {
  it('inverts the rate to USD/oz for XAU', () => {
    const ts = Math.floor(Date.UTC(2026, 3, 30, 17, 0, 0) / 1000);
    const q = parseMetalPriceApiResponse(
      { success: true, base: 'USD', timestamp: ts, rates: { XAU: 1 / 2350.5 } },
      'XAU',
    );
    assert.ok(Math.abs(q.priceUsdPerOz - 2350.5) < 1e-6);
    assert.equal(q.asOf.toISOString(), '2026-04-30T17:00:00.000Z');
  });

  it('throws when success is false', () => {
    assert.throws(
      () =>
        parseMetalPriceApiResponse(
          { success: false, error: { code: 101, message: 'invalid api key' } },
          'XAU',
        ),
      SpotPriceError,
    );
  });

  it('throws when the rate is missing', () => {
    assert.throws(
      () => parseMetalPriceApiResponse({ success: true, rates: {} }, 'XAU'),
      SpotPriceError,
    );
  });

  it('throws when the rate is non-positive', () => {
    assert.throws(
      () => parseMetalPriceApiResponse({ success: true, rates: { XAU: 0 } }, 'XAU'),
      SpotPriceError,
    );
  });
});

describe('MetalPriceApiAdapter', () => {
  it('requires apiKey', () => {
    assert.throws(
      () => new MetalPriceApiAdapter({ apiKey: '', fetch: (() => {}) as unknown as FetchLike }),
      SpotPriceError,
    );
  });

  it('builds correct URL with api_key, base, and metal', async () => {
    let url = '';
    const fetchFn: FetchLike = (u) => {
      url = u;
      return okJson({ success: true, timestamp: 0, rates: { XAU: 1 / 2350 } });
    };
    const a = new MetalPriceApiAdapter({ apiKey: 'k_test', fetch: fetchFn });
    await a.fetchQuote('XAU');
    assert.match(url, /api_key=k_test/);
    assert.match(url, /base=USD/);
    assert.match(url, /currencies=XAU/);
  });

  it('returns parsed quote from API', async () => {
    const ts = Math.floor(Date.UTC(2026, 3, 30, 17, 0, 0) / 1000);
    const a = new MetalPriceApiAdapter({
      apiKey: 'k',
      fetch: () => okJson({ success: true, timestamp: ts, rates: { XAG: 1 / 28.42 } }),
    });
    const q = await a.fetchQuote('XAG');
    assert.ok(Math.abs(q.priceUsdPerOz - 28.42) < 1e-6);
    assert.equal(a.name, 'metalpriceapi');
  });

  it('wraps API error responses', async () => {
    const a = new MetalPriceApiAdapter({
      apiKey: 'k',
      fetch: () =>
        okJson({ success: false, error: { code: 101, message: 'invalid api key' } }),
    });
    await assert.rejects(a.fetchQuote('XAU'), SpotPriceError);
  });
});
