import assert from 'node:assert/strict';

import type { UsageEventData } from '../../src/lib/usage-fetcher';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WINDOW_TOLERANCE_MS = 5 * 60 * 1000; // five minutes tolerance for API rounding

export interface WindowBucketSummary {
  key: string;
  windowStartIso: string;
  windowEndIso: string;
  projectId?: string;
  apiKeyId?: string;
  userId?: string;
  serviceTier?: string;
  models: string[];
  eventCount: number;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
}

export interface AggregatedTotals {
  eventCount: number;
  windowCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  distinctProjects: number;
  distinctKeys: number;
  distinctUsers: number;
  models: string[];
}

export function assertNonNegativeTokenCounts(events: UsageEventData[]): void {
  for (const event of events) {
    if (event.tokensIn < 0 || event.tokensOut < 0) {
      throw new Error(
        `[dailyUsageAssertions] Negative token count detected for model ${event.model} at ${formatWindowLabel(
          event
        )}`
      );
    }
  }
}

export function assertWindowDurations(events: UsageEventData[]): void {
  for (const event of events) {
    const { windowStart, windowEnd } = coerceWindowDates(event);
    const duration = windowEnd.getTime() - windowStart.getTime();
    if (duration < 0) {
      throw new Error(
        `[dailyUsageAssertions] Window end precedes start for ${formatWindowLabel(event)} (duration ${duration}ms)`
      );
    }
    if (Math.abs(duration - DAY_IN_MS) > WINDOW_TOLERANCE_MS) {
      throw new Error(
        `[dailyUsageAssertions] Window duration ${duration}ms deviates from 24h tolerance for ${formatWindowLabel(event)}`
      );
    }
  }
}

export function summarizeWindowBuckets(events: UsageEventData[]): WindowBucketSummary[] {
  const map = new Map<string, WindowBucketSummary>();

  for (const event of events) {
    const { windowStart, windowEnd } = coerceWindowDates(event);
    const key = buildWindowKey(event, windowStart);
    let summary = map.get(key);
    if (!summary) {
      summary = {
        key,
        windowStartIso: windowStart.toISOString(),
        windowEndIso: windowEnd.toISOString(),
        projectId: event.projectId,
        apiKeyId: event.openaiApiKeyId,
        userId: event.openaiUserId,
        serviceTier: event.serviceTier,
        models: [],
        eventCount: 0,
        tokensIn: 0,
        tokensOut: 0,
        costEstimate: 0,
      };
      map.set(key, summary);
    }
    summary.eventCount += 1;
    summary.tokensIn += event.tokensIn;
    summary.tokensOut += event.tokensOut;
    summary.costEstimate += event.costEstimate;
    if (!summary.models.includes(event.model)) {
      summary.models.push(event.model);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function computeAggregatedTotals(
  events: UsageEventData[],
  summaries: WindowBucketSummary[] = summarizeWindowBuckets(events)
): AggregatedTotals {
  const distinctProjects = new Set(events.map((event) => event.projectId ?? 'unknown')).size;
  const distinctKeys = new Set(events.map((event) => event.openaiApiKeyId ?? 'unknown')).size;
  const distinctUsers = new Set(events.map((event) => event.openaiUserId ?? 'unknown')).size;
  const models = Array.from(new Set(events.map((event) => event.model))).sort();

  const totalTokensIn = events.reduce((total, event) => total + event.tokensIn, 0);
  const totalTokensOut = events.reduce((total, event) => total + event.tokensOut, 0);

  return {
    eventCount: events.length,
    windowCount: summaries.length,
    totalTokensIn,
    totalTokensOut,
    distinctProjects,
    distinctKeys,
    distinctUsers,
    models,
  };
}

export function assertNoDuplicateWindows(summary: WindowBucketSummary[]): void {
  const seen = new Set<string>();
  for (const bucket of summary) {
    const key = `${bucket.windowStartIso}|${bucket.projectId ?? 'unknown-project'}|${bucket.apiKeyId ?? 'unknown-key'}|${bucket.userId ?? 'unknown-user'}|${bucket.models.sort().join(',')}`;
    if (seen.has(key)) {
      throw new Error(`[dailyUsageAssertions] Duplicate window detected for key ${key}`);
    }
    seen.add(key);
  }
}

export function findEventsMissingAdminMetadata(events: UsageEventData[]): UsageEventData[] {
  return events.filter((event) => !event.projectId || !event.openaiApiKeyId || !event.openaiUserId);
}

export function assertNoMissingAdminMetadata(events: UsageEventData[]): void {
  const missing = findEventsMissingAdminMetadata(events);
  if (missing.length > 0) {
    const samples = missing.slice(0, 3).map((event) => formatWindowLabel(event));
    throw new Error(
      `[dailyUsageAssertions] ${missing.length} events missing admin metadata (sample: ${samples.join(', ')})`
    );
  }
}

export function ensureMonotonicWindows(events: UsageEventData[]): void {
  const sorted = [...events].sort((a, b) => {
    const { windowStart: startA } = coerceWindowDates(a);
    const { windowStart: startB } = coerceWindowDates(b);
    return startA.getTime() - startB.getTime();
  });
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = coerceWindowDates(sorted[index - 1]).windowStart;
    const current = coerceWindowDates(sorted[index]).windowStart;
    if (current.getTime() < prev.getTime()) {
      throw new Error('[dailyUsageAssertions] Window start times are not monotonic');
    }
  }
}

export function expectEventCount(events: UsageEventData[], predicate: (event: UsageEventData) => boolean): number {
  return events.reduce((count, event) => (predicate(event) ? count + 1 : count), 0);
}

function coerceWindowDates(event: UsageEventData): { windowStart: Date; windowEnd: Date } {
  const windowStart = (event.windowStart ?? event.timestamp) instanceof Date
    ? new Date((event.windowStart ?? event.timestamp).getTime())
    : new Date(event.windowStart ?? event.timestamp);
  const windowEnd = event.windowEnd instanceof Date ? new Date(event.windowEnd.getTime()) : new Date(event.windowEnd ?? windowStart);
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
    throw new Error('[dailyUsageAssertions] Invalid window dates on usage event');
  }
  return { windowStart, windowEnd };
}

function buildWindowKey(event: UsageEventData, windowStart: Date): string {
  const project = event.projectId ?? 'unknown-project';
  const apiKey = event.openaiApiKeyId ?? 'unknown-key';
  const user = event.openaiUserId ?? 'unknown-user';
  const tier = event.serviceTier ?? 'unknown-tier';
  const batch = event.batch === true ? 'batch' : 'stream';
  return [windowStart.toISOString(), project, apiKey, user, tier, batch].join('|');
}

function formatWindowLabel(event: UsageEventData): string {
  const { windowStart, windowEnd } = coerceWindowDates(event);
  return `${windowStart.toISOString()}→${windowEnd.toISOString()} (${event.projectId ?? 'unknown project'})`;
}

// Re-export assert for convenience in contract tests.
export { assert };
