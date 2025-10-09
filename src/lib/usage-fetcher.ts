import { decrypt } from './encryption';
import { getDb } from './database';
import { providerKeys, usageEvents } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

type OpenAIUsageMode = 'standard' | 'admin';

interface OpenAIStandardUsageItem {
  aggregation_timestamp: number;
  operation: string;
  n_context_tokens_total: number;
  n_generated_tokens_total: number;
}

interface OpenAIStandardUsageResponse {
  data: OpenAIStandardUsageItem[];
}

interface OpenAIAdminResultItem {
  name?: string;
  cost?: number;
  amount?: number;
  project_id?: string;
  api_key_id?: string;
  user_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  num_model_requests?: number;
  service_tier?: string;
  batch?: boolean;
  input_cached_tokens?: number;
  input_uncached_tokens?: number;
  input_text_tokens?: number;
  output_text_tokens?: number;
  input_cached_text_tokens?: number;
  input_audio_tokens?: number;
  input_cached_audio_tokens?: number;
  output_audio_tokens?: number;
  input_image_tokens?: number;
  input_cached_image_tokens?: number;
  output_image_tokens?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_cost?: number;
  } | null;
}

interface OpenAIAdminUsageRecord {
  start_time?: number;
  start_time_iso?: string;
  end_time?: number;
  end_time_iso?: string;
  project_id?: string;
  api_key_id?: string;
  user_id?: string;
  service_tier?: string;
  batch?: boolean;
  num_model_requests?: number;
  results?: OpenAIAdminResultItem[];
}

interface OpenAIAdminUsageResponse {
  data?: OpenAIAdminUsageRecord[];
  daily_costs?: Array<{
    timestamp?: number;
    line_items?: OpenAIAdminResultItem[];
  }>;
  has_more?: boolean;
  next_page?: string;
}

export interface UsageEventData {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
  timestamp: Date;
  pricingKey?: string;
  pricingFallback?: boolean;
  windowStart?: Date;
  windowEnd?: Date;
  projectId?: string;
  openaiUserId?: string;
  openaiApiKeyId?: string;
  serviceTier?: string;
  batch?: boolean;
  numModelRequests?: number;
  inputCachedTokens?: number;
  inputUncachedTokens?: number;
  inputTextTokens?: number;
  outputTextTokens?: number;
  inputCachedTextTokens?: number;
  inputAudioTokens?: number;
  inputCachedAudioTokens?: number;
  outputAudioTokens?: number;
  inputImageTokens?: number;
  inputCachedImageTokens?: number;
  outputImageTokens?: number;
}

interface UsageWindow {
  start: Date;
  end: Date;
}

type FailureMarkedError = Error & { _usageFailureCounted?: boolean };

function markUsageFailureAsCounted(error: unknown): Error {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  (normalizedError as FailureMarkedError)._usageFailureCounted = true;
  return normalizedError;
}

type DateInput = Date | string | number;

export interface FetchUsageOptions {
  startDate?: DateInput;
  endDate?: DateInput;
  runLabel?: string;
}

function parseDateInput(value?: DateInput): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('[usage-fetcher] Invalid usage ingestion date input');
  }

  return parsed;
}

export interface IngestionIssue {
  keyId: number;
  message: string;
  code?: string;
  status?: number;
}

export interface IngestionTelemetry {
  userId: string;
  processedKeys: number;
  simulatedKeys: number;
  failedKeys: number;
  storedEvents: number;
  skippedEvents: number;
  updatedEvents: number;
  windowsProcessed: number;
  constraintInserts: number;
  constraintUpdates: number;
  manualFallbackInserts: number;
  manualFallbackUpdates: number;
  manualFallbackWindows: number;
  manualFallbackKeys: number;
  issues: IngestionIssue[];
}

const OPENAI_USAGE_MODE = (process.env.OPENAI_USAGE_MODE ?? 'standard').toLowerCase() as OpenAIUsageMode;
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION ?? process.env.OPENAI_ORG_ID ?? undefined;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT ?? process.env.OPENAI_PROJECT_ID ?? undefined;
function asFiniteNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const OPENAI_ADMIN_LIMIT = Math.max(1, Math.min(asFiniteNumber(process.env.OPENAI_ADMIN_LIMIT, 31), 31));
const ENABLE_SIMULATED_USAGE = (process.env.ENABLE_SIMULATED_USAGE ?? 'false').toLowerCase() === 'true';
const ADMIN_REQUESTS_PER_MINUTE = Math.max(
  1,
  Math.min(asFiniteNumber(process.env.OPENAI_ADMIN_REQUESTS_PER_MINUTE, 50), 60)
);
const ADMIN_MAX_BURST = Math.max(1, asFiniteNumber(process.env.OPENAI_ADMIN_MAX_BURST, 10));
const ADMIN_THROTTLE_WINDOW_SECONDS = 60;
const ADMIN_THROTTLE_TIMEOUT_MS = Math.max(
  1000,
  asFiniteNumber(process.env.OPENAI_ADMIN_THROTTLE_TIMEOUT_MS, 60000)
);
const ENABLE_DAILY_USAGE_WINDOWS =
  (process.env.ENABLE_DAILY_USAGE_WINDOWS ?? 'false').toLowerCase() === 'true';
const ENABLE_USAGE_ADMIN_CONSTRAINT_UPSERT =
  (process.env.ENABLE_USAGE_ADMIN_CONSTRAINT_UPSERT ?? 'false').toLowerCase() === 'true';

const REQUIRED_USAGE_WINDOW_COLUMNS = [
  'window_start',
  'window_end',
  'project_id',
  'openai_api_key_id',
  'openai_user_id',
  'service_tier',
  'batch',
  'num_model_requests',
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
];

let usageWindowSchemaCheck: Promise<void> | null = null;

type TokenPricing = {
  input: number;
  output: number;
};

const DEFAULT_PRICING_KEY = 'gpt-3.5-turbo';

// OpenAI pricing per 1K tokens (defaults; override via OPENAI_PRICING_OVERRIDES)
const OPENAI_PRICING: Record<string, TokenPricing> = {
  'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-5': { input: 0.015, output: 0.06 },
  'gpt-5-cached_input': { input: 0.003, output: 0 },
  'gpt-5-cached_output': { input: 0, output: 0.02 },
  'gpt-5-2025-08-07': { input: 0.015, output: 0.06 },
  'gpt-5-2025-08-07-cached_input': { input: 0.003, output: 0 },
  'gpt-5-2025-08-07-cached_output': { input: 0, output: 0.02 },
};

