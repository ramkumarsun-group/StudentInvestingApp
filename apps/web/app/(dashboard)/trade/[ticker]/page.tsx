'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';
import StockChart from '@/components/charts/StockChart';
import type { Quote } from '@student-investing/shared-types';

export default function TickerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticker = String(params.ticker || '').toUpperCase();
  // P-2: explicit allowlist guard — URL param could be 'bond' or arbitrary string;
  // the cast alone only silences TypeScript, it does not constrain the runtime value.
  const rawType = searchParams.get('type');
  const assetType: 'stock' | 'etf' | 'crypto' =
    rawType === 'stock' || rawType === 'etf' || rawType === 'crypto' ? rawType : 'stock';
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');

  // Order form state
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<string>('');
  const [orderError, setOrderError] = useState<string | null>(null);
  // P-10 fix: store error code separately so UI can detect INSUFFICIENT_HOLDINGS
  // by code (not by fragile substring match on the human-readable message).
  const [orderErrorCode, setOrderErrorCode] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: quote, isError: quoteError } = useQuery({
    queryKey: ['quote', ticker, assetType],
    queryFn: () =>
      apiClient
        .get(`/market/quote/${ticker}?type=${assetType}`)
        .then((r: { data: Quote }) => r.data),
    refetchInterval: 30000,
    retry: 1,
    enabled: !!ticker,
  });

  const { data: bars, isError: barsError } = useQuery({
    queryKey: ['chart', ticker, assetType, timeframe],
    queryFn: () =>
      apiClient
        .get(`/market/chart/${ticker}?type=${assetType}&timeframe=${timeframe}`)
        .then((r: { data: { t: string; c: number }[] }) => r.data),
    enabled: !!ticker,
  });

  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () =>
      apiClient.get('/portfolio').then((r: { data: { virtual_cash: number } }) => r.data),
  });

  const { data: holdingsRaw } = useQuery({
    queryKey: ['holdings'],
    queryFn: () =>
      apiClient.get('/portfolio/holdings').then((r: { data: unknown[] }) => r.data),
  });
  const holdingsData = (holdingsRaw ?? []) as { symbol: string; quantity: number }[];
  const currentHolding = holdingsData.find((h) => h.symbol === ticker);

  // T1.14 Task 3: news query — stale 5 min matches server-side 300s Redis TTL
  type NewsArticle = {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    source: { name: string } | string;
    imageUrl: string | null;
    publishedAt: string;
  };
  const { data: newsRaw } = useQuery({
    queryKey: ['market-news'],
    queryFn: () =>
      apiClient
        .get('/market/news')
        .then((r: { data: NewsArticle[] }) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const newsData = (newsRaw ?? []).slice(0, 5) as NewsArticle[];

  const orderMutation = useMutation({
    mutationFn: ({ qty, orderSide }: { qty: number; orderSide: 'buy' | 'sell' }) =>
      apiClient.post('/trade/order', {
        symbol: ticker,
        assetType,
        side: orderSide,
        orderType: 'market',
        quantity: qty,
      }),
    onMutate: () => {
      setOrderError(null);
      setOrderErrorCode(null);
    },
    onSuccess: (_data, variables) => {
      // P-7 fix: use variables.qty (the parsed float sent to API), not raw quantity string state
      if (variables.orderSide === 'buy') {
        toast.success(`Bought ${variables.qty} ${ticker}`);
      } else {
        toast.success(`Sold ${variables.qty} ${ticker}`);
      }
      setQuantity('');
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
    },
    onError: (err: unknown) => {
      const errPayload = (err as { response?: { data?: { error?: { message?: string; code?: string } } } })
        ?.response?.data?.error;
      setOrderError(errPayload?.message ?? 'Order failed');
      // P-10 fix: store error code for reliable code-based detection in UI
      setOrderErrorCode(errPayload?.code ?? null);
    },
  });

  const quoteData = quote as Quote | undefined;
  const barsData = (bars ?? []) as { t: string; c: number }[];
  const isPositive = (quoteData?.changePct ?? 0) >= 0;

  const estimatedBuyTotal =
    (quoteData?.price ?? 0) * (1 + 0.001) * parseFloat(quantity || '0');
  const estimatedSellProceeds =
    (quoteData?.price ?? 0) * (1 - 0.001) * parseFloat(quantity || '0');

  const maxSellQty = currentHolding?.quantity ?? 0;

  // T1.14 Task 3: relative time helper for news timestamps
  // CR-P6: Math.max(0, ...) guards against negative values from future-dated
  // timestamps (clock skew, NewsAPI UTC offset) — avoids displaying "-3m ago"
  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(diff / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOrderError(null);
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setOrderError('Please enter a valid quantity greater than 0.');
      return;
    }
    orderMutation.mutate({ qty, orderSide: side });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* AC3: "Prices delayed" banner — shown on quote OR chart API error; never an error page */}
      {(quoteError || barsError) && (
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
              <div
                className={cn(
                  'flex items-center gap-1 mt-1 text-sm font-medium',
                  isPositive ? 'text-emerald-400' : 'text-rose-400',
                )}
              >
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isPositive ? '+' : ''}
                {formatUSD(quoteData.change)} ({isPositive ? '+' : ''}
                {formatPercent(quoteData.changePct)})
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
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  timeframe === tf
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-800 text-slate-400 hover:text-slate-200',
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

      {/* Order panel */}
      <div className="card p-5">
        <h2 className="font-semibold text-white mb-4">Place Order</h2>

        {/* Buy / Sell tab toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setSide('buy');
              setQuantity('');
              setOrderError(null);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
              side === 'buy'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-800 text-slate-400 hover:text-slate-200',
            )}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => {
              setSide('sell');
              setQuantity('');
              setOrderError(null);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
              side === 'sell'
                ? 'bg-rose-600 text-white'
                : 'bg-surface-800 text-slate-400 hover:text-slate-200',
            )}
          >
            Sell
          </button>
        </div>

        {side === 'buy' ? (
          <>
            {/* Available cash */}
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-slate-400">Available Cash</span>
              <span className="font-mono text-white font-medium">
                {formatUSD(portfolioData?.virtual_cash ?? 0)}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quantity input */}
              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="quantity">
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setOrderError(null);
                  }}
                  placeholder="0.00"
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Estimated total */}
              <div className="flex justify-between items-center text-sm bg-surface-800 rounded-lg px-3 py-2">
                <span className="text-slate-400">Est. Total (incl. 0.1% spread)</span>
                <span className="font-mono text-white font-medium">
                  {formatUSD(estimatedBuyTotal)}
                </span>
              </div>

              {/* Spread disclosure */}
              <p className="text-xs text-slate-500">
                ±0.1% simulated spread applied to market orders — this reflects real-world bid/ask costs.
              </p>

              {/* Error message */}
              {orderError && (
                <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-400/10 rounded-lg px-3 py-2">
                  <AlertCircle size={14} />
                  {orderError}
                </div>
              )}

              {/* Buy button */}
              <button
                type="submit"
                disabled={orderMutation.isPending || !quoteData}
                className={cn(
                  'w-full py-3 rounded-lg font-semibold transition-colors',
                  orderMutation.isPending || !quoteData
                    ? 'bg-brand-600 text-white opacity-50 cursor-not-allowed'
                    : 'bg-brand-600 text-white hover:bg-brand-500',
                )}
              >
                {orderMutation.isPending ? 'Placing Order…' : `Buy ${ticker}`}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Current holding display */}
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-slate-400">You Own</span>
              <span className="font-mono text-white font-medium">
                {currentHolding ? `${currentHolding.quantity} shares` : "You don't hold this asset"}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quantity input */}
              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="sell-quantity">
                  Quantity{maxSellQty > 0 && <span className="text-slate-500 ml-1">(max {maxSellQty})</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    id="sell-quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={maxSellQty > 0 ? maxSellQty : undefined}
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      setOrderError(null);
                    }}
                    placeholder="0.00"
                    className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-rose-500"
                  />
                  {maxSellQty > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuantity(String(maxSellQty))}
                      className="px-3 py-2 bg-surface-700 text-slate-300 text-xs font-medium rounded-lg hover:bg-surface-600 transition-colors"
                    >
                      Sell All
                    </button>
                  )}
                </div>
              </div>

              {/* Estimated proceeds */}
              <div className="flex justify-between items-center text-sm bg-surface-800 rounded-lg px-3 py-2">
                <span className="text-slate-400">Est. Proceeds (after 0.1% spread)</span>
                <span className="font-mono text-white font-medium">
                  {formatUSD(estimatedSellProceeds)}
                </span>
              </div>

              {/* Spread disclosure */}
              <p className="text-xs text-slate-500">
                ±0.1% simulated spread applied to market orders — this reflects real-world bid/ask costs.
              </p>

              {/* Error message */}
              {orderError && (
                <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-400/10 rounded-lg px-3 py-2">
                  <AlertCircle size={14} />
                  {orderError}
                  {orderErrorCode === 'INSUFFICIENT_HOLDINGS' && currentHolding && (
                    <span className="ml-1 text-slate-400">
                      (You hold {currentHolding.quantity} shares)
                    </span>
                  )}
                </div>
              )}

              {/* Sell button */}
              <button
                type="submit"
                disabled={orderMutation.isPending || !quoteData || maxSellQty === 0}
                className={cn(
                  'w-full py-3 rounded-lg font-semibold transition-colors',
                  orderMutation.isPending || !quoteData || maxSellQty === 0
                    ? 'bg-rose-600 text-white opacity-50 cursor-not-allowed'
                    : 'bg-rose-600 text-white hover:bg-rose-500',
                )}
              >
                {orderMutation.isPending ? 'Placing Order…' : `Sell ${ticker}`}
              </button>
            </form>
          </>
        )}
      </div>

      {/* T1.14 Task 3: Market News section */}
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
    </div>
  );
}
