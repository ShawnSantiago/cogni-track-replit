import fs from 'node:fs/promises';
import path from 'node:path';

import { __usageFetcherTestHooks, type UsageEventData } from '../../src/lib/usage-fetcher';

export interface LoadedDailyUsageFixture {
  filePath: string;
  pages: unknown[];
  fallbackStart: Date;
}

export async function loadDailyUsageFixture(filePath: string): Promise<LoadedDailyUsageFixture> {
  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const pages = Array.isArray(parsed) ? parsed : [parsed];
  if (pages.length === 0) {
    throw new Error(`[dailyUsageFixture] Fixture ${absolutePath} is empty`);
  }

  const fallbackStart = deriveFallbackStart(pages) ?? new Date(0);

  return {
    filePath: absolutePath,
    pages,
    fallbackStart,
  };
}

export async function loadDailyUsageFixturesFromDirectory(directory: string): Promise<LoadedDailyUsageFixture[]> {
  const absoluteDir = path.resolve(directory);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(absoluteDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const files = entries
    .filter((entry) => entry.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(absoluteDir, entry))
    .sort();

  const fixtures: LoadedDailyUsageFixture[] = [];
  for (const file of files) {
    fixtures.push(await loadDailyUsageFixture(file));
  }
  return fixtures;
}

export function normalizeFixtureEvents(fixture: LoadedDailyUsageFixture): UsageEventData[] {
  const events = __usageFetcherTestHooks.normalizeAdminUsagePagesForTest(
    fixture.pages,
    fixture.fallbackStart
  );
  if (events.length === 0) {
    throw new Error(`[dailyUsageFixture] Fixture ${fixture.filePath} produced zero usage events`);
  }
  return events;
}

function deriveFallbackStart(pages: unknown[]): Date | undefined {
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue;
    const cast = page as { data?: Array<Record<string, unknown>>; daily_costs?: Array<Record<string, unknown>> };
    const records = Array.isArray(cast.data) ? cast.data : [];
    for (const record of records) {
      const iso = typeof record.start_time_iso === 'string' ? record.start_time_iso : undefined;
      if (iso) {
        const parsed = new Date(iso);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      const epoch = typeof record.start_time === 'number' ? record.start_time : undefined;
      if (epoch !== undefined) {
        return epoch < 1e12 ? new Date(epoch * 1000) : new Date(epoch);
      }
    }

    const dailyCosts = Array.isArray(cast.daily_costs) ? cast.daily_costs : [];
    for (const item of dailyCosts) {
      const timestamp = typeof item.timestamp === 'number' ? item.timestamp : undefined;
      if (timestamp !== undefined) {
        return timestamp < 1e12 ? new Date(timestamp * 1000) : new Date(timestamp);
      }
    }
  }
  return undefined;
}
