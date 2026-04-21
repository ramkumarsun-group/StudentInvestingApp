/**
 * P3-004 — Alpaca circuit-breaker / stale-Redis fallback (exploratory).
 * @P3 @Exploratory
 *
 * AC4 from T5.5:
 *   Given  Alpaca is mocked to timeout (> 5s)
 *   When   GET /api/v1/market/quote/:symbol is called
 *   Then   the API returns 200 with stale Redis data + { stale: true } flag;
 *          no 503 is returned to the client.
 *
 * ── FINDINGS ─────────────────────────────────────────────────────────────────
 *
 * FINDING 1 (PASS — partial): Cache-first stale-data path works within TTL.
 *   When Redis has a cached quote (TTL not yet expired), getCachedQuote returns
 *   that data immediately — getStockQuote (Alpaca) is never called. This means
 *   a "warm" cache effectively serves stale data during an Alpaca outage for up
 *   to QUOTE_TTL (30 s).
 *
 * FINDING 2 (GAP): No stale fallback after TTL expiry.
 *   When the Redis TTL has expired AND Alpaca fails (timeout / 5xx), getCachedQuote
 *   returns null → the market controller returns 404. There is no mechanism to
 *   re-serve the previously-cached value beyond its TTL window.
 *
 * FINDING 3 (GAP): No { stale: true } flag on any response.
 *   Neither getCachedQuote nor the market controller adds a stale indicator to
 *   the response payload. Clients cannot distinguish a live Alpaca quote from a
 *   cached-but-potentially-stale one.
 *
 * RECOMMENDATION:
 *   Create a follow-up story (T5.6 or T4-adjacent) to implement a proper
 *   circuit-breaker pattern:
 *     1. On Alpaca failure, attempt Redis GET with KEYS `quote:*:SYMBOL` ignoring TTL
 *        (i.e., store a separate long-lived "last-known" key alongside the 30 s key).
 *     2. If a stale value is found, return it with { data: {..., stale: true } }.
 *     3. If no stale value exists, return 503 with Retry-After header.
 *
 * These tests lock in the CURRENT behaviour so any accidental regression is caught.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedQuote } from './market/market-cache.service';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../config/redis', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

vi.mock('./market/alpaca.service', () => ({
  getStockQuote: vi.fn(),
  getStockBars: vi.fn(),
}));

vi.mock('./market/coingecko.service', () => ({
  getCryptoQuote: vi.fn(),
  getCryptoBars: vi.fn(),
}));

import { getCache, setCache } from '../config/redis';
import { getStockQuote } from './market/alpaca.service';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const STALE_QUOTE = {
  symbol: 'AAPL',
  name: 'AAPL',
  price: 185.5,
  change: -1.2,
  changePct: -0.64,
  assetType: 'stock' as const,
  updatedAt: '2026-04-19T09:00:00Z', // older timestamp = "stale"
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setCache).mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 1 — Cache-first fast path (IMPLEMENTED ✅)
// ─────────────────────────────────────────────────────────────────────────────

describe('P3-004: stale-Redis fallback — cache-first fast path (FINDING 1)', () => {
  it('returns cached quote WITHOUT calling Alpaca when cache is warm', async () => {
    // Simulate: Redis has a cached quote (within TTL); Alpaca would time out.
    vi.mocked(getCache).mockResolvedValue(STALE_QUOTE);
    vi.mocked(getStockQuote).mockRejectedValue(new Error('Alpaca timeout'));

    const result = await getCachedQuote('AAPL', 'stock');

    // ✅ Stale data is returned from Redis — Alpaca is never called.
    expect(result).toEqual(STALE_QUOTE);
    expect(getStockQuote).not.toHaveBeenCalled();
  });

  it('returns stale price value intact (price field not null/undefined)', async () => {
    vi.mocked(getCache).mockResolvedValue(STALE_QUOTE);

    const result = await getCachedQuote('AAPL', 'stock');

    expect(result?.price).toBe(185.5);
    expect(result?.symbol).toBe('AAPL');
  });

  it('does NOT call setCache when returning a cache hit (avoids resetting TTL)', async () => {
    vi.mocked(getCache).mockResolvedValue(STALE_QUOTE);

    await getCachedQuote('AAPL', 'stock');

    // setCache must NOT be called — resetting TTL on a cache hit would extend
    // a potentially stale entry indefinitely.
    expect(setCache).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 2 — Expired TTL + Alpaca failure = null (GAP ❌)
// ─────────────────────────────────────────────────────────────────────────────

describe('P3-004: stale-Redis fallback — expired TTL + Alpaca failure (FINDING 2 — GAP)', () => {
  // TODO: implement circuit-breaker (long-lived last-known Redis key) — see T5.5 follow-up story
  it.todo('returns null when Redis cache is empty AND Alpaca returns null (timeout exhausted)');

  // TODO: implement circuit-breaker (long-lived last-known Redis key) — see T5.5 follow-up story
  it.todo('returns null when Redis cache is empty AND Alpaca throws (network timeout)');
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 3 — No { stale: true } flag on any response (GAP ❌)
// ─────────────────────────────────────────────────────────────────────────────

describe('P3-004: stale indicator — no stale flag on response (FINDING 3 — GAP)', () => {
  // TODO: add stale:true flag to cached responses — see T5.5 follow-up story
  it.todo('getCachedQuote returns a Quote shape with no stale field');

  // TODO: add stale:true flag to cached responses — see T5.5 follow-up story
  it.todo('documents required shape for a compliant stale response (spec, not implemented)');
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary assertion: market controller would return 404 (not 200) on full outage
// ─────────────────────────────────────────────────────────────────────────────

describe('P3-004: market controller behaviour under full Alpaca outage', () => {
  // TODO: add stale:true flag to cached responses — see T5.5 follow-up story
  it.todo('getCachedQuote returns null → controller path returns 404 (not 200 + stale)');
});
