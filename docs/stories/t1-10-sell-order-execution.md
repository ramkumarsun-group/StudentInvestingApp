# Story T1.10: Sell Order Execution

Status: done

## Story

As a student,
I want to sell assets I currently hold,
So that I can realise gains, cut losses, and rebalance my portfolio.

## Acceptance Criteria

1. **Given** I hold a position and select "Sell" with a valid quantity,
   **When** I confirm the sell,
   **Then** the order executes at market price ± 0.1% spread, my holding quantity decreases (or position closes if selling all), and my cash increases.

2. **Given** I attempt to sell more shares than I hold,
   **When** I submit,
   **Then** the order is rejected with an error showing my current holding quantity; cash and holdings are unchanged.

3. **Given** I sell my entire position,
   **When** the order executes,
   **Then** the holding is removed from my portfolio entirely.

## Tasks / Subtasks

- [x] Task 1 — Add sell-side holdings validation to `order.service.ts` (AC: 1, 2, 3)
  - [x] In `placeOrder()`, immediately after the buy cash check block, add sell-side validation:
    ```typescript
    if (status === 'filled' && side === 'sell') {
      const holdingRes = await client.query(
        'SELECT quantity FROM holdings WHERE portfolio_id=$1 AND symbol=$2',
        [portfolioId, symbol],
      );
      if (holdingRes.rows.length === 0 || holdingRes.rows[0].quantity < quantity) {
        throw new Error('Insufficient holdings');
      }
    }
    ```
  - [x] Note: the existing `applyFilledOrder` sell path already deletes holding when `newQty <= 0` (AC3) — no change needed there

- [x] Task 2 — Add `INSUFFICIENT_HOLDINGS` error mapping to `trade.controller.ts` (AC: 2)
  - [x] In the try/catch added in T1.9 Task 1, add: `Error('Insufficient holdings')` → `res.status(422).json({ error: { code: 'INSUFFICIENT_HOLDINGS', message: 'You do not have enough shares to sell.' } })`

- [x] Task 3 — Add Sell tab/form to `trade/[ticker]/page.tsx` (AC: 1, 2, 3)
  - [x] The `side` state from T1.9 (`useState<'buy' | 'sell'>('buy')`) drives tab switching
  - [x] Add Buy/Sell tab toggle buttons at top of order panel — active tab highlighted
  - [x] For sell side: use `useQuery` to get `holdings` — find holding for current `ticker`: `holdings.find(h => h.symbol === ticker)`
  - [x] Show "You own: X shares" (or "You don't own this asset" if no holding)
  - [x] Sell quantity input: max is current holding quantity; show `max` indicator
  - [x] Estimated proceeds display: `formatUSD(quote.price * (1 - 0.001) * parseFloat(quantity))` with "Est. Proceeds (after 0.1% spread)"
  - [x] Sell button: calls same `useMutation` with `side: 'sell'`
  - [x] On success: `toast.success('Sold X ${ticker}')`, clear quantity, invalidate portfolio+holdings queries
  - [x] On error: display `error.response.data.error.message` — specifically for `INSUFFICIENT_HOLDINGS` show current quantity from the holding data

- [x] Task 4 — Tests in `apps/api/src/controllers/trade.controller.test.ts` (extend from T1.9) (AC: 1, 2, 3)
  - [x] Test: sell order with sufficient holdings → `placeOrder` called with `side: 'sell'`, returns 201
  - [x] Test: `placeOrder` throws `'Insufficient holdings'` → 422 with `INSUFFICIENT_HOLDINGS` code
  - [x] Test in `order.service.ts` unit tests (if created): sell qty > holding → throws `Insufficient holdings`

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/services/trading/order.service.ts` | ✅ Sell path in `applyFilledOrder` | Task 1 only — add holdings validation before fill |
| `apps/api/src/controllers/trade.controller.ts` | ✅ After T1.9: has try/catch + error envelope | Task 2 only — add INSUFFICIENT_HOLDINGS mapping |
| `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` | ✅ After T1.9: has buy form + side state | Task 3 — activate sell tab using existing side state |
| `GET /portfolio/holdings` | ✅ Returns holdings array | Use to check current holding quantity |

### Prerequisite: T1.9 Must Be Done First

T1.10 builds directly on T1.9 work:
- The `side` state variable in `trade/[ticker]/page.tsx` is introduced in T1.9
- The try/catch + error envelope in `trade.controller.ts` is set up in T1.9
- Task 2 of T1.9 already adds the sell holdings check to `order.service.ts` — **check if T1.9 Task 2 was already completed before doing T1.10 Task 1**

### Sell-side spread direction
- Buy: fill price = `quote.price * 1.001` (you pay more)
- Sell: fill price = `quote.price * 0.999` (you receive less)
This is already implemented correctly in `order.service.ts`:
```typescript
fillPrice = side === 'buy'
  ? quote.price * (1 + SPREAD_PCT)
  : quote.price * (1 - SPREAD_PCT);
```

### Holdings query for sell UI

```tsx
const { data: holdingsRaw } = useQuery({
  queryKey: ['holdings'],
  queryFn: () => apiClient.get('/portfolio/holdings').then((r: { data: unknown[] }) => r.data),
});
const holdingsData = (holdingsRaw ?? []) as { symbol: string; quantity: number; ... }[];
const currentHolding = holdingsData.find(h => h.symbol === ticker);
// Show: "You own {currentHolding.quantity} shares" or "You don't hold this asset"
```

### Sell max quantity helper

```tsx
// Max sell quantity = current holding quantity (no fractional shares constraint for crypto)
const maxSellQty = currentHolding?.quantity ?? 0;

// "Sell All" convenience button
<button onClick={() => setQuantity(String(maxSellQty))}>Sell All</button>
```

## Dev Agent Record

- **Agent:** James (Dev Agent) — claude-sonnet-4-6
- **Date completed:** 2026-03-26
- **Story points:** 3
- **Notes:**
  - Task 1 was already implemented in T1.9 (holdings check at order.service.ts lines 67-75); marked done without changes.
  - Task 2 added `INSUFFICIENT_HOLDINGS` mapping before the generic 500 catch-all in the controller.
  - Task 3 replaced the static `const [side]` with `const [side, setSide]`, unified `buyMutation` into `orderMutation` accepting `orderSide`, added Buy/Sell tab toggle, holdings query, sell form with quantity max/Sell All, estimated proceeds display, and INSUFFICIENT_HOLDINGS contextual error.
  - Task 4 added 2 new controller tests (sell success → 201, Insufficient holdings → 422); all 104 tests pass.

## File List

- `apps/api/src/controllers/trade.controller.ts` — added `INSUFFICIENT_HOLDINGS` error mapping
- `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` — added sell tab, holdings query, unified orderMutation, sell form UI
- `apps/api/src/controllers/trade.controller.test.ts` — added 2 new sell-order tests

## Change Log

| Date | Change | File |
|------|--------|------|
| 2026-03-26 | Added INSUFFICIENT_HOLDINGS (422) error mapping to catch block | apps/api/src/controllers/trade.controller.ts |
| 2026-03-26 | Added Buy/Sell tab toggle, holdings useQuery, sell form with Sell All, estimated proceeds | apps/web/app/(dashboard)/trade/[ticker]/page.tsx |
| 2026-03-26 | Added sell success (201) and INSUFFICIENT_HOLDINGS (422) controller tests | apps/api/src/controllers/trade.controller.test.ts |
