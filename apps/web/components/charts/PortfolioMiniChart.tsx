'use client';

import { AreaChart, Area, Tooltip, ResponsiveContainer, YAxis } from 'recharts';

interface Props {
  data: { value: number; date: string }[];
}

export default function PortfolioMiniChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-on-surface-variant text-sm">
        No history yet — start trading!
      </div>
    );
  }

  const isPositive = data.length > 1
    ? data[data.length - 1].value >= data[0].value
    : true;

  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#f43f5e'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#f43f5e'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ display: 'none' }}
            formatter={(val: unknown) => [`$${Number(val).toFixed(2)}`, 'Value']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={isPositive ? '#22c55e' : '#f43f5e'}
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
