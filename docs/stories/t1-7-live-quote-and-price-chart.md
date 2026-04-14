# Story T1.7: Live Quote and Price Chart

Status: done

## Story

As a student,
I want to view the live price and historical chart for any asset,
So that I can make an informed decision before placing a trade.

## Acceptance Criteria

1. **Given** I select an asset from search results,
   **When** the asset detail page loads,
   **Then** I see current price, day change ($ amount and %), last updated timestamp, and a default 1M OHLCV chart.

2. **Given** I am on the asset detail page,
   **When** I click a timeframe button (1D / 1W / 1M / 3M / 1Y),
   **Then** the chart updates within 500ms (Redis warm — cache hit).

3. **Given** the market data API is unavailable,
   **When** I view an asset,
   **Then** the last cached price is shown with a "Prices delayed" indicator; no error page is displayed.

## Tasks / Subtasks

- [x] Task 1 — Fix `getStockQuote` to return real day change (AC: 1)
  - [x] In `apps/api/src/services/market/alpaca.service.ts`: replace the two-call pattern with Alpaca snapshot API `GET /v2/stocks/{symbol}/snapshot`
  - [x] Extract: `price = snapshot.latestTrade?.p ?? snapshot.dailyBar?.c ?? 0`
  - [x] Extract: `change = (snapshot.dailyBar?.c ?? 0) - (snapshot.prevDailyBar?.c ?? 0)`
  - [x] Extract: `changePct = snapshot.prevDailyBar?.c ? (change / snapshot.prevDailyBar.c) * 100 : 0`
  - [x] Keep existing error handling: `catch → return null`
  - [x] Keep `name: symbol` (full name not available from snapshot without extra call)

- [x] Task 2 — Fix `getCryptoQuote` to return $ change (AC: 1)
  - [x] In `apps/api/src/services/market/coingecko.service.ts`: compute `change` from existing `changePct`
  - [x] Formula: `change = price / (1 + changePct / 100) * (changePct / 100)` (i.e. yesterday_price = price / (1 + pct/100), change = price - yesterday_price)
  - [x] Simpler inline form: `const prevPrice = data.usd / (1 + (data.usd_24h_change ?? 0) / 100); change = data.usd - prevPrice`
  - [x] Guard: if `changePct === 0` or `changePct` is null, set `change = 0`

- [x] Task 3 — Add `3M` timeframe support (AC: 2)
  - [x] In `apps/api/src/services/market/alpaca.service.ts` `getStockBars`: add `'3M': { period: 90, unit: 'day', alpacaTf: '1Day' }` to `tfMap`
  - [x] Update function signature: `timeframe: '1D' | '1W' | '1M' | '3M' | '1Y'`
  - [x] In `apps/api/src/services/market/coingecko.service.ts` `getCryptoBars`: `getCryptoBars` takes `days: number` — no signature change needed; caller passes `90`
  - [x] In `apps/api/src/services/market/market-cache.service.ts` `getCachedBars`:
    - [x] Update `daysMap`: add `'3M': 90`
    - [x] Update signature: `timeframe: '1D' | '1W' | '1M' | '3M' | '1Y'`
  - [x] In `apps/api/src/controllers/market.controller.ts` `getChart`:
    - [x] Update cast: `const timeframe = (req.query.timeframe as '1D' | '1W' | '1M' | '3M' | '1Y') || '1M'`