const PRICING_FALLBACK_RULES: Array<{ test: (model: string) => boolean; key: string }> = [
  { test: (model) => /^gpt-5.*cached[_-]?input/.test(model), key: 'gpt-5-cached_input' },
  { test: (model) => /^gpt-5.*cached[_-]?output/.test(model), key: 'gpt-5-cached_output' },
  { test: (model) => /^gpt-5/.test(model), key: 'gpt-5' },
  { test: (model) => /^gpt-4o.*mini/.test(model), key: 'gpt-4o-mini' },
  { test: (model) => /^gpt-4o/.test(model), key: 'gpt-4o' },
  { test: (model) => /^gpt-4.*turbo/.test(model), key: 'gpt-4-turbo' },
  { test: (model) => /^gpt-4/.test(model), key: 'gpt-4' },
];

const pricingOverrideEnv = process.env.OPENAI_PRICING_OVERRIDES;
let PRICING_OVERRIDES: Record<string, TokenPricing> = {};
if (pricingOverrideEnv) {
  try {
    PRICING_OVERRIDES = JSON.parse(pricingOverrideEnv);
  } catch (error) {
    console.error('[usage-fetcher] Failed to parse OPENAI_PRICING_OVERRIDES', error);
  }
}

const PRICING_FALLBACK_WARNINGS = new Set<string>();
let adminThrottleQueue: Promise<void> = Promise.resolve();
let adminTokens = ADMIN_MAX_BURST;
let adminLastRefill = Date.now();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const USAGE_ADMIN_BUCKET_CONSTRAINT_NAME = 'usage_admin_bucket_idx' as const;
const CONSTRAINT_MISSING_SQLSTATE_CODES = new Set(['42P10', '42704', '42703']);

type UsageEventInsert = typeof usageEvents.$inferInsert;

const usageAdminBucketConstraint = ENABLE_DAILY_USAGE_WINDOWS && ENABLE_USAGE_ADMIN_CONSTRAINT_UPSERT
  ? ([
      usageEvents.keyId,
      usageEvents.model,
      usageEvents.windowStart,
      usageEvents.windowEnd,
      sql`COALESCE(${usageEvents.projectId}, '')`,
      sql`COALESCE(${usageEvents.openaiApiKeyId}, '')`,
      sql`COALESCE(${usageEvents.openaiUserId}, '')`,
      sql`COALESCE(${usageEvents.serviceTier}, '')`,
      sql`COALESCE(${usageEvents.batch}, false)`,
    ] as const)
  : undefined;

const usageAdminBucketConstraintUsable = Array.isArray(usageAdminBucketConstraint);

let loggedMissingUsageConstraint = false;

function isUsageConstraintMissingError(error: unknown): error is { code?: string } {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && CONSTRAINT_MISSING_SQLSTATE_CODES.has(code);
}

function logMissingUsageConstraintOnce(reason: 'metadata-missing' | 'constraint-missing', error?: unknown) {
  if (loggedMissingUsageConstraint) {
    return;
  }

  const details: Record<string, unknown> = { reason };
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeMessage === 'string') {
      details.message = maybeMessage;
    }
    if (typeof maybeCode === 'string') {
      details.code = maybeCode;
    }
  }

  console.warn(
    `[usage-fetcher] ${USAGE_ADMIN_BUCKET_CONSTRAINT_NAME} missing; using manual dedupe fallback`,
    details
  );
  loggedMissingUsageConstraint = true;
}

type UpsertPersistenceMode = 'constraint' | 'manual-fallback';

type UsageUpsertResult = {
  status: 'inserted' | 'updated';
  mode: UpsertPersistenceMode;
};

const usageEventColumnsForUpdate = [
  'tokensIn',
  'tokensOut',
  'costEstimate',
  'timestamp',
  'windowEnd',
  'projectId',
  'openaiUserId',
  'openaiApiKeyId',
  'serviceTier',
  'batch',
  'numModelRequests',
  'inputCachedTokens',
  'inputUncachedTokens',
  'inputTextTokens',
  'outputTextTokens',
  'inputCachedTextTokens',
  'inputAudioTokens',
  'inputCachedAudioTokens',
  'outputAudioTokens',
  'inputImageTokens',
  'inputCachedImageTokens',
  'outputImageTokens',
] as const satisfies readonly (keyof UsageEventInsert)[];

type UpdatableUsageEventColumn = (typeof usageEventColumnsForUpdate)[number];
type UsageEventUpdatePayload = Partial<Pick<UsageEventInsert, UpdatableUsageEventColumn>>;

function toNullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function deriveWindowBounds(usage: UsageEventData): { windowStart: Date; windowEnd: Date } {
  const windowStart = usage.windowStart ?? startOfDayUtc(usage.timestamp);
  const windowEnd = usage.windowEnd ?? addDays(windowStart, 1);
  return { windowStart, windowEnd };
}

function buildUsageEventInsertPayload(
  keyId: number,
  usage: UsageEventData
): UsageEventInsert {
  const { windowStart, windowEnd } = deriveWindowBounds(usage);
  const costEstimateNumber =
    typeof usage.costEstimate === 'number' ? usage.costEstimate : Number(usage.costEstimate ?? 0);
  const costEstimate = Number.isFinite(costEstimateNumber) ? costEstimateNumber : 0;

  return {
    keyId,
    model: usage.model,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    costEstimate: costEstimate.toFixed(6),
    timestamp: usage.timestamp,
    windowStart,
    windowEnd,
    projectId: toNullable(usage.projectId),
    openaiUserId: toNullable(usage.openaiUserId),
    openaiApiKeyId: toNullable(usage.openaiApiKeyId),
    serviceTier: toNullable(usage.serviceTier),
    batch: toNullable(usage.batch),
    numModelRequests: toNullable(usage.numModelRequests),
    inputCachedTokens: toNullable(usage.inputCachedTokens),
    inputUncachedTokens: toNullable(usage.inputUncachedTokens),
    inputTextTokens: toNullable(usage.inputTextTokens),
    outputTextTokens: toNullable(usage.outputTextTokens),
    inputCachedTextTokens: toNullable(usage.inputCachedTextTokens),
    inputAudioTokens: toNullable(usage.inputAudioTokens),
    inputCachedAudioTokens: toNullable(usage.inputCachedAudioTokens),
    outputAudioTokens: toNullable(usage.outputAudioTokens),
    inputImageTokens: toNullable(usage.inputImageTokens),
    inputCachedImageTokens: toNullable(usage.inputCachedImageTokens),
    outputImageTokens: toNullable(usage.outputImageTokens),
  } satisfies UsageEventInsert;
}

