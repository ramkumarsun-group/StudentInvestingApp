# Story T1.6: Asset Search

Status: done

## Story

As a student,
I want to search for stocks, ETFs, and cryptocurrencies by name or ticker,
so that I can find assets I want to trade.

## Acceptance Criteria

1. **Given** I type a ticker or name (minimum 2 characters) in the search bar,
   **When** the search executes,
   **Then** results appear within 500ms showing name, ticker, asset type (stock/ETF/crypto), and current price.

2. **Given** I search for a known stock ticker (e.g. "AAPL"),
   **When** results appear,
   **Then** the exact ticker match appears at the top of the list.

3. **Given** I search for a cryptocurrency (e.g. "bitcoin"),
   **When** results appear,
   **Then** crypto results are clearly labelled "Crypto" (capitalised, not lowercase "crypto").

4. **Given** no results match my query (≥2 chars entered),
   **When** results would appear,
   **Then** a "No results found" message is shown (not an empty dropdown).

## Tasks / Subtasks

- [x] Task 1 — Add `price` to `SearchResult` type (AC: 1)
  - [x] In `packages/shared-types/src/market.ts`: add `price?: number` field to `SearchResult` interface

- [x] Task 2 — Fix minimum query length and add price + exact-match sort to `searchTickers` (AC: 1, 2)
  - [x] In `apps/api/src/controllers/market.controller.ts:28`: change `q.length < 1` to `q.length < 2`
  - [x] After fetching `stocks` and `crypto`, fetch quote for each result via `getCachedQuote` (max 15 concurrent, use `Promise.allSettled`)
  - [x] Merge price into each result: `result.price = quote?.price ?? undefined`
  - [x] Sort combined results: exact ticker match (case-insensitive) first, then rest
  - [x] Keep `.slice(0, 15)` cap after sort

- [x] Task 3 — Fix search UI: min 2 chars trigger, price display, Crypto label, No results state (AC: 1, 2, 3, 4)
  - [x] In `apps/web/app/(dashboard)/trade/page.tsx:42`: change `enabled: searchQuery.length > 0` to `enabled: searchQuery.length >= 2`
  - [x] In the search dropdown (`trade/page.tsx:100-118`): add price display — show `formatUSD(r.price)` when `r.price` is defined, right-aligned next to assetType badge
  - [x] Capitalise assetType label: change `{r.assetType}` to `{r.assetType.charAt(0).toUpperCase() + r.assetType.slice(1)}` (or a helper) so "crypto" → "Crypto", "stock" → "Stock", "etf" → "ETF"
  - [x] Add "No results found" message: when `searchQuery.length >= 2 && searchData.length === 0 && !isSearchLoading`, render a non-interactive row with "No results found" text

- [x] Task 4 — Write tests (AC: 1, 2, 3, 4)
  - [x] Create `apps/api/src/controllers/market.controller.test.ts`
  - [x] Mock `../services/market/market-cache.service` and `../services/market/alpaca.service` and `../services/market/coingecko.service`
  - [x] Test: query < 2 chars → returns `{ data: [] }` with status 200
  - [x] Test: valid query → calls `searchStocks` and `getCryptoSearchResults`
  - [x] Test: exact ticker match is first in results (e.g. query "AAPL" → AAPL result at index 0 even if other results present)
  - [x] Test: results capped at 15 items
  - [x] Test: price field populated from `getCachedQuote` result

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action |
|------|--------|--------|
| `apps/api/src/controllers/market.controller.ts` | ✅ Exists — `searchTickers`, `getQuote`, `getChart`, `getNews`, `getTrending` | Task 2 only — patch `searchTickers` |
| `apps/api/src/services/market/alpaca.service.ts` | ✅ `searchStocks(query)` returns `SearchResult[]` (no price) | No changes — call as-is |
| `apps/api/src/services/market/coingecko.service.ts` | ✅ `getCryptoSearchResults(query)` synchronous, returns 10 hardcoded cryptos | No changes |
| `apps/api/src/services/market/market-cache.service.ts` | ✅ `getCachedQuote(symbol, assetType)` returns `Quote \| null` with 30s TTL | Use to fetch price for each search result |
| `apps/web/app/(dashboard)/trade/page.tsx` | ✅ Full trade UI — search dropdown, quote, chart, order panel | Task 3 patches only |
| `packages/shared-types/src/market.ts` | ✅ `SearchResult` interface — no `price` field yet | Task 1: add `price?: number` |

