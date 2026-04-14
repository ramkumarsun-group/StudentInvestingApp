# Story T1.12: Holdings Detail and Order History

Status: review

## Dev Agent Record

### Implementation Notes
- Tasks 1–3 implemented together in `portfolio/page.tsx` (single file, all three modify it)
- Task 1: Added `useRouter` + `onClick` on each holdings `<tr>` with `cursor-pointer`; navigates to `/trade/${h.symbol}?type=${h.asset_type}`
- Task 2: Added `activeTab` state; static "Holdings" header replaced with two-tab underline toggle
- Task 3: Orders query with `enabled: activeTab === 'orders'` (lazy fetch); full table with buy/sell/status color badges; Cancel mutation for pending orders; empty state
- Task 4: Extended `trade.controller.test.ts` with 4 new tests (`getOrders` × 2, `cancelOrder` × 2); used `makeParamsReq` helper for param-based requests
- 108/108 tests passing (104 → 108, +4)

### Files Modified
- `apps/web/app/(dashboard)/portfolio/page.tsx`
- `apps/api/src/controllers/trade.controller.test.ts`

## Story

As a student,
I want to view detailed information about each holding and my full order history,
So that I can understand my trade history and analyse per-position performance.

## Acceptance Criteria

1. **Given** I click on a holding row in the portfolio page,
   **When** the row is clicked,
   **Then** I navigate to the ticker detail page (`/trade/[ticker]?type=[assetType]`) for that holding, pre-loaded with the current quote and chart.

2. **Given** I am on the portfolio page,
   **When** I click the "Orders" tab,
   **Then** I see a list of all my filled, cancelled, and pending orders — most recent first — showing: symbol, side (buy/sell), quantity, fill price, total value, and date/time.

3. **Given** I have no orders,
   **When** I view the Orders tab,
   **Then** I see an empty state: "No orders yet — make your first trade!"

4. **Given** an order is pending,
   **When** I view the Orders tab,
   **Then** I can see its status badge and optionally cancel it via a "Cancel" button (calls `DELETE /trade/orders/:orderId`).

## Tasks / Subtasks

- [x] Task 1 — Make holdings rows clickable / navigate to ticker page (AC: 1)
  - [x] In `apps/web/app/(dashboard)/portfolio/page.tsx`, wrap each holdings `<tr>` with a click handler:
    ```tsx
    import { useRouter } from 'next/navigation';
    const router = useRouter();
    // ...
    <tr
      key={h.symbol}
      className="... cursor-pointer"
      onClick={() => router.push(`/trade/${h.symbol}?type=${h.asset_type}`)}
    >
    ```
  - [x] Add `cursor-pointer` to the row className so the click affordance is visible

- [x] Task 2 — Add Holdings / Orders tab toggle to portfolio page (AC: 2, 3, 4)
  - [x] Add `useState<'holdings' | 'orders'>('holdings')` tab state in `PortfolioPage`
  - [x] Replace the `<h2>Holdings</h2>` header area with a two-tab toggle:
    ```tsx
    <div className="p-5 border-b border-surface-800 flex gap-4">
      {(['holdings', 'orders'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={cn(
            'text-sm font-medium capitalize pb-1 border-b-2 transition-colors',
            activeTab === tab
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          {tab === 'holdings' ? 'Holdings' : 'Order History'}
        </button>
      ))}
    </div>
    ```
  - [x] When `activeTab === 'holdings'`: render existing holdings table (unchanged)
  - [x] When `activeTab === 'orders'`: render order history table (Task 3)

- [x] Task 3 — Build Order History table (AC: 2, 3, 4)
  - [x] Add `useQuery` for orders:
    ```tsx
    const { data: ordersRaw } = useQuery({
      queryKey: ['orders'],
      queryFn: () => apiClient.get('/trade/orders').then((r: { data: unknown[] }) => r.data),
      enabled: activeTab === 'orders',  // only fetch when tab is visible
    });
    const ordersData = (ordersRaw ?? []) as {
      id: string;
      symbol: string;
      asset_type: string;
      side: 'buy' | 'sell';
      quantity: number;
      fill_price: number;
      total_value: number;
      status: 'filled' | 'pending' | 'cancelled';
      placed_at: string;
    }[];
    ```
  - [x] Render order history table with columns: Symbol, Side, Qty, Fill Price, Total, Status, Date
  - [x] Color-code: `side === 'buy'` → emerald badge; `side === 'sell'` → rose badge
  - [x] Status badges: `filled` → green, `pending` → yellow, `cancelled` → slate
  - [x] For `pending` orders: show a "Cancel" button that calls `DELETE /trade/orders/:orderId`
  - [x] Empty state (no orders): "No orders yet — make your first trade!"

- [x] Task 4 — Tests (AC: 1, 2, 3, 4)
  - [x] Extend `apps/api/src/controllers/trade.controller.test.ts` (from T1.9):
    - [x] Test `getOrders`: portfolio found → returns orders array with 200
    - [x] Test `getOrders`: no portfolio → returns `{ data: [] }` (current behavior; no 404)
    - [x] Test `cancelOrder`: order exists and is pending → status updated to `cancelled`, returns 200
    - [x] Test `cancelOrder`: order already filled → 404 with "not found or cannot be cancelled"

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/(dashboard)/portfolio/page.tsx` | ✅ Full holdings table | Tasks 1–3: patch to add click, tab, orders table |
| `apps/api/src/controllers/trade.controller.ts` | ✅ `getOrders`, `cancelOrder` | Task 4 tests only — no server changes needed |
| `GET /trade/orders` | ✅ Returns orders array ordered by `placed_at DESC LIMIT 100` | |
| `DELETE /trade/orders/:orderId` | ✅ Sets status=cancelled if pending | |
| `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` | ✅ Full ticker page | AC1 nav target — no changes needed |

### Order shape from `GET /trade/orders`

```json
{
  "id": "uuid",
  "symbol": "AAPL",
  "asset_type": "stock",
  "side": "buy",
  "order_type": "market",
  "quantity": 5,
  "fill_price": 190.19,
  "total_value": 950.95,
  "status": "filled",
  "placed_at": "2026-03-25T14:32:00Z"
}
```

### Order History table layout

```tsx
<table className="w-full">
  <thead>
    <tr className="text-xs text-slate-500 border-b border-surface-800">
      <th className="text-left px-5 py-3">Symbol</th>
      <th className="text-left px-5 py-3">Side</th>
      <th className="text-right px-5 py-3">Qty</th>
      <th className="text-right px-5 py-3">Fill Price</th>
      <th className="text-right px-5 py-3">Total</th>
      <th className="text-center px-5 py-3">Status</th>
      <th className="text-right px-5 py-3">Date</th>
      <th className="px-5 py-3" />  {/* Cancel button column */}
    </tr>
  </thead>
  ...
</table>
```

### Cancel order note

`DELETE /trade/orders/:orderId` only cancels orders with `status='pending'`. Market orders in this app are filled synchronously, so `pending` orders are rare, but the UI should handle the case gracefully (e.g. optimistic update and revert on error).

### Prerequisite

T1.9 and T1.10 must be done before T1.12 so that `trade.controller.test.ts` already has the try/catch + error envelope structure to extend.
