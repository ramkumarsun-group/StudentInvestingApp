import axios from 'axios';
import { env } from '../../config/env';
import { Quote, OHLCVBar, SearchResult } from '@student-investing/shared-types';
import { withRetry } from '../../lib/retry';

const cgClient = axios.create({
  baseURL: 'https://api.coingecko.com/api/v3',
  headers: env.COINGECKO_API_KEY ? { 'x-cg-demo-api-key': env.COINGECKO_API_KEY } : {},
});

// Map ticker → CoinGecko id
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  MATIC: 'matic-network',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
};

export async function getCryptoQuote(symbol: string): Promise<Quote | null> {
  const id = SYMBOL_TO_ID[symbol.toUpperCase()];
  if (!id) return null;
  try {
    const res = await withRetry(() =>
      cgClient.get('/simple/price', {
        params: { ids: id, vs_currencies: 'usd', include_24hr_change: true, include_24hr_vol: true, include_market_cap: true },
      }),
    );
    const data = res.data[id];
    if (!data) return null;
    const changePct = data.usd_24h_change ?? 0;
    // P-3: guard against changePct = -100 which makes the denominator 0 → Infinity.
    // Also guard the general case: only back-calculate when the percentage is valid.
    const prevPrice =
      changePct !== 0 && changePct > -100
        ? data.usd / (1 + changePct / 100)
        : data.usd;
    const change = data.usd - prevPrice;
    return {
      symbol: symbol.toUpperCase(),
      name: id,
      price: data.usd,
      change,
      changePct,
      volume: data.usd_24h_vol,
      marketCap: data.usd_market_cap,
      assetType: 'crypto',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCryptoBars(symbol: string, days: number): Promise<OHLCVBar[]> {
  const id = SYMBOL_TO_ID[symbol.toUpperCase()];
  if (!id) return [];
  try {
    const res = await withRetry(() =>
      cgClient.get(`/coins/${id}/ohlc`, {
        params: { vs_currency: 'usd', days },
      }),
    );
    return (res.data as number[][]).map(([t, o, h, l, c]) => ({
      t: new Date(t).toISOString(),
      o, h, l, c, v: 0,
    }));
  } catch {
    return [];
  }
}

export function getCryptoSearchResults(query: string): SearchResult[] {
  const q = query.toLowerCase();
  return Object.entries(SYMBOL_TO_ID)
    .filter(([sym, name]) => sym.toLowerCase().includes(q) || name.toLowerCase().includes(q))
    .slice(0, 5)
    .map(([sym]) => ({ symbol: sym, name: SYMBOL_TO_ID[sym], assetType: 'crypto' as const }));
}