### Current `searchTickers` (market.controller.ts:26-35)

```typescript
// CURRENT — min 1 char, no price, no sort
export async function searchTickers(req: Request, res: Response) {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 1) return res.json({ data: [] });

  const [stocks, crypto] = await Promise.all([
    searchStocks(q),
    Promise.resolve(getCryptoSearchResults(q)),
  ]);
  return res.json({ data: [...stocks, ...crypto].slice(0, 15) });
}
```

```typescript
// AFTER — min 2 chars, price enrichment, exact-match sort
export async function searchTickers(req: Request, res: Response) {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ data: [] });

  const [stocks, crypto] = await Promise.all([
    searchStocks(q),
    Promise.resolve(getCryptoSearchResults(q)),
  ]);

  const combined = [...stocks, ...crypto].slice(0, 15);

  // Enrich with price (best-effort — don't fail if cache miss)
  const enriched = await Promise.allSettled(
    combined.map(async (result) => {
      const quote = await getCachedQuote(result.symbol, result.assetType);
      return { ...result, price: quote?.price };
    }),
  );

  const results = enriched
    .filter((r): r is PromiseFulfilledResult<SearchResult & { price?: number }> => r.status === 'fulfilled')
    .map((r) => r.value);

  // Exact ticker match first
  const qUpper = q.toUpperCase();
  results.sort((a, b) => {
    if (a.symbol === qUpper) return -1;
    if (b.symbol === qUpper) return 1;
    return 0;
  });

  return res.json({ data: results });
}
```

### Import change needed in market.controller.ts

Add `getCachedQuote` to the existing import:
```typescript
// CURRENT line 2
import { getCachedQuote, getCachedBars } from '../services/market/market-cache.service';
// Already imported — no change needed. getCachedBars used by getChart.
```

Also need to import `SearchResult` for the type annotation in `searchTickers`:
```typescript
import { AssetType, SearchResult } from '@student-investing/shared-types';
```

### UI Patch Pattern for Search Dropdown (trade/page.tsx)

Extend `searchData` type to include price:
```typescript
const searchData = (searchResults ?? []) as { symbol: string; name: string; assetType: string; price?: number }[];
```

Add `isSearchLoading`:
```typescript
const { data: searchResults, isLoading: isSearchLoading } = useQuery({ ... });
```

No-results state — add after the dropdown list:
```tsx
{/* Existing: searchData.length > 0 && searchQuery */}
{searchQuery.length >= 2 && !isSearchLoading && searchData.length === 0 && (
  <div className="absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-10 overflow-hidden">
    <p className="px-4 py-3 text-sm text-slate-400">No results found</p>
  </div>
)}
```

Asset type label helper (inline, no new file needed):
```typescript
function formatAssetType(type: string): string {
  if (type === 'etf') return 'ETF';
  return type.charAt(0).toUpperCase() + type.slice(1);
}
```

### SearchResult `price` field: important nuance

`getCachedQuote` may return `null` (cache miss or API down). The price field is therefore `price?: number` — optional. The UI should only display the price when `r.price !== undefined`. This keeps search fast even when market data is not warm.

### alpaca.service `searchStocks` — important limitation

`searchStocks` currently calls `GET /v2/assets?status=active&asset_class=us_equity` which returns ALL active assets and filters client-side. This is acceptable for demo/Phase 1 but slow on cold cache. Do NOT change this in T1.6 (scope: T1.8 handles caching/resilience). Just call as-is.

### Test Setup Pattern for market.controller.test.ts

Follow the same pattern as `analytics.controller.test.ts`:
```typescript
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

import { searchTickers } from './market.controller';
import { searchStocks } from '../services/market/alpaca.service';
import { getCryptoSearchResults } from '../services/market/coingecko.service';
import { getCachedQuote } from '../services/market/market-cache.service';
```

