# Story T1.8: Market Data Caching and API Failure Resilience

Status: done

## Story

As the system,
I want to cache all market quotes and handle upstream API failures gracefully,
So that students experience fast load times and no order is ever placed on unavailable data.

## Acceptance Criteria

1. **Given** a market quote is requested and a cached quote < 30s old exists in Redis,
   **When** the request is processed,
   **Then** the cached quote is returned without making any upstream API call (Alpaca or CoinGecko).

2. **Given** the upstream API returns HTTP 429 (rate limited) or a 5xx server error,
   **When** the system processes the request,
   **Then** exponential backoff is applied — up to 3 attempts with delays of 100ms, 200ms, 400ms — before surfacing a user-friendly error; the error response uses the standard `{ error: { code, message } }` envelope.

3. **Given** a student attempts to trade and the market data API is unavailable (all retries exhausted, `getCachedQuote` returns `null`),
   **When** the order is submitted (T1.9),
   **Then** `getCachedQuote` returns `null` and calling code (T1.9 order service) must reject the order; cash balance and holdings remain unchanged.

## Tasks / Subtasks

- [x] Task 1 — Create `withRetry` utility (AC: 2)
  - [x] Create `apps/api/src/lib/retry.ts`
  - [x] Export `withRetry<T>(fn: () => Promise<T>, opts?: { maxAttempts?: number; baseDelayMs?: number }): Promise<T>`
  - [x] Retry condition: Axios error where `error.response?.status === 429` OR `error.response?.status >= 500`; also retry on network errors (no response: `ECONNREFUSED`, `ETIMEDOUT`)
  - [x] Backoff formula: `delay = baseDelayMs * 2^(attempt - 1)` — attempt 1: 100ms, attempt 2: 200ms, attempt 3: 400ms
  - [x] Default: `maxAttempts = 3`, `baseDelayMs = 100`
  - [x] After `maxAttempts` exhausted: re-throw the last error (do NOT swallow)
  - [x] Non-retryable errors (4xx except 429): throw immediately without retrying
  - [x] Use `setTimeout` wrapped in a `Promise` for delays (mockable in tests via `vi.useFakeTimers()`)

- [x] Task 2 — Apply retry in `alpaca.service.ts` (AC: 2, 3)
  - [x] Import `withRetry` from `../../lib/retry`
  - [x] In `getStockQuote`: wrap the `alpacaClient.get(...)` call in `withRetry` — keep outer `try/catch` that returns `null` (so 404 for unknown symbol still returns null gracefully rather than throwing)
  - [x] In `getStockBars`: wrap `alpacaClient.get(...)` in `withRetry` — keep outer `try/catch` that returns `[]`
  - [x] Leave `searchStocks` as-is (search does not require retry — user can retype)

- [x] Task 3 — Apply retry in `coingecko.service.ts` (AC: 2, 3)
  - [x] Import `withRetry` from `../../lib/retry`
  - [x] In `getCryptoQuote`: wrap `cgClient.get('/simple/price', ...)` in `withRetry` — keep outer `try/catch` that returns `null`
  - [x] In `getCryptoBars`: wrap `cgClient.get(...)` in `withRetry` — keep outer `try/catch` that returns `[]`
  - [x] Leave `getCryptoSearchResults` as-is (synchronous, no HTTP call)

- [x] Task 4 — Tiered bars TTLs + cache empty results in `market-cache.service.ts` (AC: 1, D-2, D-3)
  - [x] Replace flat `BARS_TTL = 60` constant with a per-timeframe map:
    ```
    const BARS_TTL: Record<string, number> = {
      '1D':  30,    // 30s — intraday bars change fast
      '1W':  300,   // 5 min
      '1M':  900,   // 15 min
      '3M':  1800,  // 30 min
      '1Y':  3600,  // 1 hour
    };
    const EMPTY_BARS_TTL = 300; // 5 min — prevents hammering Alpaca on weekends/holidays
    ```
  - [x] In `getCachedBars`: remove the `if (bars.length > 0)` guard — always cache the result
  - [x] Use `BARS_TTL[timeframe] ?? 60` for non-empty results; use `EMPTY_BARS_TTL` when `bars.length === 0`
  - [x] `QUOTE_TTL` remains 30s — no change

