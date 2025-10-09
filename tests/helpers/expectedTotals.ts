import fs from 'node:fs/promises';
import path from 'node:path';

import type { AggregatedTotals } from './dailyUsageAssertions';

export interface ExpectedTotalsFile {
  fixture?: string;
  expected: Partial<AggregatedTotals> & { models?: string[] };
}

export async function loadExpectedTotalsFile(filePath: string): Promise<ExpectedTotalsFile> {
  const absolute = path.resolve(filePath);
  const raw = await fs.readFile(absolute, 'utf8');
  const parsed = JSON.parse(raw) as ExpectedTotalsFile;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.expected !== 'object') {
    throw new Error(`[expectedTotals] Invalid file format: ${absolute}`);
  }
  return parsed;
}

export function diffAggregatedTotals(
  actual: AggregatedTotals,
  expectedFile: ExpectedTotalsFile,
  fixturePath: string,
  tolerance: number
): string[] {
  const mismatches: string[] = [];
  const normalizedFixturePath = path.resolve(fixturePath);
  if (expectedFile.fixture) {
    const expectedFixturePath = path.resolve(expectedFile.fixture);
    if (expectedFixturePath !== normalizedFixturePath) {
      mismatches.push(
        `fixture path mismatch (expected ${expectedFixturePath}, got ${normalizedFixturePath})`
      );
    }
  }

  const expected = expectedFile.expected ?? {};
  const numericKeys: Array<keyof AggregatedTotals> = [
    'eventCount',
    'windowCount',
    'totalTokensIn',
    'totalTokensOut',
    'distinctProjects',
    'distinctKeys',
    'distinctUsers',
  ];

  for (const key of numericKeys) {
    const expectedValue = expected[key];
    if (expectedValue === undefined) continue;
    const actualValue = Number(actual[key]);
    if (Number.isNaN(actualValue)) {
      mismatches.push(`missing numeric value for ${String(key)}`);
      continue;
    }
    const diff = Math.abs(actualValue - Number(expectedValue));
    if (diff > tolerance) {
      mismatches.push(
        `${String(key)} mismatch (expected ${expectedValue}, got ${actualValue}, diff ${diff} > tolerance ${tolerance})`
      );
    }
  }

  if (expected.models) {
    const actualModels = new Set(actual.models ?? []);
    const expectedModels = new Set(expected.models);
    for (const model of expectedModels) {
      if (!actualModels.has(model)) {
        mismatches.push(`missing model: ${model}`);
      }
    }
    for (const model of actualModels) {
      if (!expectedModels.has(model)) {
        mismatches.push(`unexpected model: ${model}`);
      }
    }
  }

  return mismatches;
}