Mock `res` object (same as analytics.controller.test.ts):
```typescript
const mockRes = {
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
} as unknown as Response;
```

Note: `market.controller.ts` also imports `getCache`, `setCache` from `'../config/redis'` and `axios` (for `getNews`). Mock these too:
```typescript
vi.mock('../config/redis', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));
vi.mock('axios');
vi.mock('../config/env', () => ({
  env: {
    NEWS_API_KEY: 'test-news-key',
    ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
    ALPACA_API_KEY: 'test-key',
    ALPACA_API_SECRET: 'test-secret',
  },
}));
```

### Scope Boundaries — DO NOT Implement

- API failure fallback for market data (→ T1.8)
- Redis cache warming for search (→ T1.8)
- Price chart on search result click (→ T1.7)
- Trending assets section updates (already implemented; do not modify)
- Pagination or infinite scroll for search results
- Server-side quote fetch for all assets up-front — price is best-effort only

### Performance Note (AC1: 500ms)

The `searchStocks` call fetches ALL assets from Alpaca and filters client-side. With price enrichment via `Promise.allSettled`, worst-case latency is `searchStocks_latency + max(quote_cache_latency)`. Since `getCachedQuote` hits Redis (sub-ms on warm cache), the bottleneck is `searchStocks`. If Redis is cold, price fields will be `undefined` but search still returns. This satisfies the 500ms AC when Redis is warm (the normal state after T1.8).

### References

- [Source: apps/api/src/controllers/market.controller.ts:26-35] — current `searchTickers`
- [Source: apps/api/src/services/market/alpaca.service.ts:79-97] — `searchStocks`, returns `SearchResult[]`
- [Source: apps/api/src/services/market/coingecko.service.ts:65-71] — `getCryptoSearchResults`, synchronous
- [Source: apps/api/src/services/market/market-cache.service.ts] — `getCachedQuote(symbol, assetType)`
- [Source: packages/shared-types/src/market.ts:35-40] — `SearchResult` interface (no `price` yet)
- [Source: apps/web/app/(dashboard)/trade/page.tsx:38-43] — search query config
- [Source: apps/web/app/(dashboard)/trade/page.tsx:98-118] — search dropdown UI
- [Source: docs/architecture.md#Redis Key Namespace] — `quote:{TICKER}` 30s TTL
- [Source: docs/stories/t1-5-ferpa-compliance-dpa-and-no-third-party-trackers.md] — test mock pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `price?: number` to `SearchResult` in `packages/shared-types/src/market.ts`.
- Patched `searchTickers` in `market.controller.ts`: min 2 chars guard, `Promise.allSettled` price enrichment via `getCachedQuote`, exact ticker sort, 15-item cap preserved. Added `SearchResult` import from shared-types.
- Patched `trade/page.tsx`: search `enabled` on `>= 2` chars, `isSearchLoading` destructured, price shown in dropdown via `formatUSD`, asset type label capitalised with ETF special-cased, "No results found" row added.
- Created `market.controller.test.ts` with 6 tests (all passing): empty query, single-char query, valid query calls both services, exact-match sort, 15-item cap, price from cache hit.
- Total: 49 tests passing (46 API + 3 web), no regressions.

### File List

- `packages/shared-types/src/market.ts` — modified (added `price?: number` to SearchResult)
- `apps/api/src/controllers/market.controller.ts` — modified (min 2 chars, price enrichment, exact-match sort)
- `apps/api/src/controllers/market.controller.test.ts` — created (6 tests)
- `apps/web/app/(dashboard)/trade/page.tsx` — modified (min 2 chars, price display, capitalised label, no-results state)
- `docs/stories/t1-6-asset-search.md` — this file
- `docs/stories/sprint-status.yaml` — updated (t1-6 → review)

### Change Log

- 2026-03-25: T1.6 implemented — SearchResult price field, searchTickers min-2/price-enrichment/sort, trade UI patches, 6 new tests (49/49 passing) (claude-sonnet-4-6)
