# Story T1.9: Buy Order Execution

Status: review

## Story

As a student,
I want to place a market buy order for any supported asset,
So that I can invest my virtual cash and build my portfolio.

## Acceptance Criteria

1. **Given** I have sufficient cash and enter a valid quantity on the asset detail page,
   **When** I review the estimated total (price ± 0.1% spread) and confirm the buy,
   **Then** the order executes at the simulated price, my cash decreases, and my holding is created or updated with weighted average cost basis.

2. **Given** my order total would exceed my available cash,
   **When** I submit,
   **Then** the order is rejected before execution with a clear error showing my available balance; cash and holdings are unchanged.

3. **Given** the market data API is unavailable (`getCachedQuote` returns null),
   **When** the order is submitted,
   **Then** the order is not placed, cash is unchanged, and I see a clear error message.

## Tasks / Subtasks

- [x] Task 1 — Fix `createOrder` controller: add try/catch + structured error responses (AC: 1, 2, 3)
  - [x] In `apps/api/src/controllers/trade.controller.ts`: wrap `placeOrder()` call in try/catch
  - [x] Map `Error('Insufficient cash')` → `res.status(422).json({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient cash balance.' } })`
  - [x] Map `Error('No price available...')` → `res.status(422).json({ error: { code: 'MARKET_DATA_UNAVAILABLE', message: 'Market data is unavailable. Please try again.' } })`
  - [x] Map `Error('Portfolio not found')` → `res.status(404).json({ error: { code: 'PORTFOLIO_NOT_FOUND', message: 'Portfolio not found.' } })`
  - [x] All other errors → `res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Order failed.' } })`

- [x] Task 2 — Add sell-side holdings check to `order.service.ts` (prerequisite for T1.10, add now) (AC: T1.10 prep)
  - [x] In `placeOrder`, before `applyFilledOrder` for sell side, add: `const holding = await client.query('SELECT quantity FROM holdings WHERE portfolio_id=$1 AND symbol=$2', [portfolioId, symbol])`
  - [x] If no holding or `holding.rows[0].quantity < quantity` → throw `new Error('Insufficient holdings')`

- [x] Task 3 — Add buy order form to `trade/[ticker]/page.tsx` (AC: 1, 2, 3)
  - [x] Remove the "Coming Soon" disabled button placeholder
  - [x] Add `useState` for: `side: 'buy' | 'sell'` (default 'buy'), `quantity: string` (empty string for input), `orderLoading: boolean`, `orderError: string | null`
  - [x] Import `useMutation`, `useQueryClient` from `@tanstack/react-query` (already imported in other pages)
  - [x] Add `useQuery` for portfolio cash balance: `queryKey: ['portfolio']`, `queryFn: () => apiClient.get('/portfolio').then(r => r.data)`
  - [x] Show current available cash in the order panel: `formatUSD(portfolioData?.virtual_cash ?? 0)`
  - [x] Quantity input: `<input type="number" min="0.01" step="0.01" ...>` — validate > 0 on submit
  - [x] Estimated total display: `formatUSD((quote?.price ?? 0) * (1 + 0.001) * parseFloat(quantity || '0'))` with label "Est. Total (incl. 0.1% spread)"
  - [x] Buy button: calls `useMutation` → `apiClient.post('/trade/order', { symbol: ticker, assetType, side: 'buy', orderType: 'market', quantity: parseFloat(quantity) })`
  - [x] On success: show success toast (use `toast.success` from `sonner`), clear quantity, invalidate `['portfolio']` and `['holdings']` queries
  - [x] On error: show `orderError` message below the form using the `error.response.data.error.message` from the API response
  - [x] Disable button while `orderLoading` or `!quote`

