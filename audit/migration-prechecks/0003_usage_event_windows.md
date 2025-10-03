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

5. **Telemetry diff rerun**
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

