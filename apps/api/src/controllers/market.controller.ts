import { Request, Response } from 'express';
import { getCachedQuote, getCachedBars } from '../services/market/market-cache.service';
import { searchStocks } from '../services/market/alpaca.service';
import { getCryptoSearchResults } from '../services/market/coingecko.service';
import { getCache, setCache } from '../config/redis';
import axios from 'axios';
import { env } from '../config/env';
import { AssetType, SearchResult } from '@student-investing/shared-types';

export async function getQuote(req: Request, res: Response) {
  const { symbol } = req.params;
  const assetType = (req.query.type as AssetType) || 'stock';
  // P-1: wrap getCachedQuote — Redis failure or JSON.parse error must not
  // produce an unhandled rejection in Express 4 (which does not auto-catch).
  try {
    // R-08: use withMeta overload so we can set X-Cache header for k6 hit-rate detection.
    const { quote, cacheHit } = await getCachedQuote(symbol.toUpperCase(), assetType, true);
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    if (!quote) return res.status(404).json({ error: `No data for ${symbol}` });
    return res.json({ data: quote });
  } catch {
    return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Market data temporarily unavailable.' } });
  }
}

export async function getChart(req: Request, res: Response) {
  const { symbol } = req.params;
  const timeframe = (req.query.timeframe as '1D' | '1W' | '1M' | '3M' | '1Y') || '1M';
  const assetType = (req.query.type as AssetType) || 'stock';
  // P-1: same Express 4 async-rejection guard as getQuote.
  try {
    const bars = await getCachedBars(symbol.toUpperCase(), assetType, timeframe);
    return res.json({ data: bars });
  } catch {
    return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Chart data temporarily unavailable.' } });
  }
}

export async function searchTickers(req: Request, res: Response) {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ data: [] });

  // P-3: wrap entire body so Express 4 (which does NOT auto-catch rejected async
  // route handlers) never receives an unhandled promise rejection.
  try {
    const [stocks, crypto] = await Promise.all([
      searchStocks(q),
      Promise.resolve(getCryptoSearchResults(q)),
    ]);

    const combined = [...stocks, ...crypto].slice(0, 15);

    // P-4: per-item try/catch so a hard Redis error on one quote doesn't silently
    // drop the entire result.  Items whose price lookup fails still appear in the
    // response — just without a price (price: undefined).
    const results = await Promise.all(
      combined.map(async (result): Promise<SearchResult> => {
        try {
          const quote = await getCachedQuote(result.symbol, result.assetType);
          return { ...result, price: quote?.price };
        } catch {
          return { ...result, price: undefined };
        }
      }),
    );

    // Exact ticker match first (case-insensitive).
    const qUpper = q.toUpperCase();
    results.sort((a, b) => {
      if (a.symbol === qUpper) return -1;
      if (b.symbol === qUpper) return 1;
      return 0;
    });

    return res.json({ data: results });
  } catch (err) {
    // Covers searchStocks / getCryptoSearchResults failures.
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Search failed.' } });
  }
}

export async function getNews(req: Request, res: Response) {
  const cacheKey = 'market:news';
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ data: cached });

  try {
    const res2 = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'business', language: 'en', pageSize: 20, apiKey: env.NEWS_API_KEY },
    });
    const articles = (res2.data.articles as Record<string, string>[]).map((a, i) => ({
      id: String(i),
      title: a.title,
      summary: a.description,
      url: a.url,
      source: a.source,
      imageUrl: a.urlToImage,
      publishedAt: a.publishedAt,
    }));
    await setCache(cacheKey, articles, 300); // 5 min
    return res.json({ data: articles });
  } catch {
    return res.json({ data: [] });
  }
}

export async function getTrending(_req: Request, res: Response) {
  const symbols = [
    { symbol: 'AAPL', assetType: 'stock' as AssetType },
    { symbol: 'TSLA', assetType: 'stock' as AssetType },
    { symbol: 'NVDA', assetType: 'stock' as AssetType },
    { symbol: 'SPY', assetType: 'etf' as AssetType },
    { symbol: 'BTC', assetType: 'crypto' as AssetType },
    { symbol: 'ETH', assetType: 'crypto' as AssetType },
  ];

  const quotes = await Promise.all(
    symbols.map((s) => getCachedQuote(s.symbol, s.assetType)),
  );

  return res.json({ data: quotes.filter(Boolean) });
}