- [x] Task 4 — Create dedicated asset detail page (AC: 1, 2, 3)
  - [x] Create `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` — `'use client'`
  - [x] Use `useParams()` to read `ticker` (string); use `useSearchParams()` to read `type` (default `'stock'`)
  - [x] Quote query: `useQuery({ queryKey: ['quote', ticker, assetType], queryFn: () => apiClient.get(...), refetchInterval: 30000, retry: 1 })`
  - [x] Bars query: `useQuery({ queryKey: ['chart', ticker, assetType, timeframe], queryFn: () => apiClient.get(...), enabled: !!ticker })`
  - [x] Timeframe state: `useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M')` — default 1M
  - [x] Display: price (`formatUSD`), change `+$X.XX` / `-$X.XX`, changePct (`formatPercent`), `updatedAt` as `new Date(quote.updatedAt).toLocaleTimeString()`
  - [x] Color: green for positive change, rose for negative — use `cn()` and Tailwind `text-emerald-400` / `text-rose-400`
  - [x] Timeframe buttons: 1D, 1W, 1M, 3M, 1Y — same pattern as existing `trade/page.tsx` timeframe buttons
  - [x] Chart: reuse `<StockChart data={barsData} />` from `@/components/charts/StockChart`
  - [x] AC3 — "Prices delayed" indicator: if `isError` on the quote query, render a yellow banner `"Prices may be delayed"` above the quote; if `quoteData` is null AND `isError`, show a skeleton/placeholder price section (do NOT render error page or throw)
  - [x] Order panel: include placeholder buy/sell panel (same structure as `trade/page.tsx` order panel) — button should be disabled with tooltip "Order execution coming soon" until T1.9/T1.10 (do NOT implement order mutation — that is T1.9 scope)

- [x] Task 5 — Update search navigation (AC: 1)
  - [x] In `apps/web/app/(dashboard)/trade/page.tsx`: change search result `onClick` to navigate to `[ticker]` page
  - [x] Replace: `setSymbol(r.symbol); setAssetType(...); setSearchQuery('')`
  - [x] With: `router.push(\`/trade/${encodeURIComponent(r.symbol)}?type=${r.assetType}\`); setSearchQuery('')`
  - [x] Import `useRouter` from `'next/navigation'` (already in the file via `useRouter`)
  - [x] Keep the existing inline quote/chart panel in `trade/page.tsx` — it still shows the default symbol on page load. Only the search click changes.

- [x] Task 6 — Write tests (AC: 1, 2, 3)
  - [x] In `apps/api/src/controllers/market.controller.test.ts`:
    - [x] Add test: `getChart` with `'3M'` timeframe → calls `getCachedBars` with `'3M'`
    - [x] Add test: `getQuote` returns 404 when `getCachedQuote` returns `null`
    - [x] Add test: `getQuote` returns 200 with `change` and `changePct` populated (mock quote with non-zero values)
  - [x] In `apps/api/src/services/market/alpaca.service.ts` — no new test file needed; snapshot is covered by existing mock pattern
  - [x] All 63 existing tests must continue passing

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Action |
|------|--------|--------|
| `apps/web/components/charts/StockChart.tsx` | ✅ AreaChart with green/red gradient, dayjs formatting, Recharts | Import and use as-is — no changes |
| `apps/api/src/services/market/market-cache.service.ts` | ✅ `getCachedQuote`, `getCachedBars` | Add `'3M'` to daysMap only |
| `apps/api/src/services/market/alpaca.service.ts` | ✅ `getStockBars`, `searchStocks` | Replace `getStockQuote` with snapshot API; add `'3M'` to `getStockBars` |
| `apps/api/src/services/market/coingecko.service.ts` | ✅ `getCryptoQuote`, `getCryptoBars`, `getCryptoSearchResults` | Fix `change` in `getCryptoQuote`; no bars change needed |
| `apps/api/src/controllers/market.controller.ts` | ✅ `getQuote`, `getChart`, `searchTickers`, `getNews`, `getTrending` | Add `'3M'` to `getChart` type cast only |
| `apps/web/app/(dashboard)/trade/page.tsx` | ✅ Search + inline quote/chart + order panel | Task 5: change `onClick` only |
| `packages/shared-types/src/market.ts` | ✅ `Quote` has `change`, `changePct`, `updatedAt` — ready | No changes needed |
| `formatUSD`, `formatPercent` | ✅ `@student-investing/shared-utils` | Import in new page |
| `cn()` utility | ✅ `@/lib/utils` | Use for conditional Tailwind classes |
| `apiClient` | ✅ `@/lib/api-client` | Import in new page |

### Critical: T1.6 Patches That Affect This Story