- [x] Task 5 — Tests for `withRetry` in `apps/api/src/lib/retry.test.ts` (AC: 2)
  - [x] Use `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach`
  - [x] Test: non-retryable error (HTTP 400) → throws immediately, `fn` called exactly once
  - [x] Test: HTTP 429 → `fn` called 3 times total (1 original + 2 retries); throws after exhaustion
  - [x] Test: HTTP 500 → `fn` called 3 times total; throws after exhaustion
  - [x] Test: network error (no `response` on AxiosError) → retries 3 times; throws after exhaustion
  - [x] Test: succeeds on 2nd attempt → `fn` called twice; returns value (no throw)
  - [x] Test: backoff delays are correct — use `vi.advanceTimersByTimeAsync` to verify `fn` isn't called before the delay elapses
  - [x] Test: custom `maxAttempts = 1` → `fn` called once even for 429

- [x] Task 6 — Tests for `market-cache.service.ts` in `apps/api/src/services/market/market-cache.service.test.ts` (AC: 1, 2, 3)
  - [x] Mock `../../config/redis` (`getCache`, `setCache`)
  - [x] Mock `./alpaca.service` (`getStockQuote`, `getStockBars`)
  - [x] Mock `./coingecko.service` (`getCryptoQuote`, `getCryptoBars`)
  - [x] **AC1 — cache hit**: `getCache` returns a cached quote → `getStockQuote` NOT called; cached value returned
  - [x] **AC1 — cache miss**: `getCache` returns null → `getStockQuote` called; result stored via `setCache` with correct key and TTL (30s)
  - [x] **AC1 — crypto cache miss**: `getCache` returns null → `getCryptoQuote` called (not `getStockQuote`)
  - [x] **AC2 — upstream returns null after retries**: `getStockQuote` returns null (simulating retries exhausted) → `getCachedQuote` returns null; `setCache` NOT called
  - [x] **AC3 — getCachedQuote null propagation**: verify `getCachedQuote` returns null when both cache and upstream have no data (T1.9 will use this to block order)
  - [x] **D-2 — empty bars cached**: `getStockBars` returns `[]` → `setCache` still called with `EMPTY_BARS_TTL` (300s)
  - [x] **D-2 — non-empty bars cached**: `getStockBars` returns bars → `setCache` called with `BARS_TTL['1M']` (900s)
  - [x] **D-3 — tiered TTLs**: `getCachedBars` called with timeframe `'1Y'` → `setCache` called with TTL = 3600

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action |
|------|--------|--------|
| `apps/api/src/services/market/market-cache.service.ts` | ✅ Cache-first pattern implemented; `quote:{assetType}:{symbol}` keys; `bars:{assetType}:{symbol}:{timeframe}` keys | Task 4 only — replace `BARS_TTL` constant and remove `if (bars.length > 0)` guard |
| `apps/api/src/services/market/alpaca.service.ts` | ✅ `getStockQuote(symbol, assetType)`, `getStockBars(symbol, timeframe)`, `searchStocks(query)` — bare try/catch | Task 2 only — add `withRetry` to quote and bars functions |
| `apps/api/src/services/market/coingecko.service.ts` | ✅ `getCryptoQuote`, `getCryptoBars`, `getCryptoSearchResults` — bare try/catch | Task 3 only — add `withRetry` to quote and bars functions |
| `apps/api/src/controllers/market.controller.ts` | ✅ `getQuote` returns 503 on throw; `getChart` returns 503 on throw (T1.7 P-1 patch) | No changes — controller already handles service throws correctly |
| `apps/api/src/config/redis.ts` | ✅ ioredis client with `maxRetriesPerRequest: 3` at Redis level | No changes |
| `apps/api/src/jobs/index.ts` | ✅ node-cron jobs; hourly holdings price update already calls `getCachedQuote` | No changes — will benefit automatically from retry logic |
| `apps/api/src/lib/` | ❌ Does not exist | Create directory + `retry.ts` |
| `packages/shared-types/src/market.ts` | ✅ `Quote`, `OHLCVBar`, `SearchResult`, `AssetType` types | No changes |

