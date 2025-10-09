#!/usr/bin/env tsx

import * as fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import path from 'node:path';

import {
  loadDailyUsageFixture,
  loadDailyUsageFixturesFromDirectory,
  normalizeFixtureEvents,
} from '../tests/helpers/dailyUsageFixture';
import {
  assertNonNegativeTokenCounts,
  assertWindowDurations,
  ensureMonotonicWindows,
  summarizeWindowBuckets,
  assertNoMissingAdminMetadata,
  computeAggregatedTotals,
} from '../tests/helpers/dailyUsageAssertions';
import { diffAggregatedTotals, loadExpectedTotalsFile } from '../tests/helpers/expectedTotals';

interface AggregatedSummary {
  fixture: string;
  eventCount: number;
  windowCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  distinctProjects: number;
  distinctKeys: number;
  distinctUsers: number;
  models: string[];
}

async function main() {
  const { targetPath, expectedPath, tolerance } = parseArgs(process.argv.slice(2));

  if (!targetPath) {
    console.error('Usage: tsx scripts/summarize-daily-usage-fixture.ts <fixture.json|directory> [--expected <totals.json>] [--tolerance <value>]');
    process.exit(1);
  }

  const absoluteTarget = path.resolve(targetPath);
  const stats = await safeStat(absoluteTarget);

  if (!stats) {
    console.error(`Target not found: ${absoluteTarget}`);
    process.exit(1);
  }

  const fixtures = stats.isDirectory()
    ? await loadDailyUsageFixturesFromDirectory(absoluteTarget)
    : [await loadDailyUsageFixture(absoluteTarget)];

  if (fixtures.length === 0) {
    console.warn('[summarize-daily-usage-fixture] No fixtures to summarize');
    return;
  }

  const expected = expectedPath ? await loadExpectedTotalsFile(expectedPath) : null;

  for (const fixture of fixtures) {
    const events = normalizeFixtureEvents(fixture);

    assertNonNegativeTokenCounts(events);
    assertWindowDurations(events);
    ensureMonotonicWindows(events);
    assertNoMissingAdminMetadata(events);

    const summaries = summarizeWindowBuckets(events);
    const aggregated: AggregatedSummary = {
      fixture: fixture.filePath,
      ...computeAggregatedTotals(events, summaries),
    };

    if (expected) {
      const mismatches = diffAggregatedTotals(aggregated, expected, fixture.filePath, tolerance);
      if (mismatches.length > 0) {
        const message = mismatches.map((item) => ` - ${item}`).join('\n');
        throw new Error(
          `[summarize-daily-usage-fixture] Expected totals mismatch for ${path.resolve(fixture.filePath)}:\n${message}`
        );
      }
    }

    console.log(JSON.stringify({ summary: aggregated, windows: summaries }, null, 2));
  }
}

async function safeStat(target: string): Promise<Stats | null> {
  try {
    return await fs.stat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function parseArgs(args: string[]): { targetPath?: string; expectedPath?: string; tolerance: number } {
  let expectedPath: string | undefined;
  let tolerance = 0;
  const targets: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--expected') {
      expectedPath = args[++index];
      continue;
    }
    if (arg.startsWith('--expected=')) {
      expectedPath = arg.split('=')[1] ?? '';
      continue;
    }
    if (arg === '--tolerance') {
      tolerance = Number(args[++index] ?? '0');
      continue;
    }
    if (arg.startsWith('--tolerance=')) {
      tolerance = Number(arg.split('=')[1] ?? '0');
      continue;
    }
    if (arg.startsWith('--')) {
      console.warn(`[summarize-daily-usage-fixture] Ignoring unknown option ${arg}`);
      continue;
    }
    targets.push(arg);
  }

  if (Number.isNaN(tolerance) || !Number.isFinite(tolerance)) {
    throw new Error('[summarize-daily-usage-fixture] Invalid tolerance value');
  }

  return {
    targetPath: targets[0],
    expectedPath,
    tolerance,
  };
}

main().catch((error) => {
  console.error('[summarize-daily-usage-fixture] Failed', error);
  process.exit(1);
});
