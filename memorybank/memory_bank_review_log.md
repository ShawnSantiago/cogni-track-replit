2025-09-29 – Logged ingestion telemetry, pricing, and admin-mode context updates.
2025-09-29 – Documented per-key OpenAI usage mode toggle planning and schema changes.
2025-09-29 – Reviewed memory bank after adding admin API fixture progress note.
2025-09-29 – Logged progress update after creating admin schema design document.
2025-09-29 – Recorded spike progress and verified memory consistency after adding ingestion harness docs.
2025-09-29 – Reviewed memory bank after adding security controls + integrations context.
2025-09-29 – Reviewed memory bank after rewriting admin plan with new confidence metrics and references.
2025-09-29 – Reviewed memory updates after spike report archival, review scheduling, and migration draft documentation.
2025-09-29 – Memory review after logging spike/migration checklists; pending command execution noted for human follow-up.
2025-09-30 – Reviewed memory after adjusting spike harness dedupe normalization requirements.
2025-09-30 – Memory review after capturing latest spike checksum and artifact updates.
2025-09-30 – Memory review after adjusting migration pre-check workflow.
2025-09-30 – Memory review after updating migration pre-check command list.
2025-09-30 – Memory review after executing migration pre-check audit commands and capturing outputs.
2025-09-30 – Memory review after boosting migration pre-check confidence artefacts.
2025-09-30 – Memory review after updating schema/relations for OpenAI admin support.
2025-09-30 – Memory review after schema parity verification and audit note update.
2025-10-01 – Memory review after documenting admin bucket upsert constraint widening and spike metadata assertions.
2025-10-01 – Memory review after logging cron telemetry instrumentation and creating audit evidence stubs.
2025-10-01 – Memory review after landing backfill CLI, usage fetcher window overrides, and updating plan confidence artefacts.
2025-10-01 – Memory review after adding backfill confidence uplift tasks and rehearsal audit log scaffolding.
2025-10-02 – Memory review after fixing usage event upsert constraint error and documenting staging rehearsal outcomes.
2025-10-02 – Memory review after switching to insert/update fallback and noting staging schema gap (`window_start` missing).
2025-10-02 – Memory review after logging local migration application status and identifying provider key seeding blocker for backfill rehearsals.

2025-10-02 – Memory review after capturing latest PR feedback summary and remediation plan (pending implementation).
2025-10-02 – Memory review after updating usage fetcher upsert helper, migration/index hardening, and analytics toggle accessibility fixes.
2025-10-02 – Memory review assessing daily_usage_alignment_plan status and outstanding validation tasks.
2025-10-02 – Memory review after aligning drizzle/Next configs with Vercel build feedback and logging pending tsc issues for human follow-up.
2025-10-02 – Memory review after fixing usage fetcher conflict payload typing and validating with tsc.
2025-10-02 – Memory review after reconciling usage-fetcher merge, preserving typed conflict updates with manual fallback, and re-running tsc.
2025-10-02 – Memory review after renaming constraint helper export and tightening fallback tests to satisfy tsc.
2025-10-02 – Memory review after implementing usage ingestion constraint fallback, adding regression coverage, and documenting monitoring guidance.
2025-10-02 – Logged staging migration runbook, telemetry diff tooling, and cron runbook updates; pending parity alarm section.
2025-10-02 – Memory review after resolving drizzle.config.ts conflict and updating env fallback documentation.
2025-10-02 – Recorded telemetry diff run (CSV-only) and archived results in audit/telemetry-audit/latest.json; staging DB comparison pending schema update.
2025-10-02 – Logged manual CSV spot-check notes for default vs incentivized tiers and documented esbuild bundling workaround in audit/telemetry-audit/README.md.
2025-10-02 – Authored staging runbook for migration 0003_usage_event_windows and queued follow-up telemetry diff post-apply.
2025-10-02 – Ran staging telemetry diff (latest-staging.json); DB comparison succeeded after removing channel binding but 46 windows still missing pending backfill.
2025-10-07 – Captured staging diff (2025-10-07T14-23-48Z.json); Neon HTTP fetch failure still blocks DB comparison, leaving 46 windows missing.
2025-10-07 – Telemetry diff retry (2025-10-07T14-24-48Z.json) failed with Neon password auth; staging credentials need reissue before DB comparison.
2025-10-07 – Admin usage backfill hit 'undefined' column errors from usage_admin_bucket_idx metadata; planning manual dedupe fallback before rerunning telemetry diff.
2025-10-07 – Confirmed usage ingestion guard + manual dedupe fallback fixed the undefined column failure; local backfill (`pnpm usage:backfill --start 2025-09-15 --end 2025-09-16`) stored two windows, staging diff rerun pending new credentials.
2025-10-07 – Memory review after restoring Neon access, running dry-run/full telemetry diffs via esbuild bundle (artifacts 2025-10-07T22-44-11Z-dryrun.json / 2025-10-07T22-44-28Z-staging.json, SHA256 82c61d54326a363615fe257ee7e0ae1f778c6a7ba5ee28ebd93cb3245d18a019), and logging prerequisite checklist for nightly monitoring; confidence stays at 6/10 until instrumentation verifies the 46-missing-window gap closes.
2025-10-07 – Memory review after adding persistence counters to usage fetcher/cron/backfill telemetry, publishing synthetic fallback sample (`audit/telemetry-audit/synthetic-manual-fallback.json`), and checking off telemetry diff checklist items; confidence remains 6/10 pending live backfill validation of the 46-window gap.
2025-10-07 – Memory review after grouping the 46 missing staging windows (summary in `audit/telemetry-audit/missing-windows-summary-2025-10-07.md`); blank metadata rows appear zeroed while real gaps map to project `proj_MhIbP1DyoTSqH6k2DtXVKvvV` (keys `key_mPAw5OyZbONR4dAL`, `key_NF7ZLeXYAXECwqv7`). Confidence still 6/10 until rerun confirms manual fallback counters drop.
2025-10-08 – Logged context gap `GAP-2025-10-07-DAILY-USAGE-PARITY`, scheduled quarterly memory bank sweep (first business day each quarter) to reconcile `memorybank/progress.md` with `/audit` artefacts, and noted pending validation for 2025-10-10 diff rerun.
2025-10-08 – Memory review after running admin grouping backfill, cleaning legacy blanks, bundling diff script, and confirming `latest-staging.json` reports zero missing/mismatched windows; parity gap closed and context log updated.
2025-10-08 – Recorded verify-schema backfill check and staging migration push; schema dump stored under `audit/migration-prechecks/` to confirm window columns/index present.
2025-10-09 – Logged anthropic usage documentation gap (GAP-2025-10-09-ANTHROPIC-DOCS) after unsuccessful Context7 lookup; awaiting official API reference before proceeding with integration plan.
2025-10-09 – Retrieved Anthropic usage API docs via Context7 (`/llmstxt/anthropic_llms_txt`); closed GAP-2025-10-09-ANTHROPIC-DOCS and captured endpoints for usage and cost reports.