### Current `market-cache.service.ts` — bars caching gap

```typescript
// CURRENT — empty bars not cached (hammers Alpaca every mount on weekends/market close)
if (bars.length > 0) await setCache(key, bars, BARS_TTL);
return bars;

// AFTER — always cache; empty result cached with longer TTL to prevent thrashing
const ttl = bars.length > 0 ? (BARS_TTL[timeframe] ?? 60) : EMPTY_BARS_TTL;
await setCache(key, bars, ttl);
return bars;
```

### `withRetry` Implementation Sketch

```typescript
// apps/api/src/lib/retry.ts
import axios from 'axios';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 100 } = opts;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      // Non-retryable: 4xx errors except 429 (rate limit)
      if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      // Do not sleep after the last attempt
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError;
}
```

### How `withRetry` integrates into `alpaca.service.ts`

```typescript
// BEFORE — no retry
export async function getStockQuote(symbol: string, assetType: 'stock' | 'etf' = 'stock'): Promise<Quote | null> {
  try {
    const res = await alpacaClient.get(`/v2/stocks/${symbol}/snapshot`);
    // ... map to Quote
  } catch {
    return null;
  }
}

// AFTER — retry for 429/5xx; unknown symbol (404) still returns null
export async function getStockQuote(symbol: string, assetType: 'stock' | 'etf' = 'stock'): Promise<Quote | null> {
  try {
    const res = await withRetry(() => alpacaClient.get(`/v2/stocks/${symbol}/snapshot`));
    // ... map to Quote (unchanged)
  } catch {
    return null;  // covers: retries exhausted + non-retryable (404 for unknown symbol)
  }
}
```

### T1.9 Integration Guidance (AC3 — order-time guard)

T1.8 does **not** implement the order controller. However, to satisfy AC3, the T1.9 developer must:

1. Call `getCachedQuote(symbol, assetType)` at the start of the order handler
2. If result is `null` → return `422` with `{ error: { code: 'MARKET_DATA_UNAVAILABLE', message: 'Cannot place order: market data is currently unavailable. Please try again.' } }`
3. Proceed with order execution only when quote is non-null

The `getCachedQuote` null return is guaranteed by T1.8's retry exhaustion behaviour: after 3 attempts, the service call inside `alpaca.service.ts` / `coingecko.service.ts` throws, which is caught by the outer try/catch and returns `null`. This propagates through `market-cache.service.ts` unchanged.

### Deferred Items from T1.7 Review — Addressed Here

| Deferred | Status |
|---------|--------|
| **D-2** — Empty bars not cached → hammers Alpaca on weekends | ✅ Fixed in Task 4 (`EMPTY_BARS_TTL = 300`) |
| **D-3** — `BARS_TTL = 60s` flat for all timeframes | ✅ Fixed in Task 4 (tiered TTLs) |
| **D-1** — 1D bars empty on weekends (calendar vs trading days) | 🔴 Remains deferred — requires market-hours calendar. Acceptable: `EMPTY_BARS_TTL` prevents hammering; student sees empty chart with "Prices delayed" banner (T1.7 P-5 already in place). |
| **D-4** — Pre/post-market stale `dailyBar` price | 🔴 Remains deferred — Alpaca snapshot API behaviour. Out of T1.8 scope. |
| **D-5** — `prevClose = 0` for IPO stocks | 🔴 Remains deferred — niche edge case; 0 change display is acceptable for IPO week. |

### Testing Pattern — Fake Timers with Vitest

```typescript
// retry.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { withRetry } from './retry';

function makeAxiosError(status: number) {
  const err = new axios.AxiosError('error', undefined, undefined, undefined, {
    status,
    data: {},
    headers: {},
    config: {} as any,
    statusText: '',
  });
  return err;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('retries 3 times on 429 then throws', async () => {
  const fn = vi.fn().mockRejectedValue(makeAxiosError(429));
  const promise = withRetry(fn);
  // advance through all backoff delays
  await vi.runAllTimersAsync();
  await expect(promise).rejects.toThrow();
  expect(fn).toHaveBeenCalledTimes(3);
});
```

