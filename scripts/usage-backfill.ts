#!/usr/bin/env tsx

import 'dotenv/config';
import { exit } from 'node:process';

import { eq } from 'drizzle-orm';

import { getDb } from '../src/lib/database';
import { fetchAndStoreUsageForUser } from '../src/lib/usage-fetcher';
import { providerKeys } from '../src/db/schema';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DbClient = ReturnType<typeof getDb>;

type DateInput = string | number | Date;

type CliOptions = {
  userIds: string[];
  days: number;
  chunkDays: number;
  sleepMs: number;
  start?: DateInput;
  end?: DateInput;
  runLabel: string;
};

type BackfillTotals = {
  processedUsers: number;
  processedChunks: number;
  processedKeys: number;
  simulatedKeys: number;
  failedKeys: number;
  storedEvents: number;
  updatedEvents: number;
  windowsProcessed: number;
  issues: number;
  constraintInserts: number;
  constraintUpdates: number;
  manualFallbackInserts: number;
  manualFallbackUpdates: number;
  manualFallbackWindows: number;
  manualFallbackKeys: number;
};

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function parseDateInput(value: DateInput, label: string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label} date: ${value}`);
  }
  return startOfDayUtc(parsed);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    userIds: [],
    days: 30,
    chunkDays: 5,
    sleepMs: 0,
    runLabel: `usage-backfill-cli`,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--user':
      case '-u': {
        const value = args[i + 1];
        if (!value) {
          throw new Error('--user requires an argument');
        }
        i += 1;
        const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
        options.userIds.push(...ids);
        break;
      }
      case '--days': {
        const value = Number(args[i + 1]);
        if (!Number.isFinite(value) || value < 1) {
          throw new Error('--days must be a positive number');
        }
        options.days = Math.floor(value);
        i += 1;
        break;
      }
      case '--chunk-days': {
        const value = Number(args[i + 1]);
        if (!Number.isFinite(value) || value < 1) {
          throw new Error('--chunk-days must be a positive number');
        }
        options.chunkDays = Math.floor(value);
        i += 1;
        break;
      }
      case '--sleep-ms': {
        const value = Number(args[i + 1]);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error('--sleep-ms must be a non-negative number');
        }
        options.sleepMs = Math.floor(value);
        i += 1;
        break;
      }
      case '--start': {
        const value = args[i + 1];
        if (!value) {
          throw new Error('--start requires an ISO date');
        }
        options.start = parseDateInput(value, 'start');
        i += 1;
        break;
      }
      case '--end': {
        const value = args[i + 1];
        if (!value) {
          throw new Error('--end requires an ISO date');
        }
        options.end = parseDateInput(value, 'end');
        i += 1;
        break;
      }
      case '--label': {
        const value = args[i + 1];
        if (!value) {
          throw new Error('--label requires a value');
        }
        options.runLabel = value;
        i += 1;
        break;
      }
      case '--help':
      case '-h': {
        printUsage();
        exit(0);
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.chunkDays > options.days) {
    options.chunkDays = options.days;
  }

  if (options.start && options.end && options.start > options.end) {
    throw new Error('start date must be on or before end date');
  }

  return options;
}

function printUsage() {
  console.log(`Usage: pnpm exec tsx scripts/usage-backfill.ts [options]\n\nOptions:\n  --user, -u <id>[,id...]  Restrict backfill to specific user IDs\n  --days <n>                Number of days to backfill (default: 30)\n  --chunk-days <n>          Days per ingestion chunk (default: 5)\n  --start <ISO>             Inclusive UTC start date (defaults to today - days + 1)\n  --end <ISO>               Inclusive UTC end date (defaults to today)\n  --sleep-ms <n>            Delay between chunks in milliseconds\n  --label <name>            Label applied to ingestion logs\n  --help                    Show this message\n`);
}

async function resolveTargetUserIds(db: DbClient, explicitUserIds: string[]): Promise<string[]> {
  if (explicitUserIds.length > 0) {
    return Array.from(new Set(explicitUserIds));
  }

  const rows = await db
    .select({ userId: providerKeys.userId })
    .from(providerKeys)
    .where(eq(providerKeys.provider, 'openai'));

  const unique = new Set<string>();
  for (const row of rows) {
    if (row.userId) {
      unique.add(row.userId);
    }
  }

  return Array.from(unique).sort();
}

function resolveDateRange(options: CliOptions): { start: Date; end: Date } {
  const today = startOfDayUtc(new Date());
  let end: Date;
  let start: Date;

  if (options.start && options.end) {
    start = parseDateInput(options.start, 'start');
    end = parseDateInput(options.end, 'end');
  } else if (options.start) {
    start = parseDateInput(options.start, 'start');
    end = addDays(start, options.days - 1);
  } else if (options.end) {
    end = parseDateInput(options.end, 'end');
    start = addDays(end, 1 - options.days);
  } else {
    end = today;
    start = addDays(end, 1 - options.days);
  }

  if (start > end) {
    throw new Error('Resolved date range is invalid (start after end).');
  }

  return { start, end };
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const options = parseArgs();
  const db = getDb();
  const userIds = await resolveTargetUserIds(db, options.userIds);

  if (userIds.length === 0) {
    console.warn('[usage-backfill] No users with OpenAI keys found.');
    return;
  }

  const { start, end } = resolveDateRange(options);
  const totals: BackfillTotals = {
    processedUsers: 0,
    processedChunks: 0,
    processedKeys: 0,
    simulatedKeys: 0,
    failedKeys: 0,
    storedEvents: 0,
    updatedEvents: 0,
    windowsProcessed: 0,
    issues: 0,
    constraintInserts: 0,
    constraintUpdates: 0,
    manualFallbackInserts: 0,
    manualFallbackUpdates: 0,
    manualFallbackWindows: 0,
    manualFallbackKeys: 0,
  };
  let hadErrors = false;

  console.log('[usage-backfill] Starting backfill run', {
    userCount: userIds.length,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    chunkDays: options.chunkDays,
    runLabel: options.runLabel,
  });

  for (const userId of userIds) {
    totals.processedUsers += 1;
    let cursor = startOfDayUtc(start);
    const finalDay = startOfDayUtc(end);

    console.log('[usage-backfill] Processing user', {
      userId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    let remainingDays = Math.floor((finalDay.getTime() - cursor.getTime()) / MS_PER_DAY) + 1;
    let chunkIndex = 0;

    while (cursor <= finalDay) {
      const daysInChunk = Math.min(options.chunkDays, remainingDays);
      const chunkEndInclusive = addDays(cursor, daysInChunk - 1);
      const chunkLabel = `${options.runLabel}:${userId}:chunk-${chunkIndex}`;

      console.log('[usage-backfill] Processing chunk', {
        userId,
        chunkIndex,
        chunkStart: cursor.toISOString(),
        chunkEnd: chunkEndInclusive.toISOString(),
        days: daysInChunk,
        runLabel: chunkLabel,
      });

      try {
        const telemetry = await fetchAndStoreUsageForUser(userId, daysInChunk, {
          startDate: cursor,
          endDate: chunkEndInclusive,
          runLabel: chunkLabel,
        });

        totals.processedChunks += 1;
        totals.processedKeys += telemetry.processedKeys;
        totals.simulatedKeys += telemetry.simulatedKeys;
        totals.failedKeys += telemetry.failedKeys;
        totals.storedEvents += telemetry.storedEvents;
        totals.updatedEvents += telemetry.updatedEvents;
        totals.windowsProcessed += telemetry.windowsProcessed;
        totals.issues += telemetry.issues.length;
        totals.constraintInserts += telemetry.constraintInserts;
        totals.constraintUpdates += telemetry.constraintUpdates;
        totals.manualFallbackInserts += telemetry.manualFallbackInserts;
        totals.manualFallbackUpdates += telemetry.manualFallbackUpdates;
        totals.manualFallbackWindows += telemetry.manualFallbackWindows;
        totals.manualFallbackKeys += telemetry.manualFallbackKeys;

        console.log('[usage-backfill] Chunk complete', {
          userId,
          chunkIndex,
          chunkStart: cursor.toISOString(),
          chunkEnd: chunkEndInclusive.toISOString(),
          processedKeys: telemetry.processedKeys,
          windowsProcessed: telemetry.windowsProcessed,
          storedEvents: telemetry.storedEvents,
          updatedEvents: telemetry.updatedEvents,
          constraintInserts: telemetry.constraintInserts,
          constraintUpdates: telemetry.constraintUpdates,
          manualFallbackInserts: telemetry.manualFallbackInserts,
          manualFallbackUpdates: telemetry.manualFallbackUpdates,
          manualFallbackWindows: telemetry.manualFallbackWindows,
          manualFallbackKeys: telemetry.manualFallbackKeys,
          simulatedKeys: telemetry.simulatedKeys,
          failedKeys: telemetry.failedKeys,
          issues: telemetry.issues,
        });
      } catch (error) {
        hadErrors = true;
        console.error('[usage-backfill] Chunk failed', {
          userId,
          chunkIndex,
          chunkStart: cursor.toISOString(),
          chunkEnd: chunkEndInclusive.toISOString(),
          error: error instanceof Error ? error.message : error,
        });
      }

      remainingDays -= daysInChunk;
      cursor = addDays(chunkEndInclusive, 1);
      chunkIndex += 1;

      if (options.sleepMs > 0 && remainingDays > 0) {
        await sleep(options.sleepMs);
      }
    }
  }

  console.log('[usage-backfill] Backfill run completed', {
    totals,
    hadErrors,
  });

  if (hadErrors) {
    throw new Error('One or more chunks failed. Inspect logs before retrying.');
  }
}

run()
  .then(() => {
    exit(0);
  })
  .catch((error) => {
    console.error('[usage-backfill] Backfill run failed', {
      error: error instanceof Error ? error.message : error,
    });
    exit(1);
  });
