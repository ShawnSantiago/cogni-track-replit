'use client';

import React, { useId, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { cn } from '@/lib/utils';
import { UsageEventWithMetadata } from '@/types/usage';

const getEventDate = (event: UsageEventWithMetadata) => new Date(event.windowStart ?? event.timestamp);

interface AggregatedData {
  period: string;
  requests: number;
  tokens: number;
  cost: number;
  providers: Record<string, number>;
  models: Record<string, number>;
}

interface DataAggregationProps {
  events: UsageEventWithMetadata[];
  className?: string;
}

export default function DataAggregation({ events, className }: DataAggregationProps) {
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [viewType, setViewType] = useState<'overview' | 'breakdown'>('overview');

  const aggregateData = (groupBy: 'weekly' | 'monthly'): AggregatedData[] => {
    const groups: Record<string, AggregatedData> = {};

    events.forEach(event => {
      const date = getEventDate(event);
      let periodKey: string;

      if (groupBy === 'weekly') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        periodKey = startOfWeek.toISOString().split('T')[0];
      } else {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groups[periodKey]) {
        groups[periodKey] = {
          period: periodKey,
          requests: 0,
          tokens: 0,
          cost: 0,
          providers: {},
          models: {}
        };
      }

      const group = groups[periodKey];
      group.requests++;
      group.tokens += (event.tokensIn || 0) + (event.tokensOut || 0);
      group.cost += parseFloat(event.costEstimate || '0');

      if (!group.providers[event.provider]) {
        group.providers[event.provider] = 0;
      }
      group.providers[event.provider]++;

      if (!group.models[event.model]) {
        group.models[event.model] = 0;
      }
      group.models[event.model]++;
    });

    return Object.values(groups).sort((a, b) => a.period.localeCompare(b.period));
  };

  const formatPeriod = (period: string, groupBy: 'weekly' | 'monthly'): string => {
    if (groupBy === 'weekly') {
      const date = new Date(period);
      const endDate = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000);
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    const [year, month] = period.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const aggregatedData = aggregateData(timeframe);
  const chartData = aggregatedData.map(item => ({
    period: formatPeriod(item.period, timeframe),
    requests: item.requests,
    tokens: item.tokens,
    cost: parseFloat(item.cost.toFixed(2))
  }));

  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm', className)}>
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Usage reports</h3>
          <p className="text-sm text-muted-foreground">Aggregate requests, tokens, and cost by week or month.</p>
        </div>
        <div className="flex flex-wrap items-start gap-4 text-left sm:justify-end">
          <div className="flex flex-col gap-1">
            <span id="usage-timeframe-label" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Timeframe
            </span>
            <ToggleGroup
              labelledBy="usage-timeframe-label"
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' }
              ]}
              value={timeframe}
              onChange={(value) => setTimeframe(value as 'weekly' | 'monthly')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span id="usage-view-label" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              View
            </span>
            <ToggleGroup
              labelledBy="usage-view-label"
              options={[
                { value: 'overview', label: 'Overview' },
                { value: 'breakdown', label: 'Breakdown' }
              ]}
              value={viewType}
              onChange={(value) => setViewType(value as 'overview' | 'breakdown')}
            />
          </div>
        </div>
      </div>

      {aggregatedData.length > 0 ? (
        <div className="px-4 py-4">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="period"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickMargin={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={formatNumber}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius, 0.75rem)',
                    color: 'hsl(var(--popover-foreground))',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)'
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'cost' ? `$${value.toFixed(2)}` : formatNumber(value),
                    name.charAt(0).toUpperCase() + name.slice(1)
                  ]}
                />
                <Bar dataKey="requests" fill="hsl(var(--primary))" name="Requests" radius={[6, 6, 0, 0]} />
                <Bar dataKey="tokens" fill="hsl(var(--muted-foreground))" name="Tokens" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cost" fill="hsl(var(--secondary-foreground))" name="Cost ($)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {viewType === 'breakdown' && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Requests
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total tokens
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Top provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Top model
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {aggregatedData.map((item) => {
                    const topProvider = Object.entries(item.providers).sort(([,a], [,b]) => b - a)[0];
                    const topModel = Object.entries(item.models).sort(([,a], [,b]) => b - a)[0];

                    return (
                      <tr key={item.period} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-4 text-sm text-foreground">
                          {formatPeriod(item.period, timeframe)}
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">{item.requests.toLocaleString()}</td>
                        <td className="px-4 py-4 text-sm text-foreground">{formatNumber(item.tokens)}</td>
                        <td className="px-4 py-4 text-sm text-foreground">${item.cost.toFixed(2)}</td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {topProvider ? `${topProvider[0]} (${topProvider[1]})` : '—'}
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {topModel ? `${topModel[0]} (${topModel[1]})` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div role="status" aria-live="polite" aria-atomic="true" className="rounded-lg border border-muted-foreground/30 bg-muted/20 p-8 text-center shadow-sm text-sm text-muted-foreground">
          No usage data available for the selected timeframe.
        </div>
      )}
    </div>
  );
}

interface ToggleGroupOption {
  value: string;
  label: string;
}

interface ToggleGroupProps {
  label?: string;
  labelledBy?: string;
  options: ToggleGroupOption[];
  value: string;
  onChange: (value: string) => void;
}

function ToggleGroup({ label, labelledBy, options, value, onChange }: ToggleGroupProps) {
  const generatedId = useId();
  const fallbackLabelId = label ? `${generatedId}-label` : undefined;
  const groupLabelId = labelledBy ?? fallbackLabelId;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-1"
      role="group"
      aria-labelledby={groupLabelId}
    >
      {label && !labelledBy ? (
        <span id={fallbackLabelId} className="sr-only">
          {label}
        </span>
      ) : null}
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
