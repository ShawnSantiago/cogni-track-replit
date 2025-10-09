import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getDb } from '../../lib/database';
import { usageEvents, providerKeys } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import RefreshButton from '../../components/RefreshButton';
import FilterableAnalyticsDashboard from '../../components/FilterableAnalyticsDashboard';
import { refreshUsageData } from './actions';
import { UsageEventWithMetadata } from '@/types/usage';
import {
  BASE_USAGE_EVENT_SELECTION,
  METADATA_USAGE_EVENT_SELECTION,
  isMissingColumnError,
  mapDbRowToUsageEvent,
} from '@/lib/usage-event-helpers';

// Removed UsageDataPoint interface - now handled in FilterableAnalyticsDashboard

const buildSelection = (includeMetadata: boolean) =>
  includeMetadata
    ? { ...BASE_USAGE_EVENT_SELECTION, ...METADATA_USAGE_EVENT_SELECTION }
    : { ...BASE_USAGE_EVENT_SELECTION };

async function getUsageData(userId: string): Promise<UsageEventWithMetadata[]> {
  const db = getDb();

  const loadEvents = (includeMetadata: boolean) =>
    db
      .select(buildSelection(includeMetadata))
      .from(usageEvents)
      .innerJoin(providerKeys, eq(usageEvents.keyId, providerKeys.id))
      .where(eq(providerKeys.userId, userId))
      .orderBy(desc(usageEvents.timestamp))
      .limit(1000);

  try {
    const events = await loadEvents(true);
    return (events as any[]).map(mapDbRowToUsageEvent);
  } catch (error) {
    if (isMissingColumnError(error)) {
      console.warn('[analytics] usage metadata columns missing – falling back to legacy selection');
      try {
        const legacyEvents = await loadEvents(false);
        return (legacyEvents as any[]).map(mapDbRowToUsageEvent);
      } catch (fallbackError) {
        console.error('Fallback usage query failed:', fallbackError);
        return [];
      }
    }

    console.error('Error fetching usage data:', error);
    return [];
  }
}

// Removed processChartData function - now handled in FilterableAnalyticsDashboard

// Removed fetchUsageData - now using server actions

export default async function AnalyticsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  const events = await getUsageData(userId);
  
  // Extract unique providers and models for filtering
  const availableProviders = Array.from(new Set(events.map(e => e.provider))).sort();
  const availableModels = Array.from(new Set(events.map(e => e.model))).sort();
  const availableProjects = Array.from(new Set(events.map(e => e.projectId).filter((value): value is string => Boolean(value)))).sort();
  const availableApiKeys = Array.from(new Set(events.map(e => e.openaiApiKeyId).filter((value): value is string => Boolean(value)))).sort();
  const availableServiceTiers = Array.from(new Set(events.map(e => e.serviceTier).filter((value): value is string => Boolean(value)))).sort();
  
  // Bind server action with specific parameters
  const refresh7Days = refreshUsageData.bind(null, 7);

  const hasEvents = events.length > 0;

  return (
    <div className="container space-y-10 py-10 lg:py-12" role="region" aria-labelledby="analytics-page-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 id="analytics-page-title" className="text-3xl font-semibold tracking-tight">Usage analytics</h1>
          <p className="max-w-2xl text-muted-foreground">
            Monitor spend anomalies, track token trends, and export usage snapshots without leaving your workspace.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <RefreshButton
            onRefresh={refresh7Days}
            className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            Refresh data
          </RefreshButton>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Manage keys
          </a>
        </div>
      </header>

      {hasEvents ? (
        <FilterableAnalyticsDashboard
          events={events}
          availableProviders={availableProviders}
          availableModels={availableModels}
          availableProjects={availableProjects}
          availableApiKeys={availableApiKeys}
          availableServiceTiers={availableServiceTiers}
        />
      ) : (
        <section
          aria-labelledby="analytics-empty-state-heading"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="rounded-lg border border-muted-foreground/30 bg-muted/20 p-10 text-center shadow-sm"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 id="analytics-empty-state-heading" className="text-xl font-semibold">
                No usage data yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect a provider key and fetch recent activity to unlock dashboards and exports.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Add API keys
              </a>
              <RefreshButton
                onRefresh={refresh7Days}
                className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              >
                Fetch usage data
              </RefreshButton>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
