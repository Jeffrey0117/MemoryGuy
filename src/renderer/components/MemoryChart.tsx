import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { MemorySnapshot } from '@shared/types';

interface Props {
  data: MemorySnapshot[];
  label: string;
  color?: string;
  unit?: 'gb' | 'percent';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function formatValue(val: number, unit: 'gb' | 'percent'): string {
  if (unit === 'percent') return `${val.toFixed(1)}%`;
  return `${(val / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function MemoryChart({ data, label, color = '#3b82f6', unit = 'gb' }: Props) {
  // Downsample for performance: show max 300 points
  const step = Math.max(1, Math.floor(data.length / 300));
  const sampled = data.filter((_, i) => i % step === 0);

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-mg-muted mb-3">{label}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={sampled}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={60}
          />
          <YAxis
            tickFormatter={(v) => formatValue(v, unit)}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{ background: 'var(--mg-tooltip-bg)', border: '1px solid var(--mg-tooltip-border)', borderRadius: 8, color: 'var(--mg-text)' }}
            labelFormatter={formatTime}
            formatter={(v: number) => [formatValue(v, unit), label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
