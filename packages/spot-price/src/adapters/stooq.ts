import type { FetchLike, Metal, ProviderAdapter, ProviderQuote } from '../types.js';
import { SpotPriceError } from '../types.js';

const STOOQ_SYMBOL: Record<Metal, string> = {
  XAU: 'xauusd',
  XAG: 'xagusd',
  XPT: 'xptusd',
  XPD: 'xpdusd',
};

export interface StooqAdapterOptions {
  fetch?: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = 'https://stooq.com';
const DEFAULT_TIMEOUT_MS = 10_000;

export class StooqAdapter implements ProviderAdapter {
  readonly name = 'stooq' as const;
  private readonly fetchFn: FetchLike;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: StooqAdapterOptions = {}) {
    this.fetchFn = opts.fetch ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (typeof this.fetchFn !== 'function') {
      throw new SpotPriceError('No fetch implementation available');
    }
  }

  async fetchQuote(metal: Metal, opts: { signal?: AbortSignal } = {}): Promise<ProviderQuote> {
    const symbol = STOOQ_SYMBOL[metal];
    const url = `${this.baseUrl}/q/l/?s=${symbol}&f=sd2t2c&h&e=csv`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    const onUserAbort = () => ac.abort();
    if (opts.signal) opts.signal.addEventListener('abort', onUserAbort, { once: true });

    let body: string;
    try {
      const res = await this.fetchFn(url, { signal: ac.signal });
      if (!res.ok) {
        throw new SpotPriceError(`Stooq HTTP ${res.status} ${res.statusText}`);
      }
      body = await res.text();
    } catch (err) {
      throw new SpotPriceError(`Stooq fetch failed: ${(err as Error).message}`, err);
    } finally {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onUserAbort);
    }

    return parseStooqCsv(body, metal);
  }
}

export function parseStooqCsv(body: string, metal: Metal): ProviderQuote {
  const lines = body.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new SpotPriceError(`Stooq CSV missing data row for ${metal}`);
  }
  const cols = lines[1]!.split(',');
  if (cols.length < 4) {
    throw new SpotPriceError(`Stooq CSV malformed for ${metal}: ${lines[1]}`);
  }
  const [symRaw, dateRaw, timeRaw, closeRaw] = cols;
  const close = Number(closeRaw);
  if (!Number.isFinite(close) || close <= 0) {
    throw new SpotPriceError(`Stooq returned non-numeric price for ${metal}: ${closeRaw}`);
  }
  const sym = (symRaw ?? '').trim().toUpperCase();
  if (!sym.startsWith(metal)) {
    throw new SpotPriceError(`Stooq symbol mismatch for ${metal}: got ${sym}`);
  }
  const asOf = parseStooqTimestamp(dateRaw, timeRaw);
  return { metal, priceUsdPerOz: close, asOf };
}

function parseStooqTimestamp(date: string | undefined, time: string | undefined): Date {
  if (!date) return new Date();
  const isoCandidate = `${date}T${time ?? '00:00:00'}Z`;
  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
