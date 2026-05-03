#!/usr/bin/env node
// Daily Stooq vs LBMA London PM (gold) reconciliation.
// Fails if the two diverge by more than DRIFT_THRESHOLD (default 5%).
// Designed for a GitHub Actions cron — output is structured for log scraping.

const DRIFT_THRESHOLD = Number(process.env.DRIFT_THRESHOLD ?? '0.05');
const STOOQ_URL = 'https://stooq.com/q/l/?s=xauusd&f=sd2t2c&h&e=csv';
const LBMA_URL = 'https://prices.lbma.org.uk/json/gold_pm.json';

function emit(obj) {
  console.log(JSON.stringify(obj));
}

async function fetchStooqGold() {
  const res = await fetch(STOOQ_URL);
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  const body = await res.text();
  const lines = body.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('Stooq missing data row');
  const cols = lines[1].split(',');
  const close = Number(cols[3]);
  if (!Number.isFinite(close) || close <= 0) throw new Error(`Stooq bad close: ${cols[3]}`);
  return { priceUsdPerOz: close, asOf: `${cols[1]}T${cols[2]}Z` };
}

async function fetchLbmaGoldPm() {
  const res = await fetch(LBMA_URL);
  if (!res.ok) throw new Error(`LBMA HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('LBMA empty payload');
  const last = data[data.length - 1];
  const usd = Array.isArray(last.v) ? Number(last.v[0]) : NaN;
  if (!Number.isFinite(usd) || usd <= 0) throw new Error(`LBMA bad USD value: ${JSON.stringify(last)}`);
  return { priceUsdPerOz: usd, asOf: last.d };
}

async function main() {
  const [stooq, lbma] = await Promise.all([fetchStooqGold(), fetchLbmaGoldPm()]);
  const drift = (stooq.priceUsdPerOz - lbma.priceUsdPerOz) / lbma.priceUsdPerOz;
  const driftPct = drift * 100;
  const ok = Math.abs(drift) <= DRIFT_THRESHOLD;

  emit({
    metal: 'XAU',
    stooq,
    lbma,
    driftPct: Number(driftPct.toFixed(4)),
    threshold: DRIFT_THRESHOLD,
    ok,
  });

  if (!ok) {
    console.error(`DRIFT ALERT: Stooq XAU diverges from LBMA PM by ${driftPct.toFixed(2)}% (threshold ±${(DRIFT_THRESHOLD * 100).toFixed(2)}%)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`reconcile-lbma failed: ${err.message}`);
  process.exit(2);
});
