# Daily Usage Alignment Plan

## Objective
Match Cogni Track's daily usage analytics to the granularity and totals shown in the OpenAI dashboard, covering the full 30-day window with per-day accuracy.

## Workstreams

### 1. Telemetry Audit
- **Action**: Diff `usage_events` schema and sample rows against the latest OpenAI completions CSV exports to catalogue missing fields (project, key, service tier, cached tokens, etc.).
- **Risks**: CSV schema drift or overlooked columns.
- **Mitigation**: Script the diff, gather multiple exports (different projects/tiers), document findings in repo wiki.
- **Confidence Uplift Plan**:
  1. Run `tsx scripts/usage-telemetry-diff.ts --csv openAI-data/completions_usage_2025-09-01_2025-10-01.csv --out audit/telemetry-audit/latest.json` against the latest sanitized staging snapshot.
  2. Spot-check three representative project tiers, annotating discrepancies in `audit/telemetry-audit/README.md` and attaching screenshots for reviewer sign-off.
  3. Log a summary entry in `memory_bank_review_log.md` with observed gaps and remediation tickets.
- **Confidence Target**: 6/10 after cross-checking exports and publishing artefacts.
  - Status 2025-10-02: CSV diff captured (`audit/telemetry-audit/latest.json`) with manual tier spot-check notes; staging DB comparison blocked pending migration 0003.
  - Status 2025-10-02 (evening): Staging diff `latest-staging.json` still reports 46 missing windows; staging backfill not yet run.
  - Status 2025-10-07: `2025-10-07T14-23-48Z.json` shows same 46 missing windows; Neon HTTP fetch failure persisted, DB comparison skipped.
  - Status 2025-10-07 (retry): `2025-10-07T14-24-48Z.json` blocked by Neon password auth failure; need valid staging credentials before rerun.
  - Status 2025-10-07 (latest): Added guard around `usage_admin_bucket_idx` and validated manual dedupe fallback via `pnpm usage:backfill --start 2025-09-15 --end 2025-09-16 --chunk-days 1 --label debug-admin` (two daily windows stored locally); staging diff rerun still pending refreshed Neon credentials.
  - Status 2025-10-07 (evening): Neon credentials restored; bundled script via esbuild and reran staging diff (`2025-10-07T22-44-28Z-staging.json`, SHA256 `82c61d54326a363615fe257ee7e0ae1f778c6a7ba5ee28ebd93cb3245d18a019`) — DB query succeeded but still reports 46 missing windows, so confidence remains 6/10 pending instrumentation/backfill validation.
  - Status 2025-10-07 (night): Persistence instrumentation counters added (constraint vs manual fallback) with synthetic validation sample `audit/telemetry-audit/synthetic-manual-fallback.json`; awaiting next backfill to confirm fallback usage declines.
  - Status 2025-10-07 (night, post-analysis): Missing windows categorized in `audit/telemetry-audit/missing-windows-summary-2025-10-07.md`; real gaps isolated to project `proj_MhIbP1DyoTSqH6k2DtXVKvvV` (keys `key_mPAw5OyZbONR4dAL`, `key_NF7ZLeXYAXECwqv7`), while 15 CSV rows lack metadata and carry zero tokens.
  - Status 2025-10-08: Filtered blank metadata rows at CSV ingestion time (`scripts/usage-telemetry-diff.ts`); awaiting staged backfill + diff rerun to confirm missing window count drops.
  - Status 2025-10-08 (evening): Staging backfill (`usage:backfill --start 2025-09-01 --end 2025-10-01 --chunk-days 3 --label staging-groupby-v2`) processed 31 windows with metadata-populated rows (project/api key/user now set) yet telemetry diff still flags 46 missing DB windows because OpenAI API omits `service_tier`, and 48 DB-only rows remain from legacy null buckets.
  - Status 2025-10-08 (night): Admin API sample confirmed `service_tier=null`; parity diff updated to ignore service tier and skip blank-metadata rows. Post-cleanup backfill (`staging-post-servicetier`) plus bundled diff reports zero missing/mismatched windows (`audit/telemetry-audit/latest-staging.json`).

### 2. Ingestion Window & Scheduling
- **Action**: Design cron/backfill workflow that requests up to 30 days of data and prevents future gaps via daily pulls.
- **Risks**: API throttling, duplicate buckets.
- **Mitigation**: Leverage existing unique indexes, add ingestion telemetry (processed/failed counts), implement rate limiting.
- **Confidence Uplift Plan**:
  1. Apply migration `drizzle/0003_usage_event_windows.sql` in staging and document the run in `audit/migration-dry-run.md`.
  2. Execute a 48-hour cron rehearsal with `ENABLE_DAILY_USAGE_WINDOWS` enabled only in staging and capture telemetry in `audit/cron-dry-run/summary.md`.
  3. Review throttling metrics with Ops, recording adjustments in the cron runbook.
