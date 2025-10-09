'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageDataPoint {
  date: string;
  tokens: number;
  cost: number;
}

interface UsageChartProps {
  data: UsageDataPoint[];
  type: 'tokens' | 'cost';
}

export default function UsageChart({ data, type }: UsageChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCost = (value: number) => `$${value.toFixed(4)}`;

  const formatTokens = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const strokeColor = type === 'tokens' ? 'hsl(var(--primary))' : 'hsl(var(--accent))';

  // Clamp negatives to 0 to avoid misleading visuals for refunds/adjustments
  const sanitizedData = data.map(d => ({
    ...d,
    tokens: Math.max(0, d.tokens),
    cost: Math.max(0, d.cost),
  }));

  return (
    <div className="h-80 rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground">
        {type === 'tokens' ? 'Token usage over time' : 'Cost trends over time'}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sanitizedData} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickMargin={12}
          />
          <YAxis
            tickFormatter={type === 'tokens' ? formatTokens : formatCost}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            width={80}
          />
          <Tooltip
            labelFormatter={(value) => formatDate(value as string)}
            formatter={(value: number) => [
              type === 'tokens' ? `${value.toLocaleString()} tokens` : formatCost(value),
              type === 'tokens' ? 'Tokens' : 'Cost'
            ]}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius, 0.75rem)',
              color: 'hsl(var(--popover-foreground))',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)'
            }}
          />
          <Line
            type="monotone"
            dataKey={type}
            stroke={strokeColor}
            strokeWidth={2.5}
            dot={{ r: 4, fill: strokeColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            name={type === 'tokens' ? 'Tokens' : 'Cost ($)'}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
