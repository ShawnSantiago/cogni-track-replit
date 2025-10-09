# Migration Runbook – 0003_usage_event_windows

## Overview
Staging currently lacks `drizzle/0003_usage_event_windows.sql`, blocking daily usage parity checks (missing `window_start` columns). This runbook defines the commands and evidence required before enabling cron rehearsals.

## Preconditions
- `DATABASE_URL` points at the staging Neon instance (confirm read/write access).
- Local schema files match `main` + feature branch (run `git status` to ensure no pending migrations).
- Backup snapshot exists (`drizzle/meta/pre-admin.json`) or regenerate via `pnpm drizzle-kit introspect --out drizzle/meta/pre-window.json`.

## Execution Steps
1. **Dry-run export (optional but recommended)**
   ```bash
   pnpm drizzle-kit export --out audit/migration-prechecks/pre-window-export.sql
   ```
   - Capture the output file checksum.

2. **Apply migration**
   ```bash
   pnpm drizzle-kit push --source drizzle/0003_usage_event_windows.sql
   ```
   - Store command output in `audit/migration-prechecks/0003_push.log`.

3. **Post-apply introspection**
   ```bash
   pnpm drizzle-kit introspect --out drizzle/meta/post-window.json
   ```
   - Diff `drizzle/meta/pre-window.json` vs `drizzle/meta/post-window.json` and archive under `audit/migration-prechecks/0003_schema_diff.txt`.

4. **Constraint verification**
   ```bash
   pnpm exec psql "$DATABASE_URL" -c "\d usage_events" > audit/migration-prechecks/0003_usage_events_schema.txt
   pnpm exec psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'usage_events' AND indexname = 'usage_admin_bucket_idx';" >> audit/migration-prechecks/0003_usage_events_schema.txt
   ```

5. **Schema guard sanity check**
   ```bash
   ENABLE_DAILY_USAGE_WINDOWS=true pnpm exec tsx scripts/usage-backfill.ts --days=1 --chunk-days=1 --label verify-schema --dry-run
   ```
   - Expect no `SCHEMA_MISSING` issues in the structured logs. If the command exits early with
     `Daily usage schema verification failed`, re-run step 2 after confirming migration status.

6. **Telemetry diff rerun**
   ```bash
   node tmp/usage-telemetry-diff.mjs \
     --csv openAI-data/completions_usage_2025-09-01_2025-10-01.csv \
     --output audit/telemetry-audit/latest-staging.json \
     --from 2025-09-01T00:00:00Z --to 2025-10-01T00:00:00Z
   ```
   - Expect `missingInDb` count to drop to 0 (assuming staging backfill complete).

## Rollback
1. Restore prior schema snapshot or run:
   ```bash
   pnpm exec psql "$DATABASE_URL" -c "ALTER TABLE usage_events DROP COLUMN IF EXISTS window_start, DROP COLUMN IF EXISTS window_end, DROP COLUMN IF EXISTS project_id, DROP COLUMN IF EXISTS openai_user_id, DROP COLUMN IF EXISTS openai_api_key_id, DROP COLUMN IF EXISTS service_tier, DROP COLUMN IF EXISTS batch, DROP COLUMN IF EXISTS num_model_requests, DROP COLUMN IF EXISTS input_cached_tokens, DROP COLUMN IF EXISTS input_uncached_tokens, DROP COLUMN IF EXISTS input_text_tokens, DROP COLUMN IF EXISTS output_text_tokens, DROP COLUMN IF EXISTS input_cached_text_tokens, DROP COLUMN IF EXISTS input_audio_tokens, DROP COLUMN IF EXISTS input_cached_audio_tokens, DROP COLUMN IF EXISTS output_audio_tokens, DROP COLUMN IF EXISTS input_image_tokens, DROP COLUMN IF EXISTS input_cached_image_tokens, DROP COLUMN IF EXISTS output_image_tokens;"
   pnpm exec psql "$DATABASE_URL" -c "DROP INDEX IF EXISTS usage_admin_bucket_idx;"
   pnpm exec psql "$DATABASE_URL" -c "CREATE UNIQUE INDEX usage_admin_bucket_idx ON usage_events (key_id, model, timestamp)" # legacy fallback
   ```
