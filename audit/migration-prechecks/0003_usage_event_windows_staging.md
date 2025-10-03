# Staging Apply Runbook – Migration 0003_usage_event_windows

## Purpose
Apply `drizzle/0003_usage_event_windows.sql` to the Neon staging database so daily window ingestion backfills can populate metadata columns and dedupe via the widened constraint.

## Prerequisites
- Staging `DATABASE_URL` available in local shell (`export DATABASE_URL="postgres://..."`).
- Latest code synced with `drizzle/0003_usage_event_windows.sql` and corresponding updates in `src/db/schema.ts`.
- Neon staging snapshot or point-in-time restore available for rollback.
- Ensure no ingestion jobs are running against staging during apply.

## Pre-Apply Checklist
1. `pnpm drizzle-kit introspect --out audit/migration-prechecks/schema-snapshot-pre-0003.json` – capture current staging schema.
2. `pnpm drizzle-kit check` – verify migration queue and configuration.
3. `pnpm drizzle-kit status` is unsupported; rely on `pnpm drizzle-kit check` output for pending migration list.
4. Record planned apply time and operator in `audit/migration-prechecks/apply-log.md` (append entry).

## Apply Steps
1. `pnpm drizzle-kit push` – applies pending migrations (includes `0003`).
2. If push fails, capture full output to `audit/migration-prechecks/drizzle-push-0003.log` and halt.

## Validation Steps
1. `pnpm drizzle-kit introspect --out audit/migration-prechecks/schema-snapshot-post-0003.json`.
2. Diff snapshots: `diff -u audit/migration-prechecks/schema-snapshot-pre-0003.json audit/migration-prechecks/schema-snapshot-post-0003.json > audit/migration-prechecks/schema-pre-post-0003.diff`.
3. Verify index: `psql "$DATABASE_URL" -c "\d+ usage_events" | tee audit/migration-prechecks/usage-events-ddl-post-0003.txt` and confirm `usage_admin_bucket_idx` includes `window_start`/`window_end` and metadata columns.
4. Run smoke query: `psql "$DATABASE_URL" -c "SELECT COUNT(*) FILTER (WHERE window_start IS NOT NULL) AS buckets_with_windows, COUNT(*) FILTER (WHERE window_end IS NULL) AS missing_window_end FROM usage_events;"` and record output.
5. Document validation summary in `audit/migration-prechecks/apply-log.md` under the corresponding entry.

## Rollback Plan
- If migration introduces issues, execute Neon point-in-time restore to pre-apply snapshot.
- Alternatively, run `pnpm drizzle-kit down --to 0002` (if applicable) and validate that `usage_events` drops added columns (risk: data loss for new columns).
- After rollback, re-run introspection and attach diff confirming schema restored; log rollback actions in `audit/rollback_log.md`.

## Evidence Requirements
- Pre/post schema snapshots.
- Drizzle push log (`drizzle-push-0003.log`).
- `usage_events` DDL capture (`usage-events-ddl-post-0003.txt`).
- Smoke query output file (`usage-events-window-counts.txt`).
- Updated `audit/migration-prechecks/apply-log.md` entry referencing evidence files.

## Notes
- Running locally requires `DATABASE_URL` write access; if unavailable, coordinate with operator who can execute commands and share artefacts.
- Hold off on staging ingestion jobs until validation completes to avoid noisy metrics during verification.
- Record checksums with `sha256sum` for each artefact to maintain audit chain (append to `audit/migration-prechecks/0003.sha256`).
