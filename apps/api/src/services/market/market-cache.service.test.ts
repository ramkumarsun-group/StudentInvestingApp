import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedQuote, getCachedBars } from './market-cache.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../config/redis', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

vi.mock('./alpaca.service', () => ({
  getStockQuote: vi.fn(),
  getStockBars: vi.fn(),
}));

vi.mock('./coingecko.service', () => ({
  getCryptoQuote: vi.fn(),
  getCryptoBars: vi.fn(),
}));

import { getCache, setCache } from '../../config/redis';
import { getStockQuote, getStockBars } from './alpaca.service';
import { getCryptoQuote, getCryptoBars } from './coingecko.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CACHED_QUOTE = {
  symbol: 'AAPL',
  name: 'AAPL',
  price: 190,
  change: 2,
  changePct: 1.1,
  assetType: 'stock' as const,
  updatedAt: new Date().toISOString(),
};

const UPSTREAM_QUOTE = {
  symbol: 'AAPL',
  name: 'AAPL',
  price: 192,
  change: 4,
  changePct: 2.1,
  assetType: 'stock' as const,
  updatedAt: new Date().toISOString(),
};

const SAMPLE_BARS = [
  { t: '2026-03-25T00:00:00Z', o: 188, h: 194, l: 187, c: 192, v: 1000000 },
];

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setCache).mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// getCachedQuote
// ─────────────────────────────────────────────────────────────────────────────

describe('getCachedQuote()', () => {
  // AC1 — cache hit
  it('returns cached quote and does NOT call upstream when cache hit', async () => {
    vi.mocked(getCache).mockResolvedValue(CACHED_QUOTE);

    const result = await getCachedQuote('AAPL', 'stock');

    expect(result).toEqual(CACHED_QUOTE);
    expect(getStockQuote).not.toHaveBeenCalled();
    expect(getCryptoQuote).not.toHaveBeenCalled();
    expect(setCache).not.toHaveBeenCalled();
  });

  // AC1 — cache miss: calls upstream and caches result
  it('calls getStockQuote on cache miss and stores result with QUOTE_TTL=30s', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockQuote).mockResolvedValue(UPSTREAM_QUOTE);

    const result = await getCachedQuote('AAPL', 'stock');

    expect(getStockQuote).toHaveBeenCalledWith('AAPL', 'stock');
    expect(result).toEqual(UPSTREAM_QUOTE);
    expect(setCache).toHaveBeenCalledWith('quote:stock:AAPL', UPSTREAM_QUOTE, 30);
  });

  // AC1 — crypto cache miss: calls getCryptoQuote, NOT getStockQuote
  it('calls getCryptoQuote (not getStockQuote) for crypto asset type', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getCryptoQuote).mockResolvedValue({
      ...UPSTREAM_QUOTE,
      symbol: 'BTC',
      assetType: 'crypto',
    });

    await getCachedQuote('BTC', 'crypto');

    expect(getCryptoQuote).toHaveBeenCalledWith('BTC');
    expect(getStockQuote).not.toHaveBeenCalled();
  });

  // AC2 — upstream returns null (simulates retries exhausted): do not cache, return null
  it('returns null and does NOT call setCache when upstream returns null', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockQuote).mockResolvedValue(null);

    const result = await getCachedQuote('UNKNOWN', 'stock');

    expect(result).toBeNull();
    expect(setCache).not.toHaveBeenCalled();
  });

  // AC3 — null propagation: getCachedQuote returns null → callers (T1.9 order service) can guard
  it('returns null when both cache and upstream have no data (AC3 order guard precondition)', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockQuote).mockResolvedValue(null);

    const result = await getCachedQuote('INVALID', 'etf');

    expect(result).toBeNull();
  });

  // Key namespace: assetType included to prevent stock/crypto collision (P-1)
  it('uses correct cache key with assetType prefix', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockQuote).mockResolvedValue(UPSTREAM_QUOTE);

    await getCachedQuote('BTC', 'stock');

    // Verify getCache was called with the assetType-namespaced key
    expect(getCache).toHaveBeenCalledWith('quote:stock:BTC');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCachedBars
// ─────────────────────────────────────────────────────────────────────────────

describe('getCachedBars()', () => {
  // Cache hit — no upstream call
  it('returns cached bars and does NOT call upstream when cache hit', async () => {
    vi.mocked(getCache).mockResolvedValue(SAMPLE_BARS);

    const result = await getCachedBars('AAPL', 'stock', '1M');

    expect(result).toEqual(SAMPLE_BARS);
    expect(getStockBars).not.toHaveBeenCalled();
    expect(setCache).not.toHaveBeenCalled();
  });

  // D-2 — empty bars: must be cached to prevent weekend hammering
  it('caches empty bars with EMPTY_BARS_TTL=300s (D-2 fix)', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockBars).mockResolvedValue([]);

    const result = await getCachedBars('AAPL', 'stock', '1M');

    expect(result).toEqual([]);
    expect(setCache).toHaveBeenCalledWith('bars:stock:AAPL:1M', [], 300);
  });

  // Non-empty bars: cached with correct tiered TTL
  it('caches non-empty bars with 1M tiered TTL=900s (D-3 fix)', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockBars).mockResolvedValue(SAMPLE_BARS);

    await getCachedBars('AAPL', 'stock', '1M');

    expect(setCache).toHaveBeenCalledWith('bars:stock:AAPL:1M', SAMPLE_BARS, 900);
  });

  // D-3 — tiered TTL for 1Y
  it('uses TTL=3600s for 1Y timeframe (D-3 fix)', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockBars).mockResolvedValue(SAMPLE_BARS);

    await getCachedBars('AAPL', 'stock', '1Y');

    expect(setCache).toHaveBeenCalledWith('bars:stock:AAPL:1Y', SAMPLE_BARS, 3600);
  });

  // D-3 — tiered TTL for 1D
  it('uses TTL=30s for 1D timeframe (D-3 fix)', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getStockBars).mockResolvedValue(SAMPLE_BARS);

    await getCachedBars('AAPL', 'stock', '1D');

    expect(setCache).toHaveBeenCalledWith('bars:stock:AAPL:1D', SAMPLE_BARS, 30);
  });

  // Crypto bars: calls getCryptoBars with correct days
  it('calls getCryptoBars with correct days mapping for 3M', async () => {
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(getCryptoBars).mockResolvedValue(SAMPLE_BARS);

    await getCachedBars('BTC', 'crypto', '3M');

    expect(getCryptoBars).toHaveBeenCalledWith('BTC', 90);
    expect(getStockBars).not.toHaveBeenCalled();
  });
});
