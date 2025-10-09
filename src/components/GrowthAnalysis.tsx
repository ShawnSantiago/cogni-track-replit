'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import { calculateUsageGrowth } from '../lib/csv-export';
import { UsageEventWithMetadata } from '@/types/usage';

interface GrowthAnalysisProps {
  events: UsageEventWithMetadata[];
  className?: string;
}

const GROWTH_STYLES = {
  positive: { chip: 'bg-primary text-primary-foreground', text: 'text-foreground' },
  negative: { chip: 'bg-destructive text-destructive-foreground', text: 'text-foreground' },
  neutral: { chip: 'bg-muted text-muted-foreground', text: 'text-muted-foreground' }
};

export default function GrowthAnalysis({ events, className }: GrowthAnalysisProps) {
  const growth = calculateUsageGrowth(events);

  const formatGrowth = (value: number) => {
    if (value > 0) {
      return { text: `+${value.toFixed(1)}%`, icon: '↗', tone: 'positive' as const };
    }
    if (value < 0) {
      return { text: `${value.toFixed(1)}%`, icon: '↘', tone: 'negative' as const };
    }
    return { text: `${value.toFixed(1)}%`, icon: '→', tone: 'neutral' as const };
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const tokensGrowth = formatGrowth(growth.growth.tokens);
  const costGrowth = formatGrowth(growth.growth.cost);
  const requestsGrowth = formatGrowth(growth.growth.requests);

  const growthCards = [
    {
      title: 'Token usage',
      current: formatNumber(growth.currentPeriod.tokens),
      previous: formatNumber(growth.previousPeriod.tokens),
      change: tokensGrowth,
      unit: 'tokens'
    },
    {
      title: 'Total cost',
      current: `$${growth.currentPeriod.cost.toFixed(2)}`,
      previous: `$${growth.previousPeriod.cost.toFixed(2)}`,
      change: costGrowth,
      unit: ''
    },
    {
      title: 'API requests',
      current: formatNumber(growth.currentPeriod.requests),
      previous: formatNumber(growth.previousPeriod.requests),
      change: requestsGrowth,
      unit: 'requests'
    }
  ];

  return (
    <div className={cn('rounded-lg border border-border bg-card p-6 shadow-sm', className)}>
      <h2 className="text-xl font-semibold text-foreground">30-day growth analysis</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Compare the current 30-day window against the previous period to monitor momentum.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {growthCards.map((card) => {
          const tone = GROWTH_STYLES[card.change.tone];
          return (
            <div key={card.title} className="rounded-md border border-border/60 bg-muted/30 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">Current vs previous 30 days</p>
                </div>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone.chip)}>
                  {card.change.icon}
                </span>
              </div>
              <div className="mt-4 space-y-1">
                <div className="text-2xl font-semibold text-foreground">{card.current}</div>
                <div className={cn('text-sm font-medium', tone.text)}>{card.change.text}</div>
                <div className="text-xs text-muted-foreground">Previous: {card.previous} {card.unit}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-md border border-border/60 bg-muted/20 p-4">
        <h4 className="text-sm font-medium text-foreground">Key insights</h4>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {growth.growth.cost > 20 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
              <span>High cost increase detected — consider optimizing usage or reviewing spikes.</span>
            </li>
          )}
          {growth.growth.tokens > 50 && growth.growth.cost < 10 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <span>Efficient scaling — token throughput is rising faster than costs.</span>
            </li>
          )}
          {growth.currentPeriod.requests === 0 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-muted-foreground" aria-hidden="true" />
              <span>No recent usage — schedule automated checks or confirm provider ingestion.</span>
            </li>
          )}
          {growth.growth.requests > 0 && Math.abs(growth.growth.cost - growth.growth.requests) < 5 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <span>Consistent usage pattern — costs are scaling proportionally with requests.</span>
            </li>
          )}
          {growth.growth.tokens <= 0 && growth.growth.cost <= 0 && (
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-muted-foreground" aria-hidden="true" />
              <span>Usage is flat or declining — verify scheduled jobs and automation.</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
