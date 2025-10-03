import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { and, gte, lte, isNotNull } from 'drizzle-orm';

import { usageEvents } from '../src/db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CliOptions = {
  csvPaths: string[];
  csvDir?: string;
  outputPath?: string;
  from?: string;
  to?: string;
  skipDb: boolean;
};

type CsvRow = Record<string, string>;

type MetricKey =
  | 'input_tokens'
  | 'output_tokens'
  | 'input_cached_tokens'
  | 'input_uncached_tokens'
  | 'input_text_tokens'
  | 'output_text_tokens'
  | 'input_cached_text_tokens'
  | 'input_audio_tokens'
  | 'input_cached_audio_tokens'
  | 'output_audio_tokens'
  | 'input_image_tokens'
  | 'input_cached_image_tokens'
  | 'output_image_tokens'
  | 'num_model_requests';

type MetricSnapshot = Record<MetricKey, number>;

type NormalizedKey = {
  windowStartIso: string;
  windowEndIso: string;
  projectId: string;
  apiKeyId: string;
  userId: string;
  model: string;
  serviceTier: string;
  batch: boolean;
};

type AggregatedRecord = NormalizedKey & {
  metrics: MetricSnapshot;
  csvSource?: string;
  recordCount: number;
};

type AggregatedMap = Map<string, AggregatedRecord>;

const metricColumns: MetricKey[] = [
  'input_tokens',
  'output_tokens',
  'input_cached_tokens',
  'input_uncached_tokens',
  'input_text_tokens',
  'output_text_tokens',
  'input_cached_text_tokens',
  'input_audio_tokens',
  'input_cached_audio_tokens',
  'output_audio_tokens',
  'input_image_tokens',
  'input_cached_image_tokens',
  'output_image_tokens',
  'num_model_requests',
];

const tolerance = 0.0001;

function parseArguments(argv: string[]): CliOptions {
  const options: CliOptions = {
    csvPaths: [],
    skipDb: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--csv':
        if (!argv[i + 1]) {
          throw new Error('Missing value for --csv');
        }
        options.csvPaths.push(resolveInput(argv[i + 1]));
        i += 1;
        break;
      case '--csv-dir':
        if (!argv[i + 1]) {
          throw new Error('Missing value for --csv-dir');
        }
        options.csvDir = resolveInput(argv[i + 1]);
        i += 1;
        break;
      case '--output':
        if (!argv[i + 1]) {
          throw new Error('Missing value for --output');
        }
        options.outputPath = resolveOutput(argv[i + 1]);
        i += 1;
        break;
      case '--from':
        if (!argv[i + 1]) {
          throw new Error('Missing value for --from');
        }
        options.from = argv[i + 1];
        i += 1;
        break;
      case '--to':
        if (!argv[i + 1]) {
          throw new Error('Missing value for --to');
        }
        options.to = argv[i + 1];
        i += 1;
        break;
      case '--skip-db':
        options.skipDb = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.csvDir) {
    const entries = fs.readdirSync(options.csvDir);
    const csvFiles = entries
      .filter((entry) => entry.toLowerCase().endsWith('.csv'))
      .map((entry) => path.join(options.csvDir!, entry));
    options.csvPaths.push(...csvFiles);
  }

  if (options.csvPaths.length === 0) {
    throw new Error('At least one CSV file must be provided via --csv or --csv-dir.');
  }

  return options;
}

function resolveInput(target: string): string {
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.join(process.cwd(), target);
}

function resolveOutput(target: string): string {
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.join(process.cwd(), target);
}

function printHelp() {
  console.log(`usage: tsx scripts/usage-telemetry-diff.ts --csv <file> [--csv <file> ...] [options]\n\n` +
    `Options:\n` +
    `  --csv <file>       Add a CSV export to compare. Can be repeated.\n` +
    `  --csv-dir <dir>    Load all CSV exports from the given directory.\n` +
    `  --from <iso>       Limit database comparison to windows >= timestamp.\n` +
    `  --to <iso>         Limit database comparison to windows <= timestamp.\n` +
    `  --output <file>    Write diff results to JSON. Default: print only.\n` +
    `  --skip-db          Skip database comparison (CSV metrics only).\n` +
    `  -h, --help         Show this help text.`);
}

function parseCsv(csvContent: string): CsvRow[] {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return [];
  }
  const header = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine.trim()) {
      continue;
    }
    const values = parseCsvLine(rawLine);
    if (values.length !== header.length) {
      throw new Error(`Row ${i + 1} column mismatch: expected ${header.length}, got ${values.length}`);
    }
    const entry: CsvRow = {};
    for (let col = 0; col < header.length; col += 1) {
      entry[header[col]] = values[col];
    }
    rows.push(entry);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

function normalizeBoolean(value: string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (!value) {
    return false;
  }
  return value.toString().trim().toLowerCase() === 'true';
}

function normalizeNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

