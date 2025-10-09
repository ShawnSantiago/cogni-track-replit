# Ingestion readiness assessment

## Overview
A review of fixtures, spike outcomes, and rate-limit planning indicates that ingestion endpoints are not yet ready for implementation. Several gaps in data consistency, pagination coverage, and operational guardrails must be addressed to ensure a stable rollout.

## Fixture completeness
- Fixtures now reuse the canonical project identifiers (`proj_abc123`, `proj_xyz890`), eliminating the placeholder drift noted previously. A validator still needs to fail fast when future fixtures introduce unknown IDs.
- **Action:** Wire the spike-time validator so any usage/cost `project_id` not present in `projects_list_fixture.json` aborts the run.

## Spike analysis
- The spike report now processes multi-page fixtures (`has_more=true` with `_page2` follow-ups), aggregates per-endpoint metrics, and scans for unknown project, service account, key, and certificate references (all clean in the latest run).
- **Action:** Keep the new pagination + FK checks under CI so future fixture changes surface regressions immediately.

## Rate-limit & write-path plan
- A shared token-bucket throttle now caps admin calls via `OPENAI_ADMIN_REQUESTS_PER_MINUTE`/`OPENAI_ADMIN_MAX_BURST`, and `Retry-After` headers are honored in the exponential backoff logic.
- Scheduler coordination across endpoints still needs integration once additional admin sync jobs ship.
- Throttle validated against a mocked admin endpoint (`audit/mock_rate_limit.log` captures 429 + Retry-After handling); ops guidance still needs to incorporate configuration defaults for production.
- Insert/upsert path replaced with insert+update fallback to avoid Drizzle index metadata gaps; unit coverage needed to guard against regressions.
- **Action:** Fold the mock run results into the operations runbook, add tests around the fallback path, and ensure future sync jobs reuse the shared pacing helper.

## Schema readiness
- Staging database is missing migration `0003_usage_event_windows.sql`, so `window_start`, metadata columns, and the updated unique index are absent. Backfill runs fail with `column "window_start" ... does not exist` until the migration lands.
- **Action:** Apply `0003_usage_event_windows.sql` (plus dependent migrations) in staging/prod before rerunning cron or backfill rehearsals; add a preflight check that validates the schema version before ingestion starts.

## Readiness summary
Fixtures and spike tooling provide a baseline, but ingestion endpoints should not proceed until referential integrity, pagination coverage, schema parity (including `window_start` columns), and comprehensive rate limiting are implemented. Addressing the identified actions—and confirming environments have migrated schemas—will improve stability and scalability for production ingestion.
