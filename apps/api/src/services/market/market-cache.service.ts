import { getCache, setCache } from '../../config/redis';
import { getStockQuote, getStockBars } from './alpaca.service';
import { getCryptoQuote, getCryptoBars } from './coingecko.service';
import { Quote, OHLCVBar, AssetType } from '@student-investing/shared-types';

const QUOTE_TTL = 30;

// Tiered TTLs: shorter for fast-moving intraday data, longer for historical bars.
// D-3 fix: flat 60s for all timeframes caused unnecessary Alpaca calls for 3M/1Y charts.
const BARS_TTL: Record<string, number> = {
  '1D': 30,    // intraday 5-min bars change every candle
  '1W': 300,   // hourly bars: 5-min refresh acceptable
  '1M': 900,   // daily bars: 15-min refresh acceptable
  '3M': 1800,  // daily bars: 30-min refresh acceptable
  '1Y': 3600,  // weekly bars: 1-hour refresh acceptable
};

// D-2 fix: empty bar arrays (weekends / market closure) must be cached too.
// Without this, every page mount during market closure would hammer Alpaca.
const EMPTY_BARS_TTL = 300; // 5 min — avoids thrashing; short enough to recover on market open

export async function getCachedQuote(symbol: string, assetType: AssetType): Promise<Quote | null> {
  // P-1: include assetType in key — prevents stock and crypto sharing the same
  // Redis entry when they have identical ticker strings (e.g. "BTC").
  const key = `quote:${assetType}:${symbol}`;
  const cached = await getCache<Quote>(key);
  if (cached) return cached;

  let quote: Quote | null = null;
  if (assetType === 'crypto') {
    quote = await getCryptoQuote(symbol);
  } else {
    // P-6: pass assetType so getStockQuote stamps the correct type ('etf' for ETFs).
    quote = await getStockQuote(symbol, assetType);
  }

  if (quote) await setCache(key, quote, QUOTE_TTL);
  return quote;
}

export async function getCachedBars(
  symbol: string,
  assetType: AssetType,
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y',
): Promise<OHLCVBar[]> {
  // P-1: include assetType in key — same collision fix as getCachedQuote.
  const key = `bars:${assetType}:${symbol}:${timeframe}`;
  const cached = await getCache<OHLCVBar[]>(key);
  if (cached) return cached;

  const daysMap = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };

  let bars: OHLCVBar[] = [];
  if (assetType === 'crypto') {
    bars = await getCryptoBars(symbol, daysMap[timeframe]);
  } else {
    bars = await getStockBars(symbol, timeframe);
  }

  // Always cache — even empty results (D-2: prevents weekend hammering of Alpaca).
  const ttl = bars.length > 0 ? (BARS_TTL[timeframe] ?? 60) : EMPTY_BARS_TTL;
  await setCache(key, bars, ttl);
  return bars;
}
