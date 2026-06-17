import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '../../types/drp';

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5d64a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#c5d64a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2a3a33" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmt}
          stroke="#8a9b93"
          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
          tickLine={false}
        />
        <YAxis
          domain={[60, 100]}
          stroke="#8a9b93"
          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: '#16211d',
            border: '1px solid #2a3a33',
            borderRadius: 6,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
          }}
          labelFormatter={(d) => fmt(String(d))}
          formatter={(v) => [`${v}%`, 'Deployable']}
        />
        <Area
          type="monotone"
          dataKey="pct_deployable"
          stroke="#c5d64a"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