function buildUsageEventMatchClause(payload: UsageEventInsert) {
  if (!payload.windowStart || !payload.windowEnd) {
    throw new Error('[usage-fetcher] Manual dedupe fallback requires window boundaries.');
  }

  const windowStart = payload.windowStart;
  const windowEnd = payload.windowEnd;
  const normalizedProjectId = payload.projectId ?? '';
  const normalizedApiKeyId = payload.openaiApiKeyId ?? '';
  const normalizedUserId = payload.openaiUserId ?? '';
  const normalizedServiceTier = payload.serviceTier ?? '';
  const normalizedBatch = payload.batch ?? false;

  // The uniqueness contract deliberately excludes token counts so refreshed
  // exports can update an existing window instead of inserting duplicates.
  return and(
    eq(usageEvents.keyId, payload.keyId),
    eq(usageEvents.model, payload.model),
    eq(usageEvents.windowStart, windowStart),
    eq(usageEvents.windowEnd, windowEnd),
    sql`COALESCE(${usageEvents.projectId}, '') = ${normalizedProjectId}`,
    sql`COALESCE(${usageEvents.openaiApiKeyId}, '') = ${normalizedApiKeyId}`,
    sql`COALESCE(${usageEvents.openaiUserId}, '') = ${normalizedUserId}`,
    sql`COALESCE(${usageEvents.serviceTier}, '') = ${normalizedServiceTier}`,
    sql`COALESCE(${usageEvents.batch}, false) = ${normalizedBatch}`
  );
}

async function upsertUsageEventWithManualDedupe(
  db: ReturnType<typeof getDb>,
  payload: UsageEventInsert,
  updatePayload: UsageEventUpdatePayload
): Promise<UsageUpsertResult> {
  const manualInsertBuilder = db.insert(usageEvents).values(payload);

  const [existing] = await db
    .select({ id: usageEvents.id })
    .from(usageEvents)
    .where(buildUsageEventMatchClause(payload))
    .limit(1);

  if (!existing) {
    const manualInsertQuery = (manualInsertBuilder as unknown as {
      returning: (...args: any[]) => Promise<Array<{ inserted: boolean }>>;
    }).returning({ inserted: sql<boolean>`(xmax = 0)` });
    const [result] = await (manualInsertQuery as unknown as Promise<Array<{ inserted: boolean }>>);

    return {
      status: result?.inserted ? 'inserted' : 'updated',
      mode: 'manual-fallback',
    };
  }

  const hasUpdates = usageEventColumnsForUpdate.some((key) => key in updatePayload);
  if (!hasUpdates) {
    return {
      status: 'updated',
      mode: 'manual-fallback',
    };
  }

  await db
    .update(usageEvents)
    .set(updatePayload)
    .where(eq(usageEvents.id, existing.id));

  return {
    status: 'updated',
    mode: 'manual-fallback',
  };
}

async function upsertUsageEvent(
  db: ReturnType<typeof getDb>,
  payload: UsageEventInsert
): Promise<UsageUpsertResult> {
  const updatePayload = Object.fromEntries(
    usageEventColumnsForUpdate.flatMap((key) => {
      const value = payload[key];
      return value === undefined ? [] : ([[key, value]] as const);
    })
  ) as UsageEventUpdatePayload;

  if (usageAdminBucketConstraintUsable && usageAdminBucketConstraint) {
    try {
      const upsertQuery = (db
        .insert(usageEvents)
        .values(payload)
        .onConflictDoUpdate({
          target: usageAdminBucketConstraint,
          set: updatePayload,
        }) as unknown as {
        returning: (...args: any[]) => Promise<Array<{ inserted: boolean }>>;
      }).returning({ inserted: sql<boolean>`(xmax = 0)` });
      const [result] = await (upsertQuery as unknown as Promise<Array<{ inserted: boolean }>>);

      return {
        status: result?.inserted ? 'inserted' : 'updated',
        mode: 'constraint',
      };
    } catch (error) {
      if (!isUsageConstraintMissingError(error)) {
        throw error;
      }

      logMissingUsageConstraintOnce('constraint-missing', error);
    }
  } else {
    logMissingUsageConstraintOnce('metadata-missing');
  }

  return upsertUsageEventWithManualDedupe(db, payload, updatePayload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function refillAdminTokens(): void {
  const now = Date.now();
  const elapsedSeconds = (now - adminLastRefill) / 1000;
  if (elapsedSeconds <= 0) return;
  const tokensToAdd = elapsedSeconds * (ADMIN_REQUESTS_PER_MINUTE / ADMIN_THROTTLE_WINDOW_SECONDS);
  if (tokensToAdd > 0) {
    adminTokens = Math.min(ADMIN_MAX_BURST, adminTokens + tokensToAdd);
    adminLastRefill = now;
  }
}

async function acquireAdminToken(): Promise<void> {
  if (ADMIN_REQUESTS_PER_MINUTE <= 0) return;
  const start = Date.now();
  while (true) {
    refillAdminTokens();
    if (adminTokens >= 1) {
      adminTokens -= 1;
      return;
    }
    const now = Date.now();
    const elapsed = now - start;
    if (elapsed > ADMIN_THROTTLE_TIMEOUT_MS) {
      throw new Error('Admin throttle timed out while waiting for token');
    }
    const tokensNeeded = Math.max(0, 1 - adminTokens);
    const refillRatePerMs = ADMIN_REQUESTS_PER_MINUTE / (ADMIN_THROTTLE_WINDOW_SECONDS * 1000);
    const timeUntilNextTokenMs = tokensNeeded > 0 ? Math.ceil(tokensNeeded / refillRatePerMs) : 1;
    const remainingTimeoutMs = Math.max(1, ADMIN_THROTTLE_TIMEOUT_MS - elapsed);
    await sleep(Math.min(timeUntilNextTokenMs, remainingTimeoutMs));
  }
}

function throttleAdminRequest(): Promise<void> {
  adminThrottleQueue = adminThrottleQueue
    .catch(() => undefined)
    .then(() => acquireAdminToken());
  return adminThrottleQueue;
}

interface UsageModeConfiguration {
  mode: OpenAIUsageMode;
  organizationId?: string;
  projectId?: string;
}

const DEFAULT_USAGE_CONFIGURATION: UsageModeConfiguration = OPENAI_USAGE_MODE === 'admin'
  ? {
      mode: 'admin',
      organizationId: OPENAI_ORGANIZATION,
      projectId: OPENAI_PROJECT,
    }
  : { mode: 'standard' };

class OpenAIUsageError extends Error {
  constructor(message: string, public readonly code: 'UNAUTHORIZED' | 'SCOPE_MISSING' | 'PROVIDER_ERROR') {
    super(message);
    this.name = 'OpenAIUsageError';
  }
}

class UsageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageConfigurationError';
  }
}

