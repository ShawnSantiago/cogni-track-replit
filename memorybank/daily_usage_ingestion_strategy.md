# Daily Usage Ingestion Strategy Draft

## Goals
- Maintain a rolling 30-day window of OpenAI completions data with day-level granularity.
- Avoid gaps by running automated refresh jobs instead of manual button presses.
- Support historical backfill when feature is enabled.

## Proposed Flow
1. **Daily Scheduler**
   - Add a cron-triggered job (e.g., `/app/api/cron/usage`) that runs every night at 01:00 UTC.
   - Job iterates over all OpenAI provider keys for active users.
   - For each key, call `fetchAndStoreUsageForUser(userId, 2)` to cover yesterday + today overlap.
   - Track per-user/per-key cursors to avoid redundant calls when ingestion is healthy.

2. **Backfill Routine**
   - Provide CLI entry point `pnpm usage:backfill --days=30 --chunk-days=3 --label=<run>` (see `scripts/usage-backfill.ts`).
   - Loop downward from `now - days` to `now`, invoking a per-day helper to ingest one window at a time while respecting throttle limits.
   - On insert conflicts, rely on the insert+update fallback (`fetchAndStoreUsageForUser` catches `23505` and issues an explicit `UPDATE` keyed by the dedupe tuple) so ingestion stays resilient even when Drizzle metadata drops index expressions.
   - Emit structured telemetry per chunk (windows processed, simulated/failing keys, issues) for audit logging.

3. **Per-Day Helper**
   - `fetchOpenAIUsage` now accepts `(start, end)` and returns metadata-rich buckets; helpers derive daily windows via `buildDailyWindows`.
   - Admin mode: call `/v1/organization/usage/completions?start_time=<start>&end_time=<end>` with `OpenAI-Organization`/`OpenAI-Project` headers (per key metadata decrypted at runtime).
   - Standard mode: call `/v1/usage` and post-filter when the API lacks explicit `end_time` controls.
   - Persist canonical `window_start`/`window_end` columns required by the dedupe tuple; ingestion must only run against databases that have applied migration `0003_usage_event_windows.sql` (adds window + metadata fields).

4. **Telemetry**
   - Emit structured logs: `{ userId, keyId, windowStart, storedEvents, skippedEvents, issues }`.
   - Publish metrics for job duration, API errors, and eventual parity check results.

## Scheduling Details
- **Backoff**: Shared token bucket (`OPENAI_ADMIN_REQUESTS_PER_MINUTE` / `OPENAI_ADMIN_MAX_BURST`) paces both cron and backfill traffic; retries respect `Retry-After`.
- **Idempotency**: Dedupe keyed on `(key_id, model, window_start, project_id?, api_key_id?, user_id?, service_tier?, batch?)`; insert+update fallback keeps the tuple authoritative.
- **Retention**: Maintain the 35-day buffer (30-day parity + 5-day retry window). Prune older buckets once parity validation passes.
- **Schema gates**: Staging/prod must apply migration `0003_usage_event_windows.sql` before enabling cron/backfill; otherwise inserts will fail on missing `window_start`/metadata columns.

## Operational Checklist
- Track ingestion cursors per key (already supported by namespaced endpoints); confirm admin metadata decrypt succeeds before enabling cron.
- Document staging rehearsal requirements: run CLI with anonymized data, archive telemetry in `audit/backfill-rehearsal/`, and verify migrations applied.
- Auth guard: Continue requiring `CRON_SECRET` header for daily job; include run labels in logs for traceability.