- [x] Task 4 — Tests in `apps/api/src/controllers/trade.controller.test.ts` (AC: 1, 2, 3)
  - [x] Mock `../services/trading/order.service` (`placeOrder`)
  - [x] Mock `../config/db` (`db.query`)
  - [x] Mock `../services/gamification/xp.service` (`awardXp`)
  - [x] Test: valid buy → `placeOrder` called, returns 201 with order data
  - [x] Test: `placeOrder` throws `'Insufficient cash'` → 422 with `INSUFFICIENT_BALANCE` code
  - [x] Test: `placeOrder` throws `'No price available'` → 422 with `MARKET_DATA_UNAVAILABLE` code
  - [x] Test: `placeOrder` throws unknown error → 500 with `INTERNAL_ERROR` code
  - [x] Test: invalid body (missing quantity) → 400 validation error

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/services/trading/order.service.ts` | ✅ Full buy+sell logic | Task 2 only — add sell holdings check |
| `apps/api/src/controllers/trade.controller.ts` | ✅ `createOrder`, `getOrders`, `cancelOrder` | Task 1 only — add try/catch + error envelope |
| `apps/api/src/routes/index.ts` | ✅ `POST /trade/order` route | No changes |
| `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` | ✅ Quote, chart, "Coming Soon" button | Task 3 — replace Coming Soon with real form |
| `apps/web/app/(dashboard)/portfolio/page.tsx` | ✅ Portfolio page with cash balance | Use `/portfolio` endpoint to get available cash |
| `packages/shared-utils` | ✅ `formatUSD`, `calcWeightedAvgCost` | Import as-is |

### Currency Convention — READ BEFORE IMPLEMENTING

The codebase stores `virtual_cash` as a **raw dollar value** (e.g., `100000` = $100,000), NOT as cents, despite the architecture doc saying INTEGER cents. Evidence:
- `formatUSD(portfolioData?.virtual_cash)` displays correctly on the portfolio page
- `order.service.ts` compares `portfolio.virtual_cash < fillPrice * qty` (both in dollars)
- `resetPortfolio` sets `virtual_cash=100000` which = $100,000 in dollar terms

**Action**: Before implementing, run `SELECT virtual_cash FROM portfolios LIMIT 1` to verify. Use DOLLAR convention throughout. Do NOT divide by 100 anywhere.

The migration default `10000000` is likely a bug (probably should be `100000`). Do NOT change the migration — just be aware and use the dollar convention.

### `order.service.ts` error messages (for catch mapping in Task 1)

```typescript
// In placeOrder:
throw new Error('Portfolio not found');       // → 404 PORTFOLIO_NOT_FOUND
throw new Error(`No price available for ${symbol}`);  // → 422 MARKET_DATA_UNAVAILABLE
throw new Error('Insufficient cash');          // → 422 INSUFFICIENT_BALANCE

// After Task 2 (new):
throw new Error('Insufficient holdings');      // → 422 INSUFFICIENT_HOLDINGS (T1.10)
```

### Order form pattern (trade/[ticker]/page.tsx)

```tsx
// After the chart section, add order panel:
const queryClient = useQueryClient();

const { data: portfolio } = useQuery({
  queryKey: ['portfolio'],
  queryFn: () => apiClient.get('/portfolio').then((r: { data: { virtual_cash: number } }) => r.data),
});

const buyMutation = useMutation({
  mutationFn: (qty: number) => apiClient.post('/trade/order', {
    symbol: ticker,
    assetType,
    side: 'buy',
    orderType: 'market',
    quantity: qty,
  }),
  onSuccess: () => {
    toast.success(`Bought ${quantity} ${ticker}`);
    setQuantity('');
    queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    queryClient.invalidateQueries({ queryKey: ['holdings'] });
  },
  onError: (err: unknown) => {
    const msg = (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? 'Order failed';
    setOrderError(msg);
  },
});

// Estimated total (buy side with 0.1% spread):
const estimatedTotal = (quoteData?.price ?? 0) * (1 + 0.001) * parseFloat(quantity || '0');
```

### API Response Shape

```json
// Success (201):
{ "data": { "id": "uuid", "symbol": "AAPL", "side": "buy", "quantity": "10", "fill_price": "190.19", "status": "filled", "total_value": "1901.90", "filled_at": "2026-03-26T..." } }

// Error (422):
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "Insufficient cash balance." } }
```

### Spread Disclosure

Display `±0.1% simulated spread` clearly in the UI near the estimated total — this is educationally important for students learning about market mechanics.

## Dev Agent Record

**Agent:** claude-sonnet-4-6
**Completed:** 2026-03-26
**Test Results:** 98/98 passed (6 test files)

### Implementation Notes
- Task 1: Wrapped `placeOrder()` in try/catch in `createOrder` controller. Used `startsWith` check for `'No price available'` since the error includes the symbol name. Error mappings match story spec exactly.
- Task 2: Added sell-side holdings check in `order.service.ts` before calling `applyFilledOrder` for sell orders. Throws `'Insufficient holdings'` when holding is missing or quantity is insufficient — T1.10 can build on this.
- Task 3: Replaced "Coming Soon" placeholder with a full buy order form. Uses `useMutation`/`useQueryClient` from TanStack Query, `toast.success` from sonner, displays available cash via `/portfolio` query, estimated total with 0.1% spread, spread disclosure text, and inline error display.
- Task 4: Tests written first (red) then implementation made them pass (green). 5 tests covering valid buy, 3 error cases, and missing quantity validation.

## File List

- `apps/api/src/controllers/trade.controller.ts` — Added try/catch around `placeOrder()` with structured error mapping
- `apps/api/src/services/trading/order.service.ts` — Added sell-side holdings check before `applyFilledOrder`
- `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` — Replaced "Coming Soon" with full buy order form
- `apps/api/src/controllers/trade.controller.test.ts` — New test file with 5 tests for `createOrder`

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-26 | Implemented all 4 tasks; 98/98 tests passing | Dev Agent (claude-sonnet-4-6) |