- **P-1** (cache key): Cache key is now `quote:${assetType}:${symbol}` and `bars:${assetType}:${symbol}:${timeframe}`. The `getCachedQuote` and `getCachedBars` functions already use this format. Do NOT invent a different key scheme.
- **P-2** (URL encoding): When navigating from search to `[ticker]` page, use `encodeURIComponent(r.symbol)` in the URL. Read `ticker` back via `useParams()` which will decode it automatically.
- **P-3** (try/catch): `searchTickers` already has a try/catch. All other market controller functions should also have try/catch (they already do via the service layer returning null on errors).

### Alpaca Snapshot API — Key Details

**Endpoint:** `GET /v2/stocks/{symbol}/snapshot`
**Response shape:**
```typescript
{
  latestTrade: { p: number; s: number; t: string; /* price, size, timestamp */ },
  latestQuote: { ap: number; bp: number; /* ask price, bid price */ },
  minuteBar: { o: number; h: number; l: number; c: number; v: number; t: string },
  dailyBar: { o: number; h: number; l: number; c: number; v: number; t: string },
  prevDailyBar: { o: number; h: number; l: number; c: number; v: number; t: string },
}
```

**Safe extraction (null-guard everything — snapshot can return partial data):**
```typescript
export async function getStockQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await alpacaClient.get(`/v2/stocks/${symbol}/snapshot`);
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
      assetType: 'stock',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
```

**Why snapshot over two calls:** Single network round trip; gives `prevDailyBar` for accurate day change; same Alpaca free-tier quota.

### CoinGecko $ Change Fix

```typescript
// In getCryptoQuote — after extracting changePct:
const changePct = data.usd_24h_change ?? 0;
const prevPrice = changePct !== 0 ? data.usd / (1 + changePct / 100) : data.usd;
const change = data.usd - prevPrice;

return {
  ...
  change,     // was hardcoded 0 — now computed
  changePct,
  ...
};
```

### `[ticker]` Page Structure

```
apps/web/app/(dashboard)/trade/[ticker]/page.tsx
```

**Route:** `/trade/AAPL?type=stock` or `/trade/BTC?type=crypto`

**Page component skeleton (implement this exactly):**
```typescript
'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';
import StockChart from '@/components/charts/StockChart';

export default function TickerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticker = String(params.ticker || '').toUpperCase();
  const assetType = (searchParams.get('type') as 'stock' | 'etf' | 'crypto') || 'stock';
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');

  const { data: quote, isError: quoteError } = useQuery({ ... refetchInterval: 30000, retry: 1 });
  const { data: bars } = useQuery({ queryKey: ['chart', ticker, assetType, timeframe], ... });

  const quoteData = quote as Quote | undefined;
  const barsData = (bars ?? []) as { t: string; c: number }[];
  const isPositive = (quoteData?.changePct ?? 0) >= 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* "Prices delayed" banner — shown on API error, NOT an error page */}
      {quoteError && (
        <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-400/10 rounded-lg px-4 py-2">
          <AlertCircle size={14} />
          Prices may be delayed
        </div>
      )}

      {/* Quote header */}
      <div className="card p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xl font-bold text-white">{ticker}</p>
            <p className="text-3xl font-bold font-mono text-white mt-1">
              {quoteData ? formatUSD(quoteData.price) : '—'}
            </p>
            {quoteData && (
              <div className={cn('flex items-center gap-1 mt-1 text-sm font-medium',
                isPositive ? 'text-emerald-400' : 'text-rose-400')}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isPositive ? '+' : ''}{formatUSD(quoteData.change)} ({formatPercent(quoteData.changePct)})
              </div>
            )}
            {quoteData && (
              <p className="text-xs text-slate-500 mt-1">
                Updated {new Date(quoteData.updatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          {/* Timeframe buttons */}
          <div className="flex gap-1">
            {(['1D', '1W', '1M', '3M', '1Y'] as const).map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  timeframe === tf ? 'bg-brand-600 text-white' : 'bg-surface-800 text-slate-400 hover:text-slate-200')}>
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <StockChart data={barsData} />
        </div>
      </div>

      {/* Order panel placeholder — full impl in T1.9 */}
      <div className="card p-5">
        <h2 className="font-semibold text-white mb-4">Place Order</h2>
        <p className="text-sm text-slate-400">Order execution available soon.</p>
        <button disabled className="btn-primary w-full mt-4 opacity-50 cursor-not-allowed">
          Coming Soon
        </button>
      </div>
    </div>
  );
}
```

