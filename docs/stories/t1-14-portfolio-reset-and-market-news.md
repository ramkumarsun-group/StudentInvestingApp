# Story T1.14: Portfolio Reset and Market News

Status: review

## Dev Agent Record

### Implementation Notes
- Task 1: Extended `resetPortfolio` transaction — correct order: DELETE orders → DELETE holdings → DELETE leaderboard_snapshots → UPDATE portfolios (orders before holdings due to FK)
- Task 2: Replaced native `confirm()` with modal — `showResetModal` state, `z-50` overlay, Cancel + destructive Reset button; `onSuccess` also invalidates `['orders']` and `['portfolio-history']`
- Task 3: Added `NewsArticle` type + `useQuery(['market-news'])` with 5-min stale time; `relativeTime()` helper; news section below order panel with graceful empty state
- Task 4: 3 new `resetPortfolio` tests: success (verifies BEGIN/DELETE orders/DELETE holdings/DELETE snapshots/UPDATE/COMMIT call order), 404 when no portfolio, ROLLBACK + rethrow on DB error
- 112/112 tests passing (109→112, +3)

### Files Modified
- `apps/api/src/controllers/portfolio.controller.ts`
- `apps/web/app/(dashboard)/portfolio/page.tsx`
- `apps/web/app/(dashboard)/trade/[ticker]/page.tsx`
- `apps/api/src/controllers/portfolio.controller.test.ts`

## Story

As a student,
I want to safely reset my portfolio back to $100,000 and view market news on the trading page,
So that I can start fresh without persistent bugs and stay informed about the market.

## Acceptance Criteria

1. **Given** I click "Reset" on the portfolio page,
   **When** I confirm the action in a modal (not a native `confirm()` dialog),
   **Then** my portfolio resets to $100,000 cash, all holdings are cleared, all order history is cleared, and all portfolio history snapshots are cleared.

2. **Given** the reset completes successfully,
   **When** the page updates,
   **Then** all portfolio summary cards show $100,000 cash, $0 P&L, empty holdings, empty order history, and empty history chart.

3. **Given** I am on the ticker detail page (`/trade/[ticker]`),
   **When** the page loads,
   **Then** I see a "Market News" section below the order panel showing the 5 most recent business headlines with title, source, and relative time (e.g. "2 hours ago"), each linking to the full article in a new tab.

4. **Given** the news API is unavailable,
   **When** the news section loads,
   **Then** I see a graceful empty state "News unavailable" — no error page or uncaught exception.

## Tasks / Subtasks

- [x] Task 1 — Extend `resetPortfolio` to clear orders and history snapshots (AC: 1, 2)
  - [x]In `apps/api/src/controllers/portfolio.controller.ts`, update the `resetPortfolio` transaction:
    ```typescript
    // After DELETE FROM holdings:
    await client.query('DELETE FROM orders WHERE portfolio_id=$1', [portfolioId]);
    await client.query(
      'DELETE FROM leaderboard_snapshots WHERE user_id=$1',
      [req.user!.userId],
    );
    ```
  - [x]Keep existing: `DELETE FROM holdings`, `UPDATE portfolios SET virtual_cash=100000, total_value=100000, total_return_pct=0`
  - [x]Order of operations inside the transaction (all within BEGIN/COMMIT):
    1. `DELETE FROM orders`
    2. `DELETE FROM holdings`
    3. `DELETE FROM leaderboard_snapshots`
    4. `UPDATE portfolios`

- [x] Task 2 — Replace `confirm()` with a modal confirmation dialog (AC: 1)
  - [x]In `apps/web/app/(dashboard)/portfolio/page.tsx`, replace the native `confirm()` call with a controlled modal:
    - Add state: `const [showResetModal, setShowResetModal] = useState(false)`
    - Reset button: `onClick={() => setShowResetModal(true)}` (remove the old `confirm()`)
    - Add modal JSX (render at end of component, outside main layout):
      ```tsx
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Reset Portfolio?</h3>
            <p className="text-sm text-slate-400">
              This will clear all holdings, orders, and history — resetting your balance to $100,000.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => { resetMutation.mutate(); setShowResetModal(false); }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? 'Resetting…' : 'Reset Portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}
      ```
  - [x]After successful reset also invalidate `['portfolio-history']` and `['orders']` queries:
    ```tsx
    onSuccess: () => {
      toast.success('Portfolio reset to $100,000');
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['portfolio-history'] });
    },
    ```

