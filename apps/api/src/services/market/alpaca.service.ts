import axios from 'axios';
import { env } from '../../config/env';
import { Quote, OHLCVBar, SearchResult } from '@student-investing/shared-types';
import { withRetry } from '../../lib/retry';

const alpacaClient = axios.create({
  baseURL: env.ALPACA_BASE_URL,
  headers: {
    'APCA-API-KEY-ID': env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET || '',
  },
});

export async function getStockQuote(
  symbol: string,
  // P-6: caller passes the requested assetType so ETF quotes are not silently
  // stamped as 'stock' — market-cache routes both 'stock' and 'etf' here.
  assetType: 'stock' | 'etf' = 'stock',
): Promise<Quote | null> {
  try {
    const res = await withRetry(() => alpacaClient.get(`/v2/stocks/${symbol}/snapshot`));
    const snap = res.data;
    if (!snap) return null;

    const price = snap.latestTrade?.p ?? snap.minuteBar?.c ?? snap.dailyBar?.c ?? 0;
    const prevClose = snap.prevDailyBar?.c ?? 0;
    const change = prevClose ? price - prevClose : 0;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    return {
      symbol,
      name: symbol,
      price,
      change,
      changePct,
      volume: snap.dailyBar?.v,
      assetType,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getStockBars(
  symbol: string,
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y',
): Promise<OHLCVBar[]> {
  const now = new Date();
  const start = new Date(now);

  const tfMap: Record<string, { period: number; unit: string; alpacaTf: string }> = {
    '1D': { period: 1, unit: 'day', alpacaTf: '5Min' },
    '1W': { period: 7, unit: 'day', alpacaTf: '1Hour' },
    '1M': { period: 30, unit: 'day', alpacaTf: '1Day' },
    '3M': { period: 90, unit: 'day', alpacaTf: '1Day' },
    '1Y': { period: 365, unit: 'day', alpacaTf: '1Week' },
  };

  const tf = tfMap[timeframe] ?? tfMap['1M'];
  start.setDate(start.getDate() - tf.period);

  try {
    const res = await withRetry(() =>
      alpacaClient.get(`/v2/stocks/${symbol}/bars`, {
        params: {
          timeframe: tf.alpacaTf,
          start: start.toISOString(),
          end: now.toISOString(),
          limit: 500,
        },
      }),
    );
    return (res.data?.bars ?? []).map((b: Record<string, unknown>) => ({
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
    }));
  } catch {
    return [];
  }
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  try {
    const res = await alpacaClient.get('/v2/assets', {
      params: { status: 'active', asset_class: 'us_equity' },
    });
    const q = query.toLowerCase();
    return (res.data as Record<string, string>[])
      .filter((a) => a.symbol?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q))
      .slice(0, 10)
      .map((a) => ({
        symbol: a.symbol,
        name: a.name,
        exchange: a.exchange,
        assetType: a.class === 'us_equity' ? 'stock' : 'etf',
      }));
  } catch {
    return [];
  }
}