class UsageSchemaError extends Error {
  constructor(message: string, public readonly missingColumns: string[] = []) {
    super(message);
    this.name = 'UsageSchemaError';
  }
}

function validateUsageConfiguration(config: UsageModeConfiguration): void {
  if (config.mode === 'admin') {
    if (!config.organizationId || !config.projectId) {
      throw new UsageConfigurationError(
        'Admin usage mode requires both organization and project identifiers.'
      );
    }
  }
}

async function ensureUsageWindowSchema(db: ReturnType<typeof getDb>): Promise<void> {
  if (!ENABLE_DAILY_USAGE_WINDOWS) {
    return;
  }

  if (!usageWindowSchemaCheck) {
    usageWindowSchemaCheck = (async () => {
      const columnResult = await db.execute<{ column_name: string }>(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'usage_events'
      `);

      const presentColumns = new Set(
        (columnResult.rows ?? []).map((row) => row.column_name)
      );

      const missingColumns = REQUIRED_USAGE_WINDOW_COLUMNS.filter(
        (column) => !presentColumns.has(column)
      );

      if (missingColumns.length > 0) {
        throw new UsageSchemaError(
          `usage_events missing columns required for daily usage windows: ${missingColumns.join(', ')}`,
          missingColumns
        );
      }
    })();
  }

  try {
    await usageWindowSchemaCheck;
  } catch (error) {
    usageWindowSchemaCheck = null;
    if (error instanceof UsageSchemaError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : String(error);

    throw new UsageSchemaError(
      `Failed to verify usage_events schema for daily usage windows: ${message}`
    );
  }
}

type NextPageValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: 'parse-error' | 'unexpected-host' | 'unexpected-path'; resolved?: string };

function sanitizeAdminNextPageUrl(current: URL, nextPage: string): NextPageValidationResult {
  const trimmed = nextPage?.trim?.() ?? '';
  if (!trimmed) {
    return { ok: false, reason: 'parse-error', resolved: 'empty' };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, reason: 'parse-error', resolved: 'whitespace' };
  }
  try {
    const candidate = new URL(trimmed, current);
    const allowedHost = 'api.openai.com';
    if (candidate.protocol !== 'https:' || candidate.hostname !== allowedHost) {
      return { ok: false, reason: 'unexpected-host', resolved: candidate.toString() };
    }
    if (!candidate.pathname.startsWith('/v1/organization/')) {
      return { ok: false, reason: 'unexpected-path', resolved: candidate.pathname };
    }
    return {
      ok: true,
      url: new URL(`${candidate.pathname}${candidate.search}`, `https://${allowedHost}`),
    };
  } catch (error) {
    return { ok: false, reason: 'parse-error', resolved: error instanceof Error ? error.message : String(error) };
  }
}

function resolvePricing(model: string): { pricing: TokenPricing; key: string; fallback: boolean } {
  if (PRICING_OVERRIDES[model]) {
    return { pricing: PRICING_OVERRIDES[model], key: model, fallback: false };
  }

  if (OPENAI_PRICING[model]) {
    return { pricing: OPENAI_PRICING[model], key: model, fallback: false };
  }

  for (const rule of PRICING_FALLBACK_RULES) {
    if (rule.test(model)) {
      const key = rule.key;
      const pricing = PRICING_OVERRIDES[key] ?? OPENAI_PRICING[key];
      if (pricing) {
        return { pricing, key, fallback: true };
      }
    }
  }

  const defaultPricing = PRICING_OVERRIDES[DEFAULT_PRICING_KEY] ?? OPENAI_PRICING[DEFAULT_PRICING_KEY];
  return { pricing: defaultPricing, key: DEFAULT_PRICING_KEY, fallback: true };
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): { amount: number; pricingKey: string; fallback: boolean } {
  const { pricing, key, fallback } = resolvePricing(model);
  if (fallback && !PRICING_FALLBACK_WARNINGS.has(model)) {
    PRICING_FALLBACK_WARNINGS.add(model);
    console.warn('[usage-fetcher] Pricing fallback applied', { model, resolvedKey: key });
  }
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return {
    amount: inputCost + outputCost,
    pricingKey: key,
    fallback,
  };
}

function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function decryptKeyMetadata(record: typeof providerKeys.$inferSelect): { organizationId?: string; projectId?: string } {
  if (!record.encryptedMetadata || !record.metadataIv || !record.metadataAuthTag) {
    return {};
  }

  try {
    const decrypted = decrypt({
      encryptedText: record.encryptedMetadata,
      iv: record.metadataIv,
      authTag: record.metadataAuthTag,
    });
    const parsed = JSON.parse(decrypted);
    return {
      organizationId: typeof parsed.organizationId === 'string' ? parsed.organizationId : undefined,
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : undefined,
    };
  } catch (error) {
    console.error('[usage-fetcher] Failed to decrypt provider metadata', {
      keyId: record.id,
      error: error instanceof Error ? error.message : error,
    });
    return {};
  }
}

function deriveUsageConfigurationForKey(record: typeof providerKeys.$inferSelect): UsageModeConfiguration {
  const mode = (record.usageMode ?? DEFAULT_USAGE_CONFIGURATION.mode) as OpenAIUsageMode;

  if (mode === 'admin') {
    const metadata = decryptKeyMetadata(record);
    const organizationId = metadata.organizationId ?? DEFAULT_USAGE_CONFIGURATION.organizationId;
    const projectId = metadata.projectId ?? DEFAULT_USAGE_CONFIGURATION.projectId;
    return { mode, organizationId, projectId };
  }

  return { mode: 'standard' };
}

function asDate(epochSeconds?: number, fallback?: Date): Date {
  if (!epochSeconds || !Number.isFinite(epochSeconds)) {
    return fallback ? new Date(fallback) : new Date();
  }
  const millis = epochSeconds < 1e12 ? epochSeconds * 1000 : epochSeconds;
  return new Date(millis);
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function buildDailyWindows(startDate: Date, endDate: Date): UsageWindow[] {
  if (startDate > endDate) {
    return [];
  }

  const windows: UsageWindow[] = [];
  let cursor = startOfDayUtc(startDate);
  const lastStart = startOfDayUtc(endDate);

  while (cursor <= lastStart) {
    const windowEnd = addDays(cursor, 1);
    windows.push({ start: cursor, end: windowEnd });
    cursor = windowEnd;
  }

  return windows;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}

async function retryFetch(
  url: string,
  init: RequestInit,
  attempts = 3,
  baseDelayMs = 300,
  respectRetryAfter = false
): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        if (respectRetryAfter) {
          const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
          if (retryAfterMs !== null && retryAfterMs > 0) {
            await sleep(retryAfterMs);
            continue;
          }
        }
      } else {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
    const jitter = Math.floor(Math.random() * 250);
    await sleep(baseDelayMs * (i + 1) + jitter);
  }
  throw lastError ?? new Error('Unknown fetch error');
}

function normalizeModelIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractModelFromOperation(operation: string): string {
  const base = operation.split(':')[0] ?? operation;
  return normalizeModelIdentifier(base);
}

function extractModelFromAdminItem(item: OpenAIAdminResultItem): string {
  const candidates = [
    item.name,
    (item as unknown as { operation?: string }).operation,
    (item as unknown as { model?: string }).model,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeModelIdentifier(String(candidate));
    if (normalized) {
      return normalized;
    }
  }
  return 'unknown';
}

interface AdminUsageContext {
  timestamp: Date;
  windowStart: Date;
  windowEnd: Date;
  projectId?: string;
  openaiApiKeyId?: string;
  openaiUserId?: string;
  serviceTier?: string;
  batch?: boolean;
  numModelRequests?: number;
}

function normalizeAdminResults(results: OpenAIAdminResultItem[], context: AdminUsageContext): UsageEventData[] {
  return results.map((item) => {
    const model = extractModelFromAdminItem(item);
    const tokensIn = safeNumber(item.input_tokens ?? item.prompt_tokens ?? item.usage?.prompt_tokens ?? 0);
    const tokensOut = safeNumber(item.output_tokens ?? item.completion_tokens ?? item.usage?.completion_tokens ?? 0);
    const projectId = item.project_id ?? context.projectId;
    const apiKeyId = item.api_key_id ?? context.openaiApiKeyId;
    const userId = item.user_id ?? context.openaiUserId;
    const batch = item.batch ?? context.batch;
    const serviceTier = item.service_tier ?? context.serviceTier;
    let cost = safeNumber(item.cost ?? item.amount ?? item.usage?.total_cost ?? 0);
    let pricingKey: string | undefined;
    let pricingFallback: boolean | undefined;
    if (cost <= 0) {
      const estimate = calculateCost(model, tokensIn, tokensOut);
      cost = estimate.amount;
      pricingKey = estimate.pricingKey;
      pricingFallback = estimate.fallback;
    }
    const usageEvent: UsageEventData = {
      model,
      tokensIn,
      tokensOut,
      costEstimate: Number(cost.toFixed(6)),
      timestamp: context.timestamp,
      windowStart: context.windowStart,
      windowEnd: context.windowEnd,
      projectId,
      openaiApiKeyId: apiKeyId,
      openaiUserId: userId,
      serviceTier,
      batch,
      numModelRequests: optionalNumber(item.num_model_requests) ?? context.numModelRequests,
      inputCachedTokens: optionalNumber(item.input_cached_tokens),
      inputUncachedTokens: optionalNumber(item.input_uncached_tokens),
      inputTextTokens: optionalNumber(item.input_text_tokens),
      outputTextTokens: optionalNumber(item.output_text_tokens),
      inputCachedTextTokens: optionalNumber(item.input_cached_text_tokens),
      inputAudioTokens: optionalNumber(item.input_audio_tokens),
      inputCachedAudioTokens: optionalNumber(item.input_cached_audio_tokens),
      outputAudioTokens: optionalNumber(item.output_audio_tokens),
      inputImageTokens: optionalNumber(item.input_image_tokens),
      inputCachedImageTokens: optionalNumber(item.input_cached_image_tokens),
      outputImageTokens: optionalNumber(item.output_image_tokens),
    };
    if (pricingKey !== undefined || pricingFallback !== undefined) {
      usageEvent.pricingKey = pricingKey;
      usageEvent.pricingFallback = pricingFallback;
    }
    return usageEvent;
  });
}

async function fetchAdminUsage(
  apiKey: string,
  startDate: Date,
  endDate: Date,
  config: UsageModeConfiguration
): Promise<UsageEventData[]> {
  validateUsageConfiguration(config);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'OpenAI-Organization': config.organizationId!,
    'OpenAI-Project': config.projectId!,
  };

  const startEpoch = Math.floor(startDate.getTime() / 1000);
  const endEpoch = Math.floor(endDate.getTime() / 1000);

  const pages: OpenAIAdminUsageResponse[] = [];
  let current = new URL('https://api.openai.com/v1/organization/usage/completions');
  current.searchParams.set('start_time', startEpoch.toString());
  current.searchParams.set('end_time', endEpoch.toString());
  current.searchParams.set('limit', OPENAI_ADMIN_LIMIT.toString());
  current.searchParams.set('group_by', 'project_id,user_id,api_key_id,model,batch');

  let safety = 0;
  while (safety < 20) {
    safety += 1;
    if (process.env.OPENAI_USAGE_DEBUG === '1') {
      console.log('[openai-admin] request', {
        url: current.toString(),
        headers: {
          authorization: `${headers.Authorization.slice(0, 12)}…`,
          organization: headers['OpenAI-Organization'],
          project: headers['OpenAI-Project'],
        },
      });
    }
    await throttleAdminRequest();
    const response = await retryFetch(current.toString(), { headers }, 3, 500, true);
    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      throw new OpenAIUsageError(body || 'Unauthorized', 'SCOPE_MISSING');
    }
    if (process.env.OPENAI_USAGE_DEBUG === '1') {
      console.log('[openai-admin] status', {
        code: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      });
    }
    if (!response.ok) {
      const body = await response.text();
      throw new OpenAIUsageError(body || `Provider error ${response.status}`, 'PROVIDER_ERROR');
    }
    const json: OpenAIAdminUsageResponse = await response.json();
    if (process.env.OPENAI_USAGE_DEBUG === '1') {
      console.dir(
        {
          hasMore: json.has_more,
          next: json.next_page,
          bucketCount: Array.isArray(json.data) ? json.data.length : 0,
          sampleBucket: Array.isArray(json.data) ? json.data[0] : undefined,
        },
        { depth: 4 }
      );
    }
    pages.push(json);
    if (json.has_more && json.next_page) {
      const validation = sanitizeAdminNextPageUrl(current, json.next_page);
      if (!validation.ok) {
        const { reason, resolved } = validation;
        console.error('[usage-fetcher] Aborting pagination due to invalid next_page', {
          reason,
          nextPage: json.next_page,
          resolved,
        });
        break;
      }
      current = validation.url;
    } else {
      break;
    }
  }

  return normalizeAdminUsagePages(pages, startDate);
}