function normalizeIso(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function buildKey(parts: NormalizedKey): string {
  return [
    parts.windowStartIso,
    parts.windowEndIso,
    parts.projectId || '',
    parts.apiKeyId || '',
    parts.userId || '',
    parts.model || '',
    parts.serviceTier || '',
    parts.batch ? '1' : '0',
  ].join('|');
}

function aggregateCsvRows(rows: CsvRow[], source: string): AggregatedMap {
  const map: AggregatedMap = new Map();

  for (const row of rows) {
    const keyParts: NormalizedKey = {
      windowStartIso: normalizeIso(row['start_time_iso']),
      windowEndIso: normalizeIso(row['end_time_iso']),
      projectId: row['project_id'] ?? '',
      apiKeyId: row['api_key_id'] ?? '',
      userId: row['user_id'] ?? '',
      model: row['model'] ?? '',
      serviceTier: row['service_tier'] ?? '',
      batch: normalizeBoolean(row['batch']),
    };
    const key = buildKey(keyParts);
    const existing = map.get(key);
    const metrics = existing?.metrics ?? createEmptyMetrics();
    for (const metric of metricColumns) {
      metrics[metric] += normalizeNumber(row[metric]);
    }
    map.set(key, {
      ...keyParts,
      metrics,
      csvSource: source,
      recordCount: (existing?.recordCount ?? 0) + 1,
    });
  }

  return map;
}

function createEmptyMetrics(): MetricSnapshot {
  return Object.fromEntries(metricColumns.map((metric) => [metric, 0])) as MetricSnapshot;
}

async function loadDatabaseAggregates(options: { from?: string; to?: string }): Promise<AggregatedMap> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to compare against database.');
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const whereClauses = [isNotNull(usageEvents.windowStart)];
  if (options.from) {
    whereClauses.push(gte(usageEvents.windowStart, new Date(options.from)));
  }
  if (options.to) {
    whereClauses.push(lte(usageEvents.windowStart, new Date(options.to)));
  }

  const where = whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses);

  const rows = await db.select({
    windowStart: usageEvents.windowStart,
    windowEnd: usageEvents.windowEnd,
    projectId: usageEvents.projectId,
    apiKeyId: usageEvents.openaiApiKeyId,
    userId: usageEvents.openaiUserId,
    model: usageEvents.model,
    serviceTier: usageEvents.serviceTier,
    batch: usageEvents.batch,
    tokensIn: usageEvents.tokensIn,
    tokensOut: usageEvents.tokensOut,
    inputCachedTokens: usageEvents.inputCachedTokens,
    inputUncachedTokens: usageEvents.inputUncachedTokens,
    inputTextTokens: usageEvents.inputTextTokens,
    outputTextTokens: usageEvents.outputTextTokens,
    inputCachedTextTokens: usageEvents.inputCachedTextTokens,
    inputAudioTokens: usageEvents.inputAudioTokens,
    inputCachedAudioTokens: usageEvents.inputCachedAudioTokens,
    outputAudioTokens: usageEvents.outputAudioTokens,
    inputImageTokens: usageEvents.inputImageTokens,
    inputCachedImageTokens: usageEvents.inputCachedImageTokens,
    outputImageTokens: usageEvents.outputImageTokens,
    numModelRequests: usageEvents.numModelRequests,
  }).where(where);

  const map: AggregatedMap = new Map();

  for (const row of rows) {
    const keyParts: NormalizedKey = {
      windowStartIso: normalizeIso(row.windowStart),
      windowEndIso: normalizeIso(row.windowEnd),
      projectId: row.projectId ?? '',
      apiKeyId: row.apiKeyId ?? '',
      userId: row.userId ?? '',
      model: row.model ?? '',
      serviceTier: row.serviceTier ?? '',
      batch: normalizeBoolean(row.batch),
    };
    const key = buildKey(keyParts);
    const existing = map.get(key);
    const metrics = existing?.metrics ?? createEmptyMetrics();
    metrics['input_tokens'] += normalizeNumber(row.tokensIn);
    metrics['output_tokens'] += normalizeNumber(row.tokensOut);
    metrics['input_cached_tokens'] += normalizeNumber(row.inputCachedTokens);
    metrics['input_uncached_tokens'] += normalizeNumber(row.inputUncachedTokens);
    metrics['input_text_tokens'] += normalizeNumber(row.inputTextTokens);
    metrics['output_text_tokens'] += normalizeNumber(row.outputTextTokens);
    metrics['input_cached_text_tokens'] += normalizeNumber(row.inputCachedTextTokens);
    metrics['input_audio_tokens'] += normalizeNumber(row.inputAudioTokens);
    metrics['input_cached_audio_tokens'] += normalizeNumber(row.inputCachedAudioTokens);
    metrics['output_audio_tokens'] += normalizeNumber(row.outputAudioTokens);
    metrics['input_image_tokens'] += normalizeNumber(row.inputImageTokens);
    metrics['input_cached_image_tokens'] += normalizeNumber(row.inputCachedImageTokens);
    metrics['output_image_tokens'] += normalizeNumber(row.outputImageTokens);
    metrics['num_model_requests'] += normalizeNumber(row.numModelRequests);
    map.set(key, {
      ...keyParts,
      metrics,
      recordCount: (existing?.recordCount ?? 0) + 1,
    });
  }

  return map;
}