> **Note:** The order panel in T1.7 is a placeholder. T1.9 will replace it with the real buy form. Do NOT implement the `orderMutation` here.

### Search Navigation Update (`trade/page.tsx`)

Change the search result `onClick` handler (Task 5). The existing pattern:
```typescript
// BEFORE (T1.6)
onClick={() => {
  setSymbol(r.symbol);
  setAssetType(r.assetType === 'stock' || ... ? r.assetType : 'stock');
  setSearchQuery('');
}}
```
```typescript
// AFTER (T1.7)
onClick={() => {
  router.push(`/trade/${encodeURIComponent(r.symbol)}?type=${r.assetType}`);
  setSearchQuery('');
}}
```
`useRouter` is already imported in `trade/page.tsx`. Remove `setSymbol` and `setAssetType` calls from this handler only. The rest of the page state is unchanged.

### Quote API Response Shape

The `getQuote` controller at `apps/api/src/controllers/market.controller.ts` already returns:
```json
{ "data": { "symbol": "AAPL", "name": "AAPL", "price": 189.50, "change": 2.30, "changePct": 1.23, "assetType": "stock", "updatedAt": "2026-03-25T14:30:00Z" } }
```
The `[ticker]/page.tsx` should access: `r.data` via `apiClient.get(...).then(r => r.data)`.

`Quote` type from `@student-investing/shared-types`:
```typescript
interface Quote {
  symbol: string; name: string; price: number;
  change: number; changePct: number;
  volume?: number; marketCap?: number;
  assetType: 'stock' | 'etf' | 'crypto' | 'bond';
  updatedAt: string;
}
```

### `formatPercent` Behaviour

`formatPercent` from `@student-investing/shared-utils` formats as e.g. `"1.23%"`. To show `+1.23%` for positive values: prepend `isPositive ? '+' : ''` manually (the existing trade/page.tsx does NOT do this — add it in the [ticker] page for better UX).

### Scope Boundaries — DO NOT Implement

- Order mutation / trade execution → T1.9 (buy) and T1.10 (sell)
- WebSocket real-time streaming → Phase 2
- Bid/ask spread display → T1.9
- Holdings panel on [ticker] page → T1.12 (or pull from existing `HoldingsPanel` component from trade/page.tsx — optional)
- News section on [ticker] page → T1.14
- `market data resilience` (stale-beyond-TTL Redis fallback, exponential backoff) → T1.8

### Test Patterns

Follow the exact pattern from `apps/api/src/controllers/market.controller.test.ts`:
- All mocks declared at top before imports
- `mockRes` recreated in `beforeEach`
- `getCachedQuote` defaulted to `null` in `beforeEach`

New tests to add to the existing `market.controller.test.ts`:

```typescript
// getQuote — 404 when null
it('getQuote returns 404 when getCachedQuote returns null', async () => {
  vi.mocked(getCachedQuote).mockResolvedValue(null);
  await getQuote({ params: { symbol: 'AAPL' }, query: { type: 'stock' } } as unknown as Request, mockRes);
  expect(mockRes.status).toHaveBeenCalledWith(404);
});

// getQuote — 200 with quote
it('getQuote returns 200 with quote data', async () => {
  vi.mocked(getCachedQuote).mockResolvedValue({ symbol: 'AAPL', name: 'AAPL', price: 190, change: 2.5, changePct: 1.3, assetType: 'stock', updatedAt: new Date().toISOString() });
  await getQuote({ params: { symbol: 'AAPL' }, query: { type: 'stock' } } as unknown as Request, mockRes);
  expect(mockRes.json).toHaveBeenCalledWith({ data: expect.objectContaining({ price: 190, change: 2.5 }) });
});

// getChart — 3M timeframe
it('getChart passes 3M timeframe to getCachedBars', async () => {
  vi.mocked(getCachedBars).mockResolvedValue([]);
  await getChart({ params: { symbol: 'BTC' }, query: { type: 'crypto', timeframe: '3M' } } as unknown as Request, mockRes);
  expect(vi.mocked(getCachedBars)).toHaveBeenCalledWith('BTC', 'crypto', '3M');
});
```

