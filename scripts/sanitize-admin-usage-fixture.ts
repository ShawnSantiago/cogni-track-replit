#!/usr/bin/env tsx

/**
 * Sanitizes OpenAI admin usage fixtures prior to committing them to the repository.
 *
 * Usage:
 *   tsx scripts/sanitize-admin-usage-fixture.ts <input.json> [output.json]
 *
 * When the output path is omitted the input file is overwritten in-place.
 * The script removes high-risk fields and hashes user-identifying strings while
 * preserving the metadata required by the contract tests.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const HASH_KEYS = new Set([
  'organization_name',
  'organization_display_name',
  'user_name',
  'user_email',
  'user_display_name',
  'team_name',
  'team_display_name',
  'project_name',
  'project_display_name',
]);

const STRIP_KEYS = new Set([
  'request_id',
  'policy_id',
  'raw_prompt',
  'raw_completion',
  'input_text',
  'output_text',
  'debug',
]);

const KEEP_KEYS = new Set([
  'project_id',
  'api_key_id',
  'user_id',
  'service_tier',
  'num_model_requests',
  'results',
  'data',
  'daily_costs',
  'line_items',
  'start_time',
  'start_time_iso',
  'end_time',
  'end_time_iso',
  'model',
  'name',
  'operation',
  'amount',
  'cost',
  'usage',
  'input_tokens',
  'output_tokens',
  'prompt_tokens',
  'completion_tokens',
  'cached_tokens',
  'input_cached_tokens',
  'input_uncached_tokens',
  'input_cached_text_tokens',
  'input_text_tokens',
  'output_text_tokens',
  'input_audio_tokens',
  'input_cached_audio_tokens',
  'output_audio_tokens',
  'input_image_tokens',
  'input_cached_image_tokens',
  'output_image_tokens',
]);

const hashSalt = process.env.DAILY_USAGE_SANITIZE_SALT ?? '';

async function main() {
  const [, , inputPath, outputPathArg] = process.argv;

  if (!inputPath) {
    console.error('Usage: tsx scripts/sanitize-admin-usage-fixture.ts <input.json> [output.json]');
    process.exit(1);
  }

  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = outputPathArg ? path.resolve(outputPathArg) : absoluteInput;

  const raw = await fs.readFile(absoluteInput, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  const sanitized = sanitize(parsed);

  await fs.writeFile(absoluteOutput, JSON.stringify(sanitized, null, 2));

  console.log(
    `[sanitize-admin-usage-fixture] Wrote sanitized fixture to ${absoluteOutput} (source ${absoluteInput})`
  );
}

function sanitize(value: unknown, keyPath: string[] = []): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, keyPath));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitizedEntries: [string, unknown][] = [];

    for (const [key, childValue] of entries) {
      if (STRIP_KEYS.has(key)) {
        continue;
      }

      const nextPath = [...keyPath, key];

      if (HASH_KEYS.has(key) && typeof childValue === 'string') {
        sanitizedEntries.push([key, hashValue(childValue)]);
        continue;
      }

      // Preserve known safe keys verbatim.
      if (KEEP_KEYS.has(key)) {
        sanitizedEntries.push([key, sanitize(childValue, nextPath)]);
        continue;
      }

      if (typeof childValue === 'string') {
        sanitizedEntries.push([key, redactString(childValue)]);
      } else {
        sanitizedEntries.push([key, sanitize(childValue, nextPath)]);
      }
    }

    return Object.fromEntries(sanitizedEntries);
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  return value;
}

function hashValue(input: string): string {
  return crypto.createHash('sha256').update(hashSalt + input).digest('hex').slice(0, 16);
}

function redactString(value: string): string {
  if (value.length === 0) {
    return value;
  }
  if (/^[a-z0-9_-]{10,}$/i.test(value)) {
    // Likely an identifier already; keep as-is.
    return value;
  }
  return `redacted_${hashValue(value)}`;
}

main().catch((error) => {
  console.error('[sanitize-admin-usage-fixture] Failed to sanitize fixture', error);
  process.exit(1);
});
