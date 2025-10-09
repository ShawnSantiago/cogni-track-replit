## Status Overview (as of 2025-10-08)
- **Telemetry parity**: ✅ Complete — staging diff clean (`audit/telemetry-audit/latest-staging.json`).
- **Backfill tooling (CLI + metadata)**: ✅ Complete — daily windows populate with project/API/user context.
- **Constraint upsert via index**: ✅ Complete — Drizzle metadata now surfaces expression columns, upsert path active.
- **Cron rehearsal (48-hour staging run)**: ⏳ Pending — run cron job with monitoring per plan Workstream 2.
- **UI/API surfacing of new fields**: ⏳ Pending — dashboards and `/api/usage` not yet updated for window metadata.

# Daily Usage Progress Log

## 2025-10-09
- Analytics UX Phase 1 implemented: SkipLink component added and wired in layout with main content region focusable via id="main-content".
- Analytics page uses role="region" with aria-labelledby on page title; sections maintain aria-labelledby patterns.
- AdvancedFilters: focus moves to panel on expand; aria-live polite status for apply/clear; date range validation with aria-invalid and inline error messaging; Apply disabled on invalid.
- UsageSummary: numeric emphasis uses text-primary; empty state uses role="status" with token-based surfaces.
- UsageChart: cost line uses accent token; tooltip surfaces tokenized; negative values clamped to 0.
- NavMenu: active state matches nested routes via pathname.startsWith.
- Standardized empty/filtered states across dashboard components with role="status", aria-live, and token surfaces (FilterableAnalyticsDashboard, Analytics empty state, DataAggregation, ExportControls).
- Light/dark theming aligned to tokens; contrast sanity checked in UI tokens.