- **Confidence Target**: 7/10 once staging rehearsal metrics are approved.
  - Runbook: `audit/migration-prechecks/0003_usage_event_windows.md` defines staging apply/rollback steps (created 2025-10-02).
  - Operator artefacts: use `audit/cron-dry-run/notes-template.md` when capturing daily rehearsal notes and store completed copies under `audit/cron-dry-run/`.
  - Pending evidence: checkboxes in `audit/cron-dry-run/summary.md` (telemetry entries, notes, parity diff link) must be completed before raising confidence.

### 3. Per-Day Fetch Loop & Metadata Capture
- **Action**: Refactor `fetchOpenAIUsage` to iterate day-by-day, persisting midnight UTC buckets along with metadata (project_id, num_model_requests, service tier, cached token splits, api_key_id).
- **Risks**: Large payload parsing, schema drift, feature flag rollout.
- **Mitigation**: Add contract tests using recorded OpenAI responses, guard JSON parsing, deploy behind feature flag with monitoring.
- **Confidence Uplift Plan**:
  1. Capture golden admin usage fixtures for two high-volume tenants and store them under `audit/golden-fixtures/daily-usage/`.
  2. Add contract tests asserting bucket counts, metadata, and cached token splits using the new fixtures.
  3. Run a feature-flagged staging dry-run to confirm per-day buckets remain stable before broad rollout.
- **Confidence Target**: 7/10 after contract tests and staged rollout succeed.
  - **Fixture Requirements (2025-10-08 draft)**:
    - Two high-volume admin tenants spanning cached vs uncached token splits, saved as redacted JSON under `audit/golden-fixtures/daily-usage/<tenant>-<date>.json`.
    - Include metadata fields: `project_id`, `openai_api_key_id`, `openai_user_id`, `service_tier`, `cached_token` breakdowns, and `num_model_requests`.
    - Document sanitization steps in `audit/golden-fixtures/README.md` (remove user PII, round monetary fields to cents).
    - Use `audit/golden-fixtures/capture-template.md` to log each capture run and commit alongside sanitized fixtures.
    - Optional future enhancement: extend `scripts/summarize-daily-usage-fixture.ts` to accept expected totals file for automated regression detection.
  - **Contract Test Checklist**:
    - Add `tests/usageFetcherContract.test.ts` covering bucket counts, metadata preservation, cached token math, and dedupe invariants per fixture.
    - Verify schema guard emits no `SCHEMA_MISSING` issues when fixtures replayed via `replayDailyUsageFixture` helper.
    - Record test run output in `audit/golden-fixtures/test-run-logs/<timestamp>.md` (see `audit/golden-fixtures/test-run-logs/README.md`) and append summary to `memorybank/daily_usage_progress.md`.
    - Current status: `tests/usageFetcherContract.test.ts` exists as an environment-gated skeleton (set `DAILY_USAGE_CONTRACT_FIXTURES_READY=true` and optional `DAILY_USAGE_CONTRACT_FIXTURES_DIR` when fixtures are populated; remove the TODO once assertions are implemented). Shared helpers live under `tests/helpers/dailyUsageFixture.ts` and `tests/helpers/dailyUsageAssertions.ts`.
    - Expected totals comparison now supported via `DAILY_USAGE_CONTRACT_EXPECTED_TOTALS_DIR`/`DAILY_USAGE_CONTRACT_EXPECTED_TOLERANCE`; ensure fixtures carry corresponding files before raising confidence.

### 4. Schema & API Extensions
- **Action**: Add columns/migrations for new metadata, expose through `/api/usage`, ensure backward compatibility.
- **Risks**: Migration downtime, inconsistent environments.
- **Mitigation**: Ship additive migrations, backfill asynchronously, test in staging copy, keep rollback SQL ready.
- **Confidence Uplift Plan**:
  1. Execute the additive migrations against a staging clone and record timings/query plans in `audit/migration-dry-run.md`.
  2. Update `/api/usage` and downstream queries to expose the new metadata fields, with regression tests covering legacy clients.
  3. Run a staging load test using the updated API to verify index performance, logging findings in `docs/ui-performance-notes.md`.
- **Confidence Target**: 8/10 after staging validation and load testing.

### 5. Analytics UI & Export Updates
- **Action**: Update charts/tables to plot daily buckets, add filters (project/key/tier), paginate exports, memoize transforms.
- **Risks**: Performance regressions, UX mismatch.
- **Mitigation**: Add unit/interaction tests, run Storybook snapshots, get UX sign-off.
- **Confidence Uplift Plan**:
  1. Implement daily bucket charts, filters, and exports in the analytics UI using the new schema fields.
  2. Capture baseline Lighthouse + React Profiler snapshots before and after the changes, tracking deltas in `docs/ui-performance-notes.md`.
  3. Secure UX sign-off with annotated screenshots stored in `audit/ui-review/daily-usage/`.