type DiffEntry = {
  key: NormalizedKey;
  deltas: Partial<Record<MetricKey, number>>;
  csv?: AggregatedRecord;
  db?: AggregatedRecord;
};

type DiffResult = {
  mismatched: DiffEntry[];
  missingInDb: AggregatedRecord[];
  missingInCsv: AggregatedRecord[];
  totals: {
    csv: MetricSnapshot;
    db?: MetricSnapshot;
  };
  inspectedCsvFiles: string[];
};

function createEmptyTotals(): MetricSnapshot {
  return createEmptyMetrics();
}

function accumulateTotals(target: MetricSnapshot, source: MetricSnapshot) {
  for (const metric of metricColumns) {
    target[metric] += source[metric];
  }
}

function compareAggregates(csvAggregates: AggregatedMap, dbAggregates?: AggregatedMap): DiffResult {
  const result: DiffResult = {
    mismatched: [],
    missingInDb: [],
    missingInCsv: [],
    totals: {
      csv: createEmptyTotals(),
      db: dbAggregates ? createEmptyTotals() : undefined,
    },
    inspectedCsvFiles: Array.from(
      new Set(Array.from(csvAggregates.values()).map((entry) => entry.csvSource).filter(Boolean) as string[]),
    ),
  };

  for (const record of csvAggregates.values()) {
    accumulateTotals(result.totals.csv, record.metrics);
    const dbRecord = dbAggregates?.get(buildKey(record));
    if (!dbRecord) {
      result.missingInDb.push(record);
      continue;
    }
    if (result.totals.db) {
      accumulateTotals(result.totals.db, dbRecord.metrics);
    }
    const deltas: Partial<Record<MetricKey, number>> = {};
    for (const metric of metricColumns) {
      const delta = record.metrics[metric] - dbRecord.metrics[metric];
      if (Math.abs(delta) > tolerance) {
        deltas[metric] = Number(delta.toFixed(6));
      }
    }
    if (Object.keys(deltas).length > 0) {
      result.mismatched.push({
        key: {
          windowStartIso: record.windowStartIso,
          windowEndIso: record.windowEndIso,
          projectId: record.projectId,
          apiKeyId: record.apiKeyId,
          userId: record.userId,
          model: record.model,
          serviceTier: record.serviceTier,
          batch: record.batch,
        },
        deltas,
        csv: record,
        db: dbRecord,
      });
    }
  }

  if (dbAggregates) {
    for (const [key, record] of dbAggregates.entries()) {
      if (!csvAggregates.has(key)) {
        result.missingInCsv.push(record);
        if (result.totals.db) {
          accumulateTotals(result.totals.db, record.metrics);
        }
      }
    }
  }

  return result;
}

async function main() {
  try {
    const options = parseArguments(process.argv);

    const csvAggregates: AggregatedMap = new Map();
    for (const csvPath of options.csvPaths) {
      const content = fs.readFileSync(csvPath, 'utf8');
      const rows = parseCsv(content);
      const aggregates = aggregateCsvRows(rows, path.relative(process.cwd(), csvPath));
      for (const [key, record] of aggregates.entries()) {
        const existing = csvAggregates.get(key);
        if (existing) {
          for (const metric of metricColumns) {
            existing.metrics[metric] += record.metrics[metric];
          }
          existing.recordCount += record.recordCount;
        } else {
          csvAggregates.set(key, record);
        }
      }
    }

    let dbAggregates: AggregatedMap | undefined;
    if (!options.skipDb) {
      try {
        dbAggregates = await loadDatabaseAggregates({ from: options.from, to: options.to });
      } catch (err) {
        console.warn('[usage-telemetry-diff] Skipping DB comparison:', (err as Error).message);
        options.skipDb = true;
      }
    }

    const diff = compareAggregates(csvAggregates, dbAggregates);

    if (options.outputPath) {
      const output = JSON.stringify(diff, null, 2);
      fs.writeFileSync(options.outputPath, output, 'utf8');
      console.log(`Diff written to ${options.outputPath}`);
    }

    console.log('Inspected CSV files:', diff.inspectedCsvFiles.join(', ') || '(none)');
    console.log(`Missing in DB: ${diff.missingInDb.length}`);
    console.log(`Missing in CSV: ${diff.missingInCsv.length}`);
    console.log(`Mismatched rows: ${diff.mismatched.length}`);

    if (diff.mismatched.length > 0) {
      console.log('Sample mismatch:', JSON.stringify(diff.mismatched[0], null, 2));
    }
  } catch (error) {
    console.error('[usage-telemetry-diff] Error:', (error as Error).message);
    process.exitCode = 1;
  }
}

await main();
