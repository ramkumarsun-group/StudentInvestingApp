import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../services/market/alpaca.service', () => ({
  searchStocks: vi.fn(),
}));
vi.mock('../services/market/coingecko.service', () => ({
  getCryptoSearchResults: vi.fn(),
}));
vi.mock('../services/market/market-cache.service', () => ({
  getCachedQuote: vi.fn(),
  getCachedBars: vi.fn(),
}));
vi.mock('../config/redis', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));
vi.mock('axios', () => ({ default: { get: vi.fn(), create: vi.fn(() => ({ get: vi.fn() })) } }));
vi.mock('../config/env', () => ({
  env: {
    NEWS_API_KEY: 'test-news-key',
    ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
    ALPACA_API_KEY: 'test-key',
    ALPACA_API_SECRET: 'test-secret',
  },
}));

import { searchTickers, getQuote, getChart } from './market.controller';
import { searchStocks } from '../services/market/alpaca.service';
import { getCryptoSearchResults } from '../services/market/coingecko.service';
import { getCachedQuote, getCachedBars } from '../services/market/market-cache.service';

const mockRes = {
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
} as unknown as Response;

function makeReq(q: string): Request {
  return { query: { q } } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedQuote).mockResolvedValue(null);
});

describe('searchTickers()', () => {
  it('query < 2 chars returns empty data without calling services', async () => {
    await searchTickers(makeReq('A'), mockRes);
    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
    expect(vi.mocked(searchStocks)).not.toHaveBeenCalled();
    expect(vi.mocked(getCryptoSearchResults)).not.toHaveBeenCalled();
  });

  it('empty query returns empty data without calling services', async () => {
    await searchTickers(makeReq(''), mockRes);
    expect(mockRes.json).toHaveBeenCalledWith({ data: [] });
    expect(vi.mocked(searchStocks)).not.toHaveBeenCalled();
  });

  it('valid query calls searchStocks and getCryptoSearchResults', async () => {
    vi.mocked(searchStocks).mockResolvedValue([]);
    vi.mocked(getCryptoSearchResults).mockReturnValue([]);
    await searchTickers(makeReq('BTC'), mockRes);
    expect(vi.mocked(searchStocks)).toHaveBeenCalledWith('BTC');
    expect(vi.mocked(getCryptoSearchResults)).toHaveBeenCalledWith('BTC');
  });

  it('exact ticker match is sorted first', async () => {
    vi.mocked(searchStocks).mockResolvedValue([
      { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock' },
      { symbol: 'AAPLX', name: 'Apple Variant', assetType: 'stock' },
    ]);
    vi.mocked(getCryptoSearchResults).mockReturnValue([]);

    await searchTickers(makeReq('AAPL'), mockRes);

    const result = vi.mocked(mockRes.json).mock.calls[0][0] as { data: { symbol: string }[] };
    expect(result.data[0].symbol).toBe('AAPL');
  });

  it('results capped at 15 items', async () => {
    const manyStocks = Array.from({ length: 12 }, (_, i) => ({
      symbol: `STK${i}`,
      name: `Stock ${i}`,
      assetType: 'stock' as const,
    }));
    const manyCrypto = Array.from({ length: 6 }, (_, i) => ({
      symbol: `CRY${i}`,
      name: `crypto${i}`,
      assetType: 'crypto' as const,
    }));
    vi.mocked(searchStocks).mockResolvedValue(manyStocks);
    vi.mocked(getCryptoSearchResults).mockReturnValue(manyCrypto);

    await searchTickers(makeReq('st'), mockRes);

    const result = vi.mocked(mockRes.json).mock.calls[0][0] as { data: unknown[] };
    // P-7: use toBe(15) — exact assertion pins the slice boundary.
    // toBeLessThanOrEqual(15) would pass even if the implementation returned 0.
    expect(result.data.length).toBe(15);
  });

  // P-8: service rejection should return 500, not hang the connection.
  it('searchStocks rejection → 500 INTERNAL_ERROR (no unhandled rejection)', async () => {
    vi.mocked(searchStocks).mockRejectedValue(new Error('Alpaca network error'));
    vi.mocked(getCryptoSearchResults).mockReturnValue([]);

    await searchTickers(makeReq('AAPL'), mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Search failed.' },
    });
  });

  it('price field populated from getCachedQuote when cache hit', async () => {
    vi.mocked(searchStocks).mockResolvedValue([
      { symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'stock' },
    ]);
    vi.mocked(getCryptoSearchResults).mockReturnValue([]);
    vi.mocked(getCachedQuote).mockResolvedValue({
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      price: 250.5,
      change: 0,
      changePct: 0,
      assetType: 'stock',
      updatedAt: new Date().toISOString(),
    });

    await searchTickers(makeReq('TSLA'), mockRes);

    const result = vi.mocked(mockRes.json).mock.calls[0][0] as { data: { symbol: string; price?: number }[] };
    expect(result.data[0].price).toBe(250.5);
  });
});

describe('getQuote()', () => {
  it('returns 404 when getCachedQuote returns null', async () => {
    vi.mocked(getCachedQuote).mockResolvedValue(null);
    await getQuote(
      { params: { symbol: 'AAPL' }, query: { type: 'stock' } } as unknown as Request,
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 with quote data including change and changePct', async () => {
    vi.mocked(getCachedQuote).mockResolvedValue({
      symbol: 'AAPL',
      name: 'AAPL',
      price: 190,
      change: 2.5,
      changePct: 1.3,
      assetType: 'stock',
      updatedAt: new Date().toISOString(),
    });
    await getQuote(
      { params: { symbol: 'AAPL' }, query: { type: 'stock' } } as unknown as Request,
      mockRes,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ price: 190, change: 2.5, changePct: 1.3 }),
    });
  });

  // P-1: getCachedQuote rejection (e.g. Redis failure) must return 503, not hang Express 4.
  it('getCachedQuote rejection → 503 SERVICE_UNAVAILABLE (no unhandled rejection)', async () => {
    vi.mocked(getCachedQuote).mockRejectedValue(new Error('Redis connection error'));
    await getQuote(
      { params: { symbol: 'AAPL' }, query: { type: 'stock' } } as unknown as Request,
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Market data temporarily unavailable.' },
    });
  });
});

describe('getChart()', () => {
  it('passes 3M timeframe to getCachedBars', async () => {
    vi.mocked(getCachedBars).mockResolvedValue([]);
    await getChart(
      { params: { symbol: 'BTC' }, query: { type: 'crypto', timeframe: '3M' } } as unknown as Request,
      mockRes,
    );
    expect(vi.mocked(getCachedBars)).toHaveBeenCalledWith('BTC', 'crypto', '3M');
  });

  // P-1: getCachedBars rejection must return 503, not hang Express 4.
  it('getCachedBars rejection → 503 SERVICE_UNAVAILABLE (no unhandled rejection)', async () => {
    vi.mocked(getCachedBars).mockRejectedValue(new Error('Redis connection error'));
    await getChart(
      { params: { symbol: 'AAPL' }, query: { type: 'stock', timeframe: '1M' } } as unknown as Request,
      mockRes,
    );
    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Chart data temporarily unavailable.' },
    });
  });
});