### Key Redis Key Namespaces (no change from T1.7)

| Data | Key Pattern | TTL |
|------|-------------|-----|
| Quote | `quote:{assetType}:{symbol}` | 30s |
| Bars (non-empty) | `bars:{assetType}:{symbol}:{timeframe}` | 30s–3600s (tiered) |
| Bars (empty/weekend) | `bars:{assetType}:{symbol}:{timeframe}` | 300s |
| News | `market:news` | 300s |

### Files Modified Summary

| File | Change |
|------|--------|
| `apps/api/src/lib/retry.ts` | **NEW** — `withRetry<T>` with exponential backoff |
| `apps/api/src/lib/retry.test.ts` | **NEW** — 7 unit tests for retry logic |
| `apps/api/src/services/market/alpaca.service.ts` | Wrap `getStockQuote` and `getStockBars` calls in `withRetry` |
| `apps/api/src/services/market/coingecko.service.ts` | Wrap `getCryptoQuote` and `getCryptoBars` calls in `withRetry` |
| `apps/api/src/services/market/market-cache.service.ts` | Replace flat `BARS_TTL`; always cache bars (tiered TTL); `EMPTY_BARS_TTL` constant |
| `apps/api/src/services/market/market-cache.service.test.ts` | **NEW** — 8 unit tests for cache-hit/miss and empty-bars behaviour |

## Dev Agent Record

### Implementation Notes

- `withRetry` uses `axios.isAxiosError()` to distinguish Axios errors from other throws; only retries 429, 5xx, and no-response errors. Non-Axios errors (e.g. programming errors) rethrow immediately.
- Fake timer pattern for retry tests: rejection handler attached *before* `vi.runAllTimersAsync()` to avoid `PromiseRejectionHandledWarning` — store `expect(withRetry(fn)).rejects.toThrow()` then advance timers.
- `alpaca.service.ts` and `coingecko.service.ts`: outer `try/catch` kept intact — `withRetry` throws after exhaustion, caught by outer catch which returns `null`/`[]`. This preserves existing null-safe contract for callers.
- `BARS_TTL` changed from flat constant to `Record<string, number>` map; `?? 60` fallback guards against any unknown timeframe key.
- `setCache` is now called unconditionally in `getCachedBars` — empty arrays cached with `EMPTY_BARS_TTL=300s` (D-2 fix).

### Completion Notes

- All 6 tasks complete. 93/93 tests pass (was 68 before T1.8).
- New tests: 13 (retry.test.ts) + 12 (market-cache.service.test.ts) = +25 tests.
- No regressions in `market.controller.test.ts` (12 tests) or `auth.controller.test.ts` (34 tests) or `analytics.controller.test.ts` (22 tests).
- ACs satisfied:
  - AC1: `market-cache.service.test.ts` — cache-hit test verifies `getStockQuote` never called
  - AC2: `retry.test.ts` — 429/5xx/network retry tests with backoff timing verification
  - AC3: `market-cache.service.test.ts` — null propagation test; T1.9 guidance documented in Dev Notes
- D-2 fixed: empty bars now cached at 300s TTL
- D-3 fixed: tiered TTLs 30s (1D) → 3600s (1Y)

## File List

- `apps/api/src/lib/retry.ts` — NEW
- `apps/api/src/lib/retry.test.ts` — NEW
- `apps/api/src/services/market/alpaca.service.ts` — MODIFIED
- `apps/api/src/services/market/coingecko.service.ts` — MODIFIED
- `apps/api/src/services/market/market-cache.service.ts` — MODIFIED
- `apps/api/src/services/market/market-cache.service.test.ts` — NEW

## Change Log

- 2026-03-26: T1.8 implemented — `withRetry` utility, exponential backoff for Alpaca/CoinGecko, tiered bar TTLs, empty-bar caching. 93 tests passing.
