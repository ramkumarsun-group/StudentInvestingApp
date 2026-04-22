'use client';

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, YAxis } from 'recharts';
import dayjs from 'dayjs';

interface Props {
  data: { t: string; c: number }[];
}

export default function StockChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
        No chart data available
      </div>
    );
  }

  const isPositive = data[data.length - 1]?.c >= data[0]?.c;
  const chartData = data.map((d) => ({ ...d, date: dayjs(d.t).format('MMM D') }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#f43f5e'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#f43f5e'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            width={55}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(val: number) => [`$${val.toFixed(2)}`, 'Close']}
          />
          <Area
            type="monotone"
            dataKey="c"
            stroke={isPositive ? '#22c55e' : '#f43f5e'}
            strokeWidth={2}
            fill="url(#stockGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
