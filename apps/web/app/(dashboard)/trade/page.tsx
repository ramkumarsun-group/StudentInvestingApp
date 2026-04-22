'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';
import StockChart from '@/components/charts/StockChart';

export default function TradePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState(searchParams.get('symbol') || 'AAPL');
  const [assetType, setAssetType] = useState<'stock' | 'etf' | 'crypto'>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');

  const { data: quote } = useQuery({
    queryKey: ['quote', symbol, assetType],
    queryFn: () =>
      apiClient.get(`/market/quote/${symbol}?type=${assetType}`).then((r: { data: { price: number; change_pct: number; symbol: string } }) => r.data),
    refetchInterval: 30000,
    enabled: !!symbol,
  });

  const { data: bars } = useQuery({
    queryKey: ['chart', symbol, assetType, timeframe],
    queryFn: () =>
      apiClient.get(`/market/chart/${symbol}?type=${assetType}&timeframe=${timeframe}`).then((r: { data: unknown[] }) => r.data),
    enabled: !!symbol,
  });

  const {
    data: searchResults,
    isLoading: isSearchLoading,
    isFetching: isSearchFetching, // P-9: used in no-results guard instead of isLoading
    isError: isSearchError,        // P-6: distinguish API error from empty results
  } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () =>
      // P-2: encode query string so special chars ("S&P 500", "#BTC", spaces) are
      // not misinterpreted as URL structure by the browser or the server.
      apiClient.get(`/market/search?q=${encodeURIComponent(searchQuery)}`).then((r: { data: { symbol: string; name: string; assetType: string; price?: number }[] }) => r.data),
    enabled: searchQuery.length >= 2,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiClient.get('/portfolio').then((r: { data: { virtual_cash: number } }) => r.data),
  });

  const orderMutation = useMutation({
    mutationFn: (data: object) => apiClient.post('/trade/order', data),
    onSuccess: () => {
      toast.success(`${side === 'buy' ? 'Bought' : 'Sold'} ${quantity} ${symbol}`);
      setQuantity('');
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
    },
    onError: (err: unknown) => {
      const errData = err as { error?: { message?: string } | string };
      const msg = typeof errData?.error === 'object'
        ? (errData.error?.message ?? 'Order failed')
        : (errData?.error ?? 'Order failed');
      toast.error(msg);
    },
  });

  const quoteData = quote as { price: number; change_pct: number; symbol: string } | undefined;
  const portfolioData = portfolio as { virtual_cash: number } | undefined;
  const barsData = (bars ?? []) as { t: string; c: number }[];
  const searchData = (searchResults ?? []) as { symbol: string; name: string; assetType: string; price?: number }[];

  const isPositive = (quoteData?.change_pct ?? 0) >= 0;
  const orderTotal = quoteData && quantity ? quoteData.price * parseFloat(quantity) : 0;

  function submitOrder() {
    if (!quantity || !symbol) return;
    orderMutation.mutate({
      symbol,
      assetType,
      side,
      orderType: 'market',
      quantity: parseFloat(quantity),
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Trade</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Chart + Quote */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input pl-9"
              placeholder="Search stocks, ETFs, crypto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.length >= 2 && searchData.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-surface-bright rounded-xl shadow-xl z-10 overflow-hidden">
                {searchData.map((r) => (
                  <button
                    key={r.symbol}
                    className="w-full text-left px-4 py-3 hover:bg-surface-bright transition-colors flex justify-between items-center"
                    onClick={() => {
                      // P-2: restore the T1.6 guard — SearchResult.assetType includes 'bond'
                      // which the [ticker] page and the market API do not support.
                      // Pass 'stock' as fallback rather than letting an invalid type corrupt
                      // the URL and downstream cache keys.
                      const safeType =
                        r.assetType === 'stock' || r.assetType === 'etf' || r.assetType === 'crypto'
                          ? r.assetType
                          : 'stock';
                      router.push(`/trade/${encodeURIComponent(r.symbol)}?type=${safeType}`);
                      setSearchQuery('');
                    }}
                  >
                    <div>
                      <span className="font-semibold text-white">{r.symbol}</span>
                      <span className="text-on-surface-variant text-sm ml-2">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.price !== undefined && (
                        <span className="text-sm text-white font-mono">{formatUSD(r.price)}</span>
                      )}
                      <span className="text-xs text-on-surface-variant">
                        {r.assetType === 'etf' ? 'ETF' : r.assetType.charAt(0).toUpperCase() + r.assetType.slice(1)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {/* P-6: !isSearchError prevents "No results found" from showing on API failure.
                P-9: !isSearchFetching (not isLoading) prevents flash when stale cache revalidates. */}
            {searchQuery.length >= 2 && !isSearchFetching && !isSearchError && searchData.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-surface-bright rounded-xl shadow-xl z-10 overflow-hidden">
                <p className="px-4 py-3 text-sm text-on-surface-variant">No results found</p>
              </div>
            )}
            {searchQuery.length >= 2 && isSearchError && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-surface-bright rounded-xl shadow-xl z-10 overflow-hidden">
                <p className="px-4 py-3 text-sm text-red-400">Search unavailable — please try again</p>
              </div>
            )}
          </div>

          {/* Quote Header */}
          {quoteData && (
            <div className="card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-bold text-white">{quoteData.symbol}</p>
                  <p className="text-3xl font-bold font-mono text-white mt-1">
                    {formatUSD(quoteData.price)}
                  </p>
                  <p className={cn('text-sm font-medium mt-1 flex items-center gap-1', isPositive ? 'positive' : 'negative')}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatPercent(quoteData.change_pct)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {(['1D', '1W', '1M', '3M', '1Y'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        timeframe === tf
                          ? 'bg-primary-container text-white'
                          : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface',
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <StockChart data={barsData} />
              </div>
            </div>
          )}
        </div>

        {/* Right: Order Panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Place Order</h2>

            <div className="flex gap-2 mb-4">
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={cn(
                    'flex-1 py-2 rounded-lg font-semibold capitalize transition-colors',
                    side === s
                      ? s === 'buy'
                        ? 'bg-positive text-surface'
                        : 'bg-negative text-white'
                      : 'bg-surface-container-high text-on-surface-variant',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1">Symbol</label>
                <input className="input font-mono font-semibold" value={symbol} readOnly />
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1">Shares / Units</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              {orderTotal > 0 && (
                <div className="bg-surface-container-high rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Est. Total</span>
                    <span className="text-white font-semibold">{formatUSD(orderTotal)}</span>
                  </div>
                  {portfolioData && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-on-surface-variant">Available Cash</span>
                      <span className="text-on-surface-variant">{formatUSD(portfolioData.virtual_cash)}</span>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={submitOrder}
                disabled={!quantity || !symbol || orderMutation.isPending}
                className={cn(
                  'w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50',
                  side === 'buy'
                    ? 'bg-positive hover:opacity-90 text-surface'
                    : 'bg-negative hover:opacity-90 text-white',
                )}
              >
                {orderMutation.isPending
                  ? 'Processing...'
                  : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mt-3 text-center">
              Paper trading only — no real money
            </p>
          </div>

          {/* Holdings summary */}
          <HoldingsPanel symbol={symbol} />
        </div>
      </div>
    </div>
  );
}

function HoldingsPanel({ symbol }: { symbol: string }) {
  const { data: holdings } = useQuery({
    queryKey: ['holdings'],
    queryFn: () => apiClient.get('/portfolio/holdings').then((r: { data: { symbol: string; quantity: number; avg_cost_basis: number; unrealized_pnl: number; unrealized_pnl_pct: number }[] }) => r.data),
  });
  const holdingsData = (holdings ?? []) as { symbol: string; quantity: number; avg_cost_basis: number; unrealized_pnl: number; unrealized_pnl_pct: number }[];
  const holding = holdingsData.find((h) => h.symbol === symbol);
  if (!holding) return null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-on-surface-variant mb-2">Your Position</h3>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Shares</span>
          <span className="text-white">{holding.quantity}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Avg Cost</span>
          <span className="text-white">{formatUSD(holding.avg_cost_basis)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">P&L</span>
          <span className={holding.unrealized_pnl >= 0 ? 'positive' : 'negative'}>
            {formatUSD(holding.unrealized_pnl)} ({formatPercent(holding.unrealized_pnl_pct)})
          </span>
        </div>
      </div>
    </div>
  );
}
