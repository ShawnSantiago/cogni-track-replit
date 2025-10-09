import { usageEvents, providerKeys } from '@/db/schema';
import { UsageEventWithMetadata } from '@/types/usage';

const MISSING_COLUMN_REGEX = /column\s+['"`\w\.]+\s+does\s+not\s+exist/i;

const extractErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }

  return '';
};

export const BASE_USAGE_EVENT_SELECTION = {
  id: usageEvents.id,
  model: usageEvents.model,
  tokensIn: usageEvents.tokensIn,
  tokensOut: usageEvents.tokensOut,
  costEstimate: usageEvents.costEstimate,
  timestamp: usageEvents.timestamp,
  provider: providerKeys.provider,
} as const;

export const METADATA_USAGE_EVENT_SELECTION = {
  windowStart: usageEvents.windowStart,
  windowEnd: usageEvents.windowEnd,
  projectId: usageEvents.projectId,
  openaiApiKeyId: usageEvents.openaiApiKeyId,
  openaiUserId: usageEvents.openaiUserId,
  serviceTier: usageEvents.serviceTier,
  batch: usageEvents.batch,
  numModelRequests: usageEvents.numModelRequests,
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
} as const;

export const isMissingColumnError = (error: unknown): boolean => {
  const message = extractErrorMessage(error);
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code === '42703') {
    return true;
  }

  if (MISSING_COLUMN_REGEX.test(message)) {
    return true;
  }

  return /undefined\s+column/i.test(message);
};

const toIsoString = (value: Date | string | null | undefined): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  return null;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const mapDbRowToUsageEvent = (row: any): UsageEventWithMetadata => {
  const timestampIso = toIsoString(row?.timestamp);

  if (!timestampIso) {
    throw new Error('Usage event row is missing a valid timestamp');
  }

  return {
    id: row.id,
    model: row.model,
    tokensIn: toNullableNumber(row.tokensIn),
    tokensOut: toNullableNumber(row.tokensOut),
    costEstimate: row.costEstimate ?? null,
    timestamp: timestampIso,
    provider: typeof row.provider === 'string' ? row.provider : 'unknown',
    windowStart: toIsoString(row.windowStart),
    windowEnd: toIsoString(row.windowEnd),
    projectId: typeof row.projectId === 'string' ? row.projectId : null,
    openaiApiKeyId: typeof row.openaiApiKeyId === 'string' ? row.openaiApiKeyId : null,
    openaiUserId: typeof row.openaiUserId === 'string' ? row.openaiUserId : null,
    serviceTier: typeof row.serviceTier === 'string' ? row.serviceTier : null,
    batch: typeof row.batch === 'boolean' ? row.batch : null,
    numModelRequests: toNullableNumber(row.numModelRequests),
    inputCachedTokens: toNullableNumber(row.inputCachedTokens),
    inputUncachedTokens: toNullableNumber(row.inputUncachedTokens),
    inputTextTokens: toNullableNumber(row.inputTextTokens),
    outputTextTokens: toNullableNumber(row.outputTextTokens),
    inputCachedTextTokens: toNullableNumber(row.inputCachedTextTokens),
    inputAudioTokens: toNullableNumber(row.inputAudioTokens),
    inputCachedAudioTokens: toNullableNumber(row.inputCachedAudioTokens),
    outputAudioTokens: toNullableNumber(row.outputAudioTokens),
    inputImageTokens: toNullableNumber(row.inputImageTokens),
    inputCachedImageTokens: toNullableNumber(row.inputCachedImageTokens),
    outputImageTokens: toNullableNumber(row.outputImageTokens),
  };
};
