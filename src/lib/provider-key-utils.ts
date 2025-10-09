import type { UsageMode } from '@/types/provider-keys';

const VALID_USAGE_MODES: UsageMode[] = ['standard', 'admin'];

export function parseUsageMode(value: unknown): UsageMode | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase();
  return VALID_USAGE_MODES.includes(normalized as UsageMode) ? (normalized as UsageMode) : null;
}

export function isUsageMode(value: unknown): value is UsageMode {
  return parseUsageMode(value) !== null;
}

export function toIsoTimestamp(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}
