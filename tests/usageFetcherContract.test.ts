import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  loadDailyUsageFixturesFromDirectory,
  normalizeFixtureEvents,
} from './helpers/dailyUsageFixture';
import {
  assert,
  assertNonNegativeTokenCounts,
  assertNoMissingAdminMetadata,
  assertWindowDurations,
  ensureMonotonicWindows,
  summarizeWindowBuckets,
  computeAggregatedTotals,
  assertNoDuplicateWindows,
} from './helpers/dailyUsageAssertions';
import { diffAggregatedTotals, loadExpectedTotalsFile, type ExpectedTotalsFile } from './helpers/expectedTotals';

const fixturesReady = process.env.DAILY_USAGE_CONTRACT_FIXTURES_READY === 'true';
const fixturesDirEnv = process.env.DAILY_USAGE_CONTRACT_FIXTURES_DIR;
const expectedTotalsDirEnv = process.env.DAILY_USAGE_CONTRACT_EXPECTED_TOTALS_DIR;
const expectedToleranceEnv = process.env.DAILY_USAGE_CONTRACT_EXPECTED_TOLERANCE;

async function main() {
  if (!fixturesReady) {
    console.warn(
      '[usageFetcherContractTest] Skipping daily usage contract tests – populate fixtures under audit/golden-fixtures/daily-usage/ and rerun with DAILY_USAGE_CONTRACT_FIXTURES_READY=true.'
    );
    return;
  }

  const fixturesDirectory = fixturesDirEnv
    ? path.resolve(fixturesDirEnv)
    : path.resolve(__dirname, '../audit/golden-fixtures/daily-usage');
  const expectedTotalsDirectory = expectedTotalsDirEnv
    ? path.resolve(expectedTotalsDirEnv)
    : path.resolve(__dirname, '../audit/golden-fixtures/expected-totals');
  const expectedTolerance = normalizeTolerance(expectedToleranceEnv);

  const fixtures = await loadDailyUsageFixturesFromDirectory(fixturesDirectory);
  if (fixtures.length === 0) {
    throw new Error(
      `[usageFetcherContractTest] No fixtures found in ${fixturesDirectory}. Follow audit/golden-fixtures/README.md before enabling contract tests.`
    );
  }

  for (const fixture of fixtures) {
    const events = normalizeFixtureEvents(fixture);
    assert(Array.isArray(events), `Fixture ${fixture.filePath} did not normalize to events array`);
    assert(events.length > 0, `Fixture ${fixture.filePath} produced zero usage events`);

    assertNonNegativeTokenCounts(events);
    assertWindowDurations(events);
    ensureMonotonicWindows(events);
    assertNoMissingAdminMetadata(events);

    const summaries = summarizeWindowBuckets(events);
    if (summaries.length === 0) {
      throw new Error(`[usageFetcherContractTest] No bucket summaries generated for ${fixture.filePath}`);
    }
    assertNoDuplicateWindows(summaries);

    const aggregated = computeAggregatedTotals(events, summaries);

    const expectedTotals = await loadExpectedTotalsForFixture(expectedTotalsDirectory, fixture.filePath);
    if (expectedTotals) {
      const mismatches = diffAggregatedTotals(aggregated, expectedTotals, fixture.filePath, expectedTolerance);
      if (mismatches.length > 0) {
        const message = mismatches.map((item) => ` - ${item}`).join('\n');
        throw new Error(
          `[usageFetcherContractTest] Expected totals mismatch for ${path.resolve(fixture.filePath)}:\n${message}`
        );
      }
    }
  }

  /**
   * Remaining assertions to implement once fixtures are committed:
   * - Ensure dedupe invariants hold (no duplicate `(key, model, window)` rows after normalization).
   * - Validate cached token vs uncached token splits per fixture scenario (cached-heavy vs uncached-heavy tenant).
   * - Confirm pricing fallback telemetry aligns with zero-cost buckets.
   */
  // TODO(codex): Implement contract replay assertions.
  throw new Error(
    'Daily usage contract tests are not yet implemented. See memorybank/daily_usage_alignment_plan.md Workstream 3.'
  );
}

main()
  .then(() => {
    if (fixturesReady) {
      console.log('[usageFetcherContractTest] Contract test scaffolding executed');
    }
  })
  .catch((error) => {
    console.error('[usageFetcherContractTest] Failed', error);
    process.exitCode = 1;
  });

export const usageFetcherContractTestsInitialized = fixturesReady;

function normalizeTolerance(raw: string | undefined): number {
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) {
    console.warn('[usageFetcherContractTest] Ignoring invalid expected totals tolerance value', raw);
    return 0;
  }
  return value;
}

const missingExpectedDirs = new Set<string>();

async function loadExpectedTotalsForFixture(
  directory: string,
  fixturePath: string
): Promise<ExpectedTotalsFile | null> {
  try {
    await fs.stat(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      if (!missingExpectedDirs.has(directory)) {
        console.warn('[usageFetcherContractTest] Expected totals directory not found', directory);
        missingExpectedDirs.add(directory);
      }
      return null;
    }
    throw error;
  }

  const baseName = path.basename(fixturePath);
  const stem = baseName.replace(/\.json$/i, '');
  const candidates = Array.from(
    new Set([
      path.join(directory, baseName),
      path.join(directory, `${baseName}.expected.json`),
      path.join(directory, `${stem}.json`),
      path.join(directory, `${stem}.expected.json`),
    ])
  );

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    try {
      return await loadExpectedTotalsFile(candidate);
    } catch (error) {
      console.warn('[usageFetcherContractTest] Failed to parse expected totals file', candidate, error);
      throw error;
    }
  }

  return null;
}