## 2025-10-08
- Exposed daily window metadata end-to-end: `/api/usage` now returns window start/end + OpenAI identifiers, analytics dashboard gained project/API key/service tier filters, and exports include the new columns for contract coverage.
- Added compatibility fallback for environments missing the new `usage_events` columns so `/api/usage` and the analytics dashboard gracefully return legacy rows instead of failing at query time.
- Applied staging migration `drizzle/0003_usage_event_windows.sql` (`pnpm drizzle-kit push`, log archived under `audit/migration-prechecks/0003_push_20251009T001627Z.log`), introspected schema snapshot to `audit/migration-prechecks/post-window-snapshot.json`, and captured `usage_events` table/index details. Schema guard dry-run (`scripts/usage-backfill.ts`) still fails with Drizzle `usage_admin_bucket_idx` expression columns resolving to `undefined`, so manual dedupe fallback needs recheck before cron rehearsal.
- Disabled constraint-based upsert by default (`ENABLE_USAGE_ADMIN_CONSTRAINT_UPSERT=false`) to avoid Drizzle `undefined` expression targets, reran verify-schema backfill (`audit/migration-prechecks/0003_verify_schema_backfill.log`) with manual dedupe succeeding, and regenerated telemetry diff (`audit/telemetry-audit/latest-staging.json`) showing zero missing rows post-migration.
- Enabled `usage_admin_bucket_idx` consumption by tolerating Drizzle SQL expressions, so constraint-based upsert works again (`src/lib/usage-fetcher.ts`).
- Hardened admin pagination sanitization to reject whitespace tokens and restored manual fallback telemetry (`tests/usageFetcherSecurity.test.ts`, `tests/usageFetcherConstraintFallback.test.ts`).
- Updated provider key API responses to share typed payloads and revalidated with `npx tsx tests/runAllTests.ts`.
- Bundled telemetry diff via esbuild (`npx esbuild scripts/usage-telemetry-diff.ts --bundle --outfile=tmp/usage-telemetry-diff.mjs --platform=node --format=esm`).
- Cleaned legacy `usage_events` rows lacking metadata using `tmp/cleanup_usage_events.sql` (deleted 16 blanks) and reran staging backfill (`pnpm usage:backfill --start 2025-09-01 --end 2025-10-01 --chunk-days 3 --label staging-post-servicetier`).
- Generated parity diff with bundled script (`direnv exec . node tmp/usage-telemetry-diff.mjs ...`); `audit/telemetry-audit/latest-staging.json` now reports zero missing/mismatched windows.
- Confirmed parity closure in memory bank (`memorybank/progress.md`) and closed context gap `GAP-2025-10-07-DAILY-USAGE-PARITY`.
- Documented golden fixture requirements under `audit/golden-fixtures/README.md` and added cron rehearsal logging template instructions in `audit/cron-dry-run/summary.md`.
- Expanded `audit/golden-fixtures/README.md` with fixture capture workflow (script pointer) and env flags (`DAILY_USAGE_CONTRACT_FIXTURES_READY`, `DAILY_USAGE_CONTRACT_FIXTURES_DIR`) required before running contract tests.
- Added `tests/usageFetcherContract.test.ts` skeleton gated behind `DAILY_USAGE_CONTRACT_FIXTURES_READY` plus loader utilities (`tests/helpers/dailyUsageFixture.ts`) and assertion helpers (`tests/helpers/dailyUsageAssertions.ts`) to validate metadata/tokens/windows before final contract assertions land.
- Authored sanitization helper `scripts/sanitize-admin-usage-fixture.ts` and documented usage in `audit/golden-fixtures/README.md` (supports optional `DAILY_USAGE_SANITIZE_SALT`).
- Added `audit/golden-fixtures/capture-template.md` to standardize fixture capture logs alongside sanitized outputs.
- Flagged outstanding cron rehearsal artefacts via checklist in `audit/cron-dry-run/summary.md`; Workstream 2 confidence blocked until telemetry + notes + parity diff captured.
- Documented remaining contract test TODOs (token totals, dedupe invariants, cached split validation, pricing fallback checks) within `tests/usageFetcherContract.test.ts` and `audit/golden-fixtures/test-run-logs/README.md`.
- Added summary CLI (`scripts/summarize-daily-usage-fixture.ts`) to verify token totals and window aggregation before committing fixtures; referenced in `audit/golden-fixtures/README.md`.
- Added TODO to summary CLI to support comparison against expected totals file for regression detection before commits.
- Introduced `audit/golden-fixtures/expected-totals-template.json` so fixture captures can predefine totals ahead of the planned summary CLI comparison.
- Noted pending `--expected` flag in `scripts/summarize-daily-usage-fixture.ts` (will consume expected totals template) for future regression guard.
- Implemented `--expected`/`--tolerance` support in `scripts/summarize-daily-usage-fixture.ts` and documented new workflow in `audit/golden-fixtures/README.md` + template notes.
- Contract test now consumes expected totals (via `DAILY_USAGE_CONTRACT_EXPECTED_TOTALS_DIR` + tolerance env) and compares aggregated summaries before other TODO assertions.
- Updated contract test TODOs/doc guidance to focus remaining work on dedupe, cached-token split, and pricing fallback validation.
- Added dedupe invariant assertion (`assertNoDuplicateWindows`) to contract test scaffolding; fixtures will now fail if duplicate `(window, project, key, user, models)` buckets appear.
- Ran staging cron smoke test (`curl` against cogni-track-replit.vercel.app/api/cron/daily-usage`); logged response in `audit/cron-dry-run/smoke-20251008T200417Z.log` and created operator notes `audit/cron-dry-run/notes-2025-10-08.md` ahead of full 48h rehearsal.

## 2025-10-07
- Updated telemetry diff script to ignore blank metadata rows and documented change in `memorybank/daily_usage_alignment_plan.md`.
- Captured staging diff (`audit/telemetry-audit/2025-10-07T22-44-28Z-staging.json`) showing 46 missing windows; identified service tier as only remaining CSV-only dimension.
- Logged gap in `memorybank/context_gaps_log.md` and scheduled follow-up diff after migration + regrouping.

## 2025-10-02
- Executed staging backfill (`usage:backfill --start 2025-09-01 --end 2025-10-01 --chunk-days 3 --label staging-repair`) to populate window metadata; recorded results in `audit/backfill-rehearsal/`.
- Initial telemetry diff reconciliation captured in `audit/telemetry-audit/latest.json`; flagged missing windows awaiting admin grouping support.
