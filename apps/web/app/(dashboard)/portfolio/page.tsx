'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatUSD, formatPercent } from '@student-investing/shared-utils';
import { cn } from '@/lib/utils';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, Sector,
} from 'recharts';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function PortfolioPage() {
  const qc = useQueryClient();
  const router = useRouter();

  // T1.12 Task 2: tab state
  const [activeTab, setActiveTab] = useState<'holdings' | 'orders'>('holdings');

  // T1.14 Task 2: reset confirmation modal state
  const [showResetModal, setShowResetModal] = useState(false);

  // T1.13 Task 3: active pie slice index
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiClient.get('/portfolio').then((r: { data: Record<string, number> }) => r.data),
    refetchInterval: 30000, // P-3 fix: AC2 — refresh total value every 30s alongside holdings
  });

  const { data: holdings } = useQuery({
    queryKey: ['holdings'],
    queryFn: () => apiClient.get('/portfolio/holdings').then((r: { data: unknown[] }) => r.data),
    refetchInterval: 30000,
  });

  const { data: history } = useQuery({
    queryKey: ['portfolio-history'],
    queryFn: () => apiClient.get('/portfolio/history').then((r: { data: { portfolio_value: number; date: string }[] }) => r.data),
  });

  // T1.12 Task 3: orders query — only fetch when tab is visible
  const { data: ordersRaw } = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiClient.get('/trade/orders').then((r: { data: unknown[] }) => r.data),
    enabled: activeTab === 'orders',
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

  // T1.12 Task 3: cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => apiClient.delete(`/trade/orders/${orderId}`),
    onSuccess: () => {
      toast.success('Order cancelled');
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error('Could not cancel order'),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiClient.post('/portfolio/reset', {}),
    onSuccess: () => {
      // CR-P7: close modal here (after success) not at click time — keeps
      // the "Resetting…" disabled state visible while the request is in-flight,
      // and ensures the user sees the result before the dialog disappears.
      setShowResetModal(false);
      toast.success('Portfolio reset to $100,000');
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      // T1.14 Task 2: also invalidate orders + history so tabs show empty state
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['portfolio-history'] });
    },
    onError: () => {
      // CR-P7: also close on error so user isn't stuck in modal — toast conveys failure
      setShowResetModal(false);
      toast.error('Reset failed');
    },
  });

  const portfolioData = portfolio as { total_value: number; total_return_pct: number; virtual_cash: number } | undefined;

  const STARTING_CAPITAL = 100000;
  const totalPnlDollars = (portfolioData?.total_value ?? 0) - STARTING_CAPITAL;

  const holdingsData = (holdings ?? []) as {
    symbol: string; asset_type: string; quantity: number; avg_cost_basis: number;
    market_value: number; unrealized_pnl: number; unrealized_pnl_pct: number; current_price: number;
  }[];

  const totalInvested = holdingsData.reduce((s, h) => s + h.avg_cost_basis * h.quantity, 0);
  const pieData = holdingsData.map((h) => ({ name: h.symbol, value: Number(h.market_value) }));
  if (portfolioData?.virtual_cash) {
    pieData.push({ name: 'Cash', value: Number(portfolioData.virtual_cash) });
  }

  const chartData = (history ?? []).map(h => ({ date: h.date.substring(0, 10), value: h.portfolio_value }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        {/* T1.14 Task 2: replaced native confirm() with modal */}
        <button
          onClick={() => setShowResetModal(true)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Reset
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column — summary stats + history chart */}
        <div className="space-y-6">
          {/* Summary Cards */}
          {/* P6: restored md:grid-cols-5 — 5 cards fit one row cleanly on tablet+ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Value', value: formatUSD(portfolioData?.total_value ?? 0) },
              {
                label: 'P&L ($)',
                value: formatUSD(totalPnlDollars),
                colored: true,
                positive: totalPnlDollars >= 0,
              },
              {
                label: 'Total Return',
                value: formatPercent(portfolioData?.total_return_pct ?? 0),
                colored: true,
                positive: (portfolioData?.total_return_pct ?? 0) >= 0,
              },
              { label: 'Invested', value: formatUSD(totalInvested) },
              { label: 'Cash Available', value: formatUSD(portfolioData?.virtual_cash ?? 0) },
            ].map(({ label, value, colored, positive }) => (
              <div key={label} className="card p-4">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className={cn('text-xl font-bold', colored ? (positive ? 'positive' : 'negative') : 'text-white')}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Portfolio Performance Chart */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Portfolio Performance</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* T1.13 Task 1: XAxis with formatted date labels */}
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tickLine={false}
                    axisLine={false}
                  />
                  {/* T1.13 Task 1: YAxis with $Xk formatter */}
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#portfolioGrad)" strokeWidth={2} dot={false} />
                  {/* T1.13 Task 1: improved Tooltip with full date + USD value */}
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(label: string) =>
                      new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    }
                    formatter={(v: number) => [formatUSD(v), 'Portfolio Value']}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-500 text-sm">
                History builds after your first trading day
              </div>
            )}
          </div>
        </div>

        {/* Right column — holdings + allocation */}
        <div className="space-y-6">
          {/* Holdings / Order History Card with Tabs */}
          <div className="card overflow-hidden">
          {/* T1.12 Task 2: tab toggle */}
          <div className="p-5 border-b border-surface-800 flex gap-4">
            {(['holdings', 'orders'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'text-sm font-medium capitalize pb-1 border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-brand-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200',
                )}
              >
                {tab === 'holdings' ? 'Holdings' : 'Order History'}
              </button>
            ))}
          </div>

          {/* T1.12 Task 1 + 2: Holdings tab */}
          {activeTab === 'holdings' && (
            holdingsData.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No holdings yet — go trade something!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-surface-800">
                      <th className="text-left px-5 py-3">Symbol</th>
                      <th className="text-right px-5 py-3">Qty</th>
                      <th className="text-right px-5 py-3">Avg Cost</th>
                      <th className="text-right px-5 py-3">Price</th>
                      <th className="text-right px-5 py-3">Value</th>
                      <th className="text-right px-5 py-3">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsData.map((h) => (
                      // T1.12 Task 1: clickable row → navigate to ticker page
                      <tr
                        key={h.symbol}
                        className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/trade/${h.symbol}?type=${h.asset_type}`)}
                      >
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-semibold text-white">{h.symbol}</p>
                            <p className="text-xs text-slate-500 uppercase">{h.asset_type}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-300 font-mono text-sm">{h.quantity}</td>
                        <td className="px-5 py-3 text-right text-slate-300 font-mono text-sm">{formatUSD(h.avg_cost_basis)}</td>
                        <td className="px-5 py-3 text-right text-white font-mono text-sm">{formatUSD(h.current_price ?? 0)}</td>
                        <td className="px-5 py-3 text-right text-white font-mono text-sm">{formatUSD(h.market_value)}</td>
                        <td className="px-5 py-3 text-right font-mono text-sm">
                          <div className={cn('flex flex-col items-end', h.unrealized_pnl >= 0 ? 'positive' : 'negative')}>
                            <span>{formatUSD(h.unrealized_pnl)}</span>
                            <span className="text-xs">{formatPercent(h.unrealized_pnl_pct)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* T1.12 Task 3: Order History tab */}
          {activeTab === 'orders' && (
            ordersData.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No orders yet — make your first trade!
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {ordersData.map((o) => (
                      <tr key={o.id} className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-semibold text-white">{o.symbol}</p>
                            <p className="text-xs text-slate-500 uppercase">{o.asset_type}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            o.side === 'buy'
                              ? 'bg-emerald-400/10 text-emerald-400'
                              : 'bg-rose-400/10 text-rose-400',
                          )}>
                            {o.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-300 font-mono text-sm">{o.quantity}</td>
                        <td className="px-5 py-3 text-right text-slate-300 font-mono text-sm">
                          {o.fill_price != null ? formatUSD(o.fill_price) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-white font-mono text-sm">
                          {o.total_value != null ? formatUSD(o.total_value) : '—'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            o.status === 'filled'
                              ? 'bg-emerald-400/10 text-emerald-400'
                              : o.status === 'pending'
                              ? 'bg-yellow-400/10 text-yellow-400'
                              : 'bg-slate-600/30 text-slate-400',
                          )}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500 text-xs font-mono">
                          {new Date(o.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {o.status === 'pending' && (
                            <button
                              onClick={() => cancelMutation.mutate(o.id)}
                              disabled={cancelMutation.isPending}
                              className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Allocation Pie */}
        <div className="card p-5">
          <h2 className="font-semibold text-white mb-4">Allocation</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  {/* T1.13 Task 2: percentage labels on slices */}
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    // CR-P4: removed 5% threshold — every slice gets a label per T1.13 AC3
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    // T1.13 Task 3: active slice highlighting
                    // CR-P3: onClick (not onMouseEnter) per T1.13 AC4 — click to highlight;
                    // click the same slice again to deselect (toggle). This also works on mobile
                    // where hover events are unreliable.
                    activeIndex={activeIndex ?? undefined}
                    activeShape={(props: Record<string, number>) => {
                      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                      return (
                        <Sector
                          cx={cx}
                          cy={cy}
                          innerRadius={innerRadius}
                          outerRadius={outerRadius + 8}
                          startAngle={startAngle}
                          endAngle={endAngle}
                          fill={fill as unknown as string}
                        />
                      );
                    }}
                    onClick={(_: unknown, index: number) =>
                      setActiveIndex(index === activeIndex ? null : index)
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatUSD(v), '']}
                  />
                  {/* T1.13 Task 2: legend with value + % */}
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                    formatter={(value: string) => {
                      const item = pieData.find((d) => d.name === value);
                      const total = pieData.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? (((item?.value ?? 0) / total) * 100).toFixed(1) : '0.0';
                      return `${value} · ${formatUSD(item?.value ?? 0)} (${pct}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* T1.13 Task 3: active slice detail below chart */}
              {activeIndex !== null && pieData[activeIndex] && (
                <div className="mt-3 text-center text-sm text-slate-300">
                  <span className="font-semibold text-white">{pieData[activeIndex].name}</span>
                  {' · '}
                  {formatUSD(pieData[activeIndex].value)}
                  {' · '}
                  {((pieData[activeIndex].value / pieData.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}%
                </div>
              )}
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              No holdings to show
            </div>
          )}
        </div>
        </div>{/* end right column */}
      </div>{/* end desktop grid */}

      {/* T1.14 Task 2: reset confirmation modal */}
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
                onClick={() => resetMutation.mutate()}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? 'Resetting…' : 'Reset Portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