You need to import `getQuote` and `getChart` in the test file — add them to the existing import:
```typescript
import { searchTickers, getQuote, getChart } from './market.controller';
```
And add `getCachedBars` to the mock import:
```typescript
import { getCachedQuote, getCachedBars } from '../services/market/market-cache.service';
```

### References

- [Source: docs/epics.md#T1.7] — acceptance criteria and FR10, FR22
- [Source: apps/api/src/services/market/alpaca.service.ts] — current `getStockQuote` (two calls → replace with snapshot)
- [Source: apps/api/src/services/market/coingecko.service.ts] — `getCryptoQuote` (change hardcoded 0 → fix)
- [Source: apps/api/src/services/market/market-cache.service.ts] — `getCachedBars` daysMap (add 3M)
- [Source: apps/web/components/charts/StockChart.tsx] — existing chart component (use as-is)
- [Source: apps/web/app/(dashboard)/trade/page.tsx] — existing trade page (Task 5 patch + pattern reference)
- [Source: packages/shared-types/src/market.ts] — `Quote` interface
- [Source: docs/stories/t1-6-asset-search.md] — P-1 cache key, P-2 URL encoding, P-3 try/catch patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks completed. 66 tests pass (63 pre-existing + 3 new).
- `getStockQuote` now uses Alpaca snapshot API for real day `change` / `changePct`; single network round-trip replaces two parallel calls.
- `getCryptoQuote` now computes `change` from `changePct` via reverse-percentage formula; guarded against zero changePct.
- `3M` timeframe added end-to-end: alpaca.service → market-cache.service → market.controller.
- `[ticker]/page.tsx` created with amber "Prices may be delayed" banner on API error (AC3), disabled order placeholder for T1.9.
- Search `onClick` in `trade/page.tsx` navigates to `/trade/[ticker]` route via `router.push`.
- **Code review patches applied (6 patches, 68/68 tests pass):**
  - P-1: `getQuote` + `getChart` wrapped in try/catch → 503 on Redis/service failure (Express 4 unhandled rejection fix)
  - P-2: T1.6 `assetType` bond guard restored in `trade/page.tsx` onClick; explicit runtime guard added in `[ticker]/page.tsx`
  - P-3: `getCryptoQuote` division-by-zero fix for `changePct = -100` edge case
  - P-4: `trade/page.tsx` timeframe state + buttons updated to include `'3M'`
  - P-5: `[ticker]/page.tsx` "Prices delayed" banner extended to cover chart (`barsError`) as well as quote errors
  - P-6: `getStockQuote` accepts `assetType` param; ETF quotes now return `assetType: 'etf'` correctly

### File List

- `apps/api/src/services/market/alpaca.service.ts` — modified (snapshot API for getStockQuote, add 3M to getStockBars)
- `apps/api/src/services/market/coingecko.service.ts` — modified (compute $ change in getCryptoQuote)
- `apps/api/src/services/market/market-cache.service.ts` — modified (add 3M to daysMap and signature)
- `apps/api/src/controllers/market.controller.ts` — modified (add 3M to getChart timeframe type)
- `apps/api/src/controllers/market.controller.test.ts` — modified (add getQuote and getChart tests)
- `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` — created (asset detail page)
- `apps/web/app/(dashboard)/trade/page.tsx` — modified (search onClick navigates to [ticker] page)
- `docs/stories/t1-7-live-quote-and-price-chart.md` — this file
- `docs/stories/sprint-status.yaml` — updated (t1-7 → review)

### Change Log

- 2026-03-25: Story created by Bob (SM) — comprehensive context for T1.7 implementation
- 2026-03-25: Implementation complete by Amelia (Dev) — all tasks done, 66/66 tests passing, status → review