- **Confidence Target**: 8/10 after profiling and UX review.

### 6. Parity Validation Pipeline
- **Action**: Build automated diff comparing Cogni Track API totals against OpenAI CSV totals per day; normalize timestamps to UTC and alert on variance.
- **Risks**: Timezone errors, alert fatigue.
- **Mitigation**: Document UTC contract, set conservative alert thresholds, add regression fixtures.
- **Confidence Uplift Plan**:
  1. Pilot the parity diff job on three archived CSV exports, storing variance reports in `audit/parity-pilot/`.
  2. Tune UTC normalization and alert thresholds with data QA, documenting decisions in `docs/daily_usage_cron_runbook.md`.
  3. Schedule the parity job in staging with alert routing to the on-call channel and capture outcomes in `memorybank/progress.md`.
- **Confidence Target**: 8/10 after regression tests and scheduled parity job run clean.

## Confidence Boosters (Cross-Cutting)
- Staging environment seeded with anonymized CSV data for repeatable verification.
- Ingestion telemetry dashboards (events ingested, skipped, pricing fallback usage) with alerting.
- Peer review + QA sign-off before enabling feature flag in production.
- Rollback checklist covering feature flag disable, migration revert, and cursor reset.

## Validation & Rollback Summary
- **Validation**: Unit + contract tests, migration dry runs, parity diff job, manual QA against OpenAI dashboard.
- **Rollback**: Disable feature flag, revert migrations/DB snapshot, truncate new columns if required, document in `audit/rollback_log.md`.

## Decisions (2025-10-01)
- **Cursor scope**: Track ingestion state per provider key by namespacing `openai_admin_cursors.endpoint` as `usage/completions:key_<providerKeyId>`. This keeps compatibility with the existing primary key while preventing different keys from clobbering one another. User-level backfill helpers will compose endpoint strings for each key.
- **Cron authentication**: Continue to require `Authorization: Bearer <CRON_SECRET>` in `src/app/api/cron/daily-usage/route.ts`. Configure Vercel Cron to send the header via project-level secret injection; retain the current fail-closed guard when `CRON_SECRET` is absent and log rejected attempts. For local/manual runs, provide CLI flag (`--cron-secret`) instead of bypassing authentication.
- **Retention window**: Maintain a 35-day rolling window (30-day dashboard parity + 5-day buffer for retries). Backfill jobs will prune rows older than 35 days once parity diff confirms data capture, keeping storage predictable.

## Implementation Sequence (Next Pass)
1. **Schema prep** – author additive migration introducing new columns (`window_start`, `window_end`, project/key/tier metadata, cached token fields) and update `openai_admin_cursors` helper to generate per-key endpoint identifiers. ✅ (2025-10-01 via `drizzle/0003_usage_event_windows.sql`)
2. **Fetcher refactor** – extract per-day helper, integrate feature flag, and extend telemetry payloads; wire into cron/backfill entry points. (Updated: `ENABLE_DAILY_USAGE_WINDOWS` flag drives per-day iteration with upserts + `updatedEvents`/`windowsProcessed` telemetry; cron route now emits aggregated telemetry + flag state, dashboards still pending.)
3. **Backfill tooling** – implement CLI/server action for historical load, including throttled loops and progress logging. (Updated: `scripts/usage-backfill.ts` adds chunked CLI with per-chunk telemetry; ingestion now uses insert+update fallback to avoid Drizzle index metadata bug; staging run blocked until `0003_usage_event_windows.sql` lands so `window_start`/metadata columns exist.)
   - **Confidence Uplift**: Rehearse backfill against staging snapshot using anonymized data, ensuring resumable cursors and logging checkpoints; archive run metrics and throttle traces in `audit/backfill-rehearsal/`.
4. **UI & API updates** – expose new fields in `/api/usage`, update analytics components, and add pagination/filters.
5. **Parity automation** – build diff job against OpenAI exports, integrate into monitoring before flipping the feature flag.

### Pending Validation
- Drizzle snapshot regeneration (`pnpm drizzle-kit generate`) awaiting staging environment with `DATABASE_URL` access.
- Stage telemetry diff via `tsx scripts/usage-telemetry-diff.ts` once migration 0003 lands (store JSON under `audit/telemetry-audit/`).

## Open Follow-Ups
- Verify Vercel Cron header injection in staging before production rollout.
- Define migration rollback SQL once column list is finalized.
- Operator runbook captured in `docs/daily_usage_cron_runbook.md`; still need parity alarm response section before production enablement.