function normalizeAdminUsagePages(pages: OpenAIAdminUsageResponse[], startDate: Date): UsageEventData[] {
  const events: UsageEventData[] = [];

  for (const page of pages) {
    const records = Array.isArray(page.data) ? page.data : [];
    for (const record of records) {
      const windowStart = record.start_time_iso ? new Date(record.start_time_iso) : asDate(record.start_time, startDate);
      const windowEnd = record.end_time_iso ? new Date(record.end_time_iso) : addDays(windowStart, 1);
      const results = Array.isArray(record.results) ? record.results : [];
      const context: AdminUsageContext = {
        timestamp: windowStart,
        windowStart,
        windowEnd,
        projectId: record.project_id ?? undefined,
        openaiApiKeyId: record.api_key_id ?? undefined,
        openaiUserId: record.user_id ?? undefined,
        serviceTier: record.service_tier ?? undefined,
        batch: record.batch ?? undefined,
        numModelRequests: optionalNumber(record.num_model_requests),
      };
      events.push(...normalizeAdminResults(results, context));
    }

    const dailyCosts = Array.isArray(page.daily_costs) ? page.daily_costs : [];
    for (const daily of dailyCosts) {
      const windowStart = asDate((daily as any)?.timestamp, startDate);
      const windowEnd = addDays(windowStart, 1);
      const items = Array.isArray((daily as any)?.line_items) ? (daily as any).line_items! : [];
      const context: AdminUsageContext = {
        timestamp: windowStart,
        windowStart,
        windowEnd,
      };
      events.push(...normalizeAdminResults(items, context));
    }
  }

  return events;
}

