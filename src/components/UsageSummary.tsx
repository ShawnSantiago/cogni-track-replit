'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import { UsageEventWithMetadata } from '@/types/usage';

interface UsageSummaryProps {
  events: UsageEventWithMetadata[];
}

export default function UsageSummary({ events }: UsageSummaryProps) {
  const totalEvents = events.length;
  const totalTokensIn = events.reduce((sum, event) => sum + (event.tokensIn || 0), 0);
  const totalTokensOut = events.reduce((sum, event) => sum + (event.tokensOut || 0), 0);
  const totalCost = events.reduce((sum, event) => sum + parseFloat(event.costEstimate || '0'), 0);
  const totalCachedInputTokens = events.reduce((sum, event) => sum + (event.inputCachedTokens || 0), 0);

  const uniqueModels = Array.from(new Set(events.map(event => event.model)));
  const uniqueProjects = Array.from(new Set(events.map(event => event.projectId).filter((value): value is string => Boolean(value))));
  const uniqueApiKeys = Array.from(new Set(events.map(event => event.openaiApiKeyId).filter((value): value is string => Boolean(value))));
  const uniqueServiceTiers = Array.from(new Set(events.map(event => event.serviceTier).filter((value): value is string => Boolean(value))));
  const windowedEventCount = events.filter(event => event.windowStart !== null).length;

  const providerStats = events.reduce((acc, event) => {
    if (!acc[event.provider]) {
      acc[event.provider] = { events: 0, cost: 0 };
    }
    acc[event.provider].events++;
    acc[event.provider].cost += parseFloat(event.costEstimate || '0');
    return acc;
  }, {} as Record<string, { events: number; cost: number }>);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const stats = [
    {
      label: 'Total requests',
      value: totalEvents.toLocaleString(),
      accent: 'text-primary'
    },
    {
      label: 'Input tokens',
      value: formatNumber(totalTokensIn),
      accent: 'text-primary'
    },
    {
      label: 'Output tokens',
      value: formatNumber(totalTokensOut),
      accent: 'text-primary'
    },
    {
      label: 'Total cost',
      value: `$${totalCost.toFixed(4)}`,
      accent: 'text-primary'
    },
    {
      label: 'Cached input tokens',
      value: formatNumber(totalCachedInputTokens),
      accent: 'text-primary'
    },
    {
      label: 'Windowed events',
      value: `${windowedEventCount.toLocaleString()} of ${totalEvents.toLocaleString()}`,
      accent: 'text-primary'
    }
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-foreground">Usage summary</h2>

      <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-border/60 bg-muted/40 p-4"
          >
            <dt className="text-sm font-medium text-muted-foreground">{stat.label}</dt>
            <dd className={cn('mt-2 text-2xl font-semibold leading-none', stat.accent)}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {Object.keys(providerStats).length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-lg font-medium text-foreground">Usage by provider</h3>
          <div className="space-y-2">
            {Object.entries(providerStats).map(([provider, stats]) => (
              <div
                key={provider}
                className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <span className="font-medium capitalize text-foreground">{provider}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">{stats.events} requests</div>
                  <div className="text-xs text-muted-foreground">${stats.cost.toFixed(4)}</div>
                </div>
              </div>
            ))}
      </div>
    </div>
  )}

  {uniqueProjects.length > 0 && (
    <div className="mt-8 space-y-3">
      <h3 className="text-lg font-medium text-foreground">Projects tracked</h3>
      <div className="flex flex-wrap gap-2">
        {uniqueProjects.map(projectId => (
          <span
            key={projectId}
            className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground"
          >
            {projectId}
          </span>
        ))}
      </div>
    </div>
  )}

  {uniqueApiKeys.length > 0 && (
    <div className="mt-8 space-y-3">
      <h3 className="text-lg font-medium text-foreground">API keys</h3>
      <div className="flex flex-wrap gap-2">
        {uniqueApiKeys.slice(0, 8).map(apiKeyId => (
          <span
            key={apiKeyId}
            className="inline-flex items-center rounded-full border border-border bg-muted/20 px-3 py-1 text-sm text-muted-foreground"
          >
            {apiKeyId}
          </span>
        ))}
        {uniqueApiKeys.length > 8 && (
          <span className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">
            +{uniqueApiKeys.length - 8} more
          </span>
        )}
      </div>
    </div>
  )}

  {uniqueServiceTiers.length > 0 && (
    <div className="mt-8 space-y-3">
      <h3 className="text-lg font-medium text-foreground">Service tiers</h3>
      <div className="flex flex-wrap gap-2">
        {uniqueServiceTiers.map(serviceTier => (
          <span
            key={serviceTier}
            className="inline-flex items-center rounded-full border border-border bg-muted/30 px-3 py-1 text-sm text-muted-foreground"
          >
            {serviceTier}
          </span>
        ))}
      </div>
    </div>
  )}

  {uniqueModels.length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-lg font-medium text-foreground">Models used</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueModels.map((model) => (
              <span
                key={model}
                className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground"
              >
                {model}
              </span>
            ))}
          </div>
        </div>
      )}

      {totalEvents === 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-8 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground"
        >
          No usage data matches the current filters.
        </div>
      )}
    </div>
  );
}