- [x] Task 3 — Add Market News section to ticker page (AC: 3, 4)
  - [x]In `apps/web/app/(dashboard)/trade/[ticker]/page.tsx`, add a news query:
    ```tsx
    const { data: newsRaw } = useQuery({
      queryKey: ['market-news'],
      queryFn: () =>
        apiClient
          .get('/market/news')
          .then((r: { data: NewsArticle[] }) => r.data),
      staleTime: 5 * 60 * 1000,  // 5 min — matches server-side 300s TTL
    });
    type NewsArticle = {
      id: string;
      title: string;
      summary: string | null;
      url: string;
      source: { name: string } | string;
      imageUrl: string | null;
      publishedAt: string;
    };
    const newsData = (newsRaw ?? []).slice(0, 5) as NewsArticle[];
    ```
  - [x]Add news section below the order panel:
    ```tsx
    <div className="card p-5">
      <h2 className="font-semibold text-white mb-4">Market News</h2>
      {newsData.length === 0 ? (
        <p className="text-sm text-slate-500">News unavailable.</p>
      ) : (
        <div className="space-y-3">
          {newsData.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:bg-surface-800/60 rounded-lg p-3 -mx-3 transition-colors"
            >
              <p className="text-sm font-medium text-white line-clamp-2">{article.title}</p>
              <div className="flex gap-2 mt-1 text-xs text-slate-500">
                <span>{typeof article.source === 'string' ? article.source : article.source?.name ?? 'Unknown'}</span>
                <span>·</span>
                <span>{relativeTime(article.publishedAt)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
    ```
  - [x]Add a `relativeTime` helper (local to the file — no need for a library):
    ```tsx
    function relativeTime(iso: string): string {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    }
    ```

- [x] Task 4 — Tests (AC: 1, 2)
  - [x]In `apps/api/src/controllers/portfolio.controller.test.ts` (extend from T1.11):
    - [x]Test `resetPortfolio`: transaction deletes holdings + orders + snapshots and updates portfolio → 200 with reset message
    - [x]Test `resetPortfolio`: portfolio not found → 404
    - [x]Test `resetPortfolio`: DB error → ROLLBACK called, error propagated

## Dev Notes

### What Already Exists — DO NOT Reinvent

| File | Status | Notes |
|------|--------|-------|
| `apps/api/src/controllers/portfolio.controller.ts` | ✅ `resetPortfolio` with BEGIN/COMMIT | Task 1: add 2 DELETE statements inside existing transaction |
| `apps/web/app/(dashboard)/portfolio/page.tsx` | ✅ Reset button with `confirm()` | Task 2: replace confirm() with modal, extend mutation onSuccess |
| `apps/web/app/(dashboard)/trade/[ticker]/page.tsx` | ✅ Quote + chart page | Task 3: add news section below order panel |
| `GET /market/news` | ✅ Returns up to 20 articles, 5-min Redis cache | Task 3 uses this endpoint |

### Reset transaction order matters

Delete `orders` BEFORE `holdings` because `orders` has a foreign key on `portfolio_id` which cascades from `portfolios`. However `holdings` has no FK to `orders`, so either order for those two is fine. `leaderboard_snapshots` uses `user_id` (not `portfolio_id`) so it must use `req.user!.userId`.

### News API source field shape

NewsAPI returns `source` as an object: `{ "id": "bloomberg", "name": "Bloomberg" }`. The frontend must handle both `string` and `{ name: string }` forms defensively since the backend maps `a.source` directly (object not destructured).

### Modal z-index note

Use `z-50` for the modal overlay. The app nav sidebar uses `z-30` (check `apps/web/components/layout/`); the modal must stack above it. `z-50` is safe.

### `line-clamp-2` utility

`line-clamp-2` truncates to 2 lines with ellipsis. This is a Tailwind v3 utility (part of `@tailwindcss/line-clamp` or built-in from Tailwind v3.3+). Check `tailwind.config.ts` — if it's not working add the plugin or upgrade Tailwind.

### Prerequisite

Task 1 depends on T1.11's snapshot job writing rows to `leaderboard_snapshots` — the `DELETE` will silently succeed even if there are no rows, so T1.14 can be developed independently of T1.11 being deployed.