function assertAdminUsageResponse(page: unknown, index: number): OpenAIAdminUsageResponse {
  if (!page || typeof page !== 'object') {
    throw new Error(`[usage-fetcher] Invalid admin usage response page at index ${index}`);
  }
  const cast = page as OpenAIAdminUsageResponse;
  if (cast.data !== undefined && !Array.isArray(cast.data)) {
    throw new Error('[usage-fetcher] Invalid admin usage response: data must be an array when present');
  }
  if (cast.daily_costs !== undefined && !Array.isArray(cast.daily_costs)) {
    throw new Error('[usage-fetcher] Invalid admin usage response: daily_costs must be an array when present');
  }
  return cast;
}

async function fetchStandardUsage(apiKey: string, startDate: Date, endDate: Date): Promise<UsageEventData[]> {
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);
  const url = `https://api.openai.com/v1/usage?start_time=${startTimestamp}&end_time=${endTimestamp}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const response = await retryFetch(url, { headers }, 2, 400);
  if (response.status === 401 || response.status === 403) {
    const body = await response.text();
    throw new OpenAIUsageError(body || 'Unauthorized', 'SCOPE_MISSING');
  }
  if (!response.ok) {
    const body = await response.text();
    throw new OpenAIUsageError(body || `Provider error ${response.status}`, 'PROVIDER_ERROR');
  }

  const data: OpenAIStandardUsageResponse = await response.json();
  return (Array.isArray(data.data) ? data.data : []).map((usage) => {
    const model = extractModelFromOperation(usage.operation);
    const inputTokens = usage.n_context_tokens_total || 0;
    const outputTokens = usage.n_generated_tokens_total || 0;
    const { amount, pricingKey, fallback } = calculateCost(model, inputTokens, outputTokens);
    const timestamp = new Date(usage.aggregation_timestamp * 1000);
    const windowStart = startOfDayUtc(timestamp);
    const windowEnd = addDays(windowStart, 1);

    return {
      model,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      costEstimate: Number(amount.toFixed(6)),
      timestamp,
      windowStart,
      windowEnd,
      pricingKey,
      pricingFallback: fallback,
    };
  });
}

export async function fetchOpenAIUsage(
  apiKey: string,
  startDate: Date,
  endDate: Date,
  config: UsageModeConfiguration
): Promise<UsageEventData[]> {
  if (config.mode === 'admin') {
    return fetchAdminUsage(apiKey, startDate, endDate, config);
  }
  return fetchStandardUsage(apiKey, startDate, endDate);
}

function generateSimulatedUsage(startDate: Date, endDate: Date): UsageEventData[] {
  const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
  const totalEvents = Math.floor(Math.random() * 8) + 5;
  const duration = Math.max(endDate.getTime() - startDate.getTime(), 1);
  const events: UsageEventData[] = [];

  for (let i = 0; i < totalEvents; i++) {
    const model = models[Math.floor(Math.random() * models.length)];
    const tokensIn = Math.floor(Math.random() * 2000) + 200;
    const tokensOut = Math.floor(Math.random() * 1500) + 100;
    const { amount, pricingKey, fallback } = calculateCost(model, tokensIn, tokensOut);
    const ts = new Date(startDate.getTime() + Math.random() * duration);
    const windowStart = startOfDayUtc(ts);

    events.push({
      model,
      tokensIn,
      tokensOut,
      costEstimate: Number(amount.toFixed(6)),
      timestamp: ts,
      windowStart,
      windowEnd: addDays(windowStart, 1),
      pricingKey,
      pricingFallback: fallback,
    });
  }

  return events;
}

export async function fetchAndStoreUsageForUser(
  userId: string,
  daysBack: number = 1,
  options: FetchUsageOptions = {}
): Promise<IngestionTelemetry> {
  let runLabel: string | undefined;
  try {
    const db = getDb();
    const userKeys = await db
      .select()
      .from(providerKeys)
      .where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, 'openai')));

    const telemetry: IngestionTelemetry = {
      userId,
      processedKeys: userKeys.length,
      simulatedKeys: 0,
      failedKeys: 0,
      storedEvents: 0,
      skippedEvents: 0,
      updatedEvents: 0,
      windowsProcessed: 0,
      constraintInserts: 0,
      constraintUpdates: 0,
      manualFallbackInserts: 0,
      manualFallbackUpdates: 0,
      manualFallbackWindows: 0,
      manualFallbackKeys: 0,
      issues: [],
    };

    const overrideEnd = parseDateInput(options.endDate);
    const overrideStart = parseDateInput(options.startDate);
    const endDate = overrideEnd ?? new Date();
    const startDate =
      overrideStart ?? new Date(endDate.getTime() - Math.max(daysBack, 1) * MS_PER_DAY);

    if (startDate > endDate) {
      throw new Error('[usage-fetcher] startDate must be on or before endDate');
    }

    runLabel = options.runLabel;

    if (userKeys.length === 0) {
      console.log(`[usage-fetcher] No OpenAI keys for user`, {
        userId,
        ...(runLabel ? { runLabel } : {}),
      });
      return telemetry;
    }

    try {
      await ensureUsageWindowSchema(db);
    } catch (error) {
      if (error instanceof UsageSchemaError) {
        telemetry.failedKeys = userKeys.length;
        telemetry.issues.push({
          keyId: 0,
          message: error.message,
          code: 'SCHEMA_MISSING',
        });
        console.error('[usage-fetcher] Daily usage schema verification failed', {
          userId,
          missingColumns: error.missingColumns,
          ...(runLabel ? { runLabel } : {}),
        });
        return telemetry;
      }
      throw error;
    }

    if (runLabel || overrideStart || overrideEnd) {
      console.log('[usage-fetcher] Starting usage ingestion window', {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(runLabel ? { runLabel } : {}),
      });
    }

    for (const keyRecord of userKeys) {
      let usedSimulation = false;
      const persistenceCounters = {
        constraintInserted: 0,
        constraintUpdated: 0,
        manualInserted: 0,
        manualUpdated: 0,
      };
      const manualFallbackWindows = new Set<string>();
      let usedManualFallback = false;
      try {
        const decryptedKey = decrypt({
          encryptedText: keyRecord.encryptedKey,
          iv: keyRecord.iv,
          authTag: keyRecord.authTag,
        });

        const usageConfig = deriveUsageConfigurationForKey(keyRecord);
        const windowRanges = ENABLE_DAILY_USAGE_WINDOWS
          ? buildDailyWindows(startDate, endDate)
          : [{ start: startDate, end: endDate }];

        let newEventsCount = 0;
        let updatedEventsCount = 0;
        let totalFetched = 0;
        let processedWindows = 0;
        const fallbackModels = new Set<string>();
        let skipKey = false;

        for (const windowRange of windowRanges) {
          let usageData: UsageEventData[] = [];
          let usedSimulationThisWindow = false;
          try {
            usageData = await fetchOpenAIUsage(decryptedKey, windowRange.start, windowRange.end, usageConfig);
          } catch (error) {
            if (error instanceof UsageConfigurationError) {
              telemetry.failedKeys += 1;
              telemetry.issues.push({
                keyId: keyRecord.id,
                message: error.message,
                code: 'CONFIGURATION_ERROR',
              });
              console.error('[usage-fetcher] Missing configuration for admin usage mode', {
                userId,
                keyId: keyRecord.id,
                windowStart: windowRange.start.toISOString(),
                error: error.message,
                ...(runLabel ? { runLabel } : {}),
              });
              skipKey = true;
              break;
            }
            if (error instanceof OpenAIUsageError && (error.code === 'SCOPE_MISSING' || error.code === 'UNAUTHORIZED')) {
              if (ENABLE_SIMULATED_USAGE) {
                telemetry.issues.push({
                  keyId: keyRecord.id,
                  message: error.message,
                  code: error.code,
                });
                usedSimulation = true;
                usedSimulationThisWindow = true;
                console.warn(`[usage-fetcher] OpenAI permissions issue; using simulated data`, {
                  userId,
                  keyId: keyRecord.id,
                  code: error.code,
                  windowStart: windowRange.start.toISOString(),
                  ...(runLabel ? { runLabel } : {}),
                });
                usageData = generateSimulatedUsage(windowRange.start, windowRange.end);
              } else {
              console.error(`[usage-fetcher] OpenAI permissions issue; aborting ingestion`, {
                userId,
                keyId: keyRecord.id,
                code: error.code,
                windowStart: windowRange.start.toISOString(),
                ...(runLabel ? { runLabel } : {}),
              });
              telemetry.failedKeys += 1;
              throw markUsageFailureAsCounted(error);
            }
          } else {
              telemetry.failedKeys += 1;
              telemetry.issues.push({
                keyId: keyRecord.id,
                message: error instanceof Error ? error.message : 'Unknown provider error',
              });
              console.error(`[usage-fetcher] Unexpected provider failure`, {
                userId,
                keyId: keyRecord.id,
                windowStart: windowRange.start.toISOString(),
                error: error instanceof Error ? error.message : error,
                ...(runLabel ? { runLabel } : {}),
              });
              throw markUsageFailureAsCounted(error);
            }
          }

          if (skipKey) {
            break;
          }

          if (usedSimulationThisWindow) {
            usedSimulation = true;
          }

          totalFetched += usageData.length;
          processedWindows += 1;

          for (const usage of usageData) {
            const insertPayload = buildUsageEventInsertPayload(keyRecord.id, usage);
            const upsertResult = await upsertUsageEvent(db, insertPayload);

            if (upsertResult.status === 'inserted') {
              newEventsCount += 1;
              telemetry.storedEvents += 1;
            } else {
              updatedEventsCount += 1;
              telemetry.updatedEvents += 1;
            }

            if (upsertResult.mode === 'manual-fallback') {
              usedManualFallback = true;
              const windowKey =
                insertPayload.windowStart instanceof Date
                  ? `${keyRecord.id}:${insertPayload.windowStart.toISOString()}`
                  : `${keyRecord.id}:unknown`;
              manualFallbackWindows.add(windowKey);
              if (upsertResult.status === 'inserted') {
                persistenceCounters.manualInserted += 1;
              } else {
                persistenceCounters.manualUpdated += 1;
              }
            } else {
              if (upsertResult.status === 'inserted') {
                persistenceCounters.constraintInserted += 1;
              } else {
                persistenceCounters.constraintUpdated += 1;
              }
            }

            if (usage.pricingFallback) {
              fallbackModels.add(usage.model);
            }
          }
        }

        if (skipKey) {
          continue;
        }

        telemetry.windowsProcessed += processedWindows;

        if (usedSimulation) {
          console.log(`[usage-fetcher] Stored simulated usage events`, {
            userId,
            keyId: keyRecord.id,
            newBuckets: newEventsCount,
            updatedBuckets: updatedEventsCount,
            windows: processedWindows,
            fetched: totalFetched,
            persistence: {
              constraint: {
                inserted: persistenceCounters.constraintInserted,
                updated: persistenceCounters.constraintUpdated,
              },
              manualFallback: {
                inserted: persistenceCounters.manualInserted,
                updated: persistenceCounters.manualUpdated,
              },
            },
            manualFallbackWindows: manualFallbackWindows.size,
            manualFallbackUsed: usedManualFallback,
            ...(runLabel ? { runLabel } : {}),
          });
        } else {
          console.log(`[usage-fetcher] Stored usage events`, {
            userId,
            keyId: keyRecord.id,
            newBuckets: newEventsCount,
            updatedBuckets: updatedEventsCount,
            windows: processedWindows,
            fetched: totalFetched,
            persistence: {
              constraint: {
                inserted: persistenceCounters.constraintInserted,
                updated: persistenceCounters.constraintUpdated,
              },
              manualFallback: {
                inserted: persistenceCounters.manualInserted,
                updated: persistenceCounters.manualUpdated,
              },
            },
            manualFallbackWindows: manualFallbackWindows.size,
            manualFallbackUsed: usedManualFallback,
            ...(runLabel ? { runLabel } : {}),
          });
        }

        if (fallbackModels.size > 0) {
          const models = Array.from(fallbackModels.values()).join(', ');
          telemetry.issues.push({
            keyId: keyRecord.id,
            message: `Pricing fallback applied for models: ${models}`,
            code: 'PRICING_FALLBACK',
          });
        }
      } catch (error) {
        const counted =
          typeof error === 'object' &&
          error !== null &&
          (error as FailureMarkedError)._usageFailureCounted === true;
        if (!counted) {
          telemetry.failedKeys += 1;
        }
        telemetry.issues.push({
          keyId: keyRecord.id,
          message: error instanceof Error ? error.message : 'Unknown ingestion error',
          code: error instanceof OpenAIUsageError ? error.code : undefined,
        });
        console.error(error);
        if (error && typeof error === 'object' && 'cause' in error) {
          console.error('cause:', (error as { cause?: unknown }).cause);
        }
        if (error && typeof error === 'object') {
          console.error('error keys:', Object.keys(error as Record<string, unknown>));
        }
        console.error(`[usage-fetcher] Error processing key`, {
          userId,
          keyId: keyRecord.id,
          error: error instanceof Error ? error.message : error,
          ...(runLabel ? { runLabel } : {}),
        });
      } finally {
        if (usedSimulation) {
          telemetry.simulatedKeys += 1;
        }
        if (usedManualFallback) {
          telemetry.manualFallbackKeys += 1;
        }
        telemetry.manualFallbackWindows += manualFallbackWindows.size;
        telemetry.manualFallbackInserts += persistenceCounters.manualInserted;
        telemetry.manualFallbackUpdates += persistenceCounters.manualUpdated;
        telemetry.constraintInserts += persistenceCounters.constraintInserted;
        telemetry.constraintUpdates += persistenceCounters.constraintUpdated;
      }
    }

    return telemetry;
  } catch (error) {
    const message = '[usage-fetcher] Usage ingestion run failed';
    console.error(message, {
      userId,
      error: error instanceof Error ? error.message : error,
      ...(runLabel ? { runLabel } : {}),
    });
    if (error instanceof Error) {
      const err = new Error(message);
      (err as { cause?: unknown }).cause = error;
      throw err;
    }
    throw new Error(`${message}: ${String(error)}`);
  }
}

export const __usageFetcherTestHooks = {
  resetConstraintWarningFlag: () => {
    loggedMissingUsageConstraint = false;
  },
  isConstraintMissingError: isUsageConstraintMissingError,
  buildUsageEventInsertPayloadForTest: buildUsageEventInsertPayload,
  upsertUsageEventForTest: async (db: unknown, payload: UsageEventInsert) =>
    upsertUsageEvent(db as ReturnType<typeof getDb>, payload),
  sanitizeAdminNextPageUrlForTest: sanitizeAdminNextPageUrl,
  normalizeAdminUsagePagesForTest: (pages: unknown[], fallbackStart?: Date) => {
    if (!Array.isArray(pages)) {
      throw new Error('[usage-fetcher] Expected pages to be an array when normalizing admin usage fixtures');
    }
    return normalizeAdminUsagePages(
      pages.map((page, index) => assertAdminUsageResponse(page, index)),
      fallbackStart ?? new Date()
    );
  },
};