2. Re-run `pnpm drizzle-kit introspect` to confirm reversion and log in `audit/rollback_log.md`.

## Evidence Checklist
- [ ] `audit/migration-prechecks/0003_push.log`
- [ ] `audit/migration-prechecks/0003_usage_events_schema.txt`
- [ ] Diff of pre/post schema snapshots
- [ ] `audit/telemetry-audit/latest-staging.json` (post-migration diff)
- [ ] Memory bank entry noting staging alignment

### 2025-10-08 – verify-schema backfill dry-run
```
ENABLE_DAILY_USAGE_WINDOWS=true pnpm exec tsx scripts/usage-backfill.ts --days 1 --chunk-days 1 --label verify-schema --start 2025-09-01 --end 2025-09-01
# (invoked via direnv exec with NODE_ENV=production to target staging)
```
Output:
```
[usage-backfill] Starting backfill run { userCount: 1, startDate: '2025-09-01T00:00:00.000Z', endDate: '2025-09-01T00:00:00.000Z', chunkDays: 1, runLabel: 'verify-schema' }
[usage-backfill] Processing user { userId: 'user_33NYEYJEOVbKAFtHcAp2oVJHInH', startDate: '2025-09-01T00:00:00.000Z', endDate: '2025-09-01T00:00:00.000Z' }
[usage-backfill] Processing chunk { userId: 'user_33NYEYJEOVbKAFtHcAp2oVJHInH', chunkIndex: 0, chunkStart: '2025-09-01T00:00:00.000Z', chunkEnd: '2025-09-01T00:00:00.000Z', days: 1, runLabel: 'verify-schema:user_33NYEYJEOVbKAFtHcAp2oVJHInH:chunk-0' }
[usage-fetcher] Starting usage ingestion window { userId: 'user_33NYEYJEOVbKAFtHcAp2oVJHInH', startDate: '2025-09-01T00:00:00.000Z', endDate: '2025-09-01T00:00:00.000Z', runLabel: 'verify-schema:user_33NYEYJEOVbKAFtHcAp2oVJHInH:chunk-0' }
[usage-fetcher] Pricing fallback applied { model: 'unknown', resolvedKey: 'gpt-3.5-turbo' }
[usage-fetcher] usage_admin_bucket_idx missing; using manual dedupe fallback { reason: 'metadata-missing' }
[usage-fetcher] Stored usage events { userId: 'user_33NYEYJEOVbKAFtHcAp2oVJHInH', keyId: 1, newBuckets: 1, updatedBuckets: 0, windows: 1, fetched: 1, persistence: { constraint: { inserted: 0, updated: 0 }, manualFallback: { inserted: 1, updated: 0 } }, manualFallbackWindows: 1, manualFallbackUsed: true, runLabel: 'verify-schema:user_33NYEYJEOVbKAFtHcAp2oVJHInH:chunk-0' }
[usage-backfill] Chunk complete { userId: 'user_33NYEYJEOVbKAFtHcAp2oVJHInH', chunkIndex: 0, chunkStart: '2025-09-01T00:00:00.000Z', chunkEnd: '2025-09-01T00:00:00.000Z', processedKeys: 1, windowsProcessed: 1, storedEvents: 1, updatedEvents: 0, constraintInserts: 0, constraintUpdates: 0, manualFallbackInserts: 1, manualFallbackUpdates: 0, manualFallbackWindows: 1, manualFallbackKeys: 1, simulatedKeys: 0, failedKeys: 0, issues: [ { keyId: 1, message: 'Pricing fallback applied for models: unknown', code: 'PRICING_FALLBACK' } ] }
[usage-backfill] Backfill run completed { totals: { processedUsers: 1, processedChunks: 1, processedKeys: 1, simulatedKeys: 0, failedKeys: 0, storedEvents: 1, updatedEvents: 0, windowsProcessed: 1, issues: 1, constraintInserts: 0, constraintUpdates: 0, manualFallbackInserts: 1, manualFallbackUpdates: 0, manualFallbackWindows: 1, manualFallbackKeys: 1 }, hadErrors: false }
```
