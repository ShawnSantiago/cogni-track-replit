# Golden Fixture Test Run Logs

Use this directory to capture outputs when replaying daily usage fixtures through contract tests.

Each log should include:
- Command executed (e.g. `pnpm vitest run tests/usageFetcherContract.test.ts`)
- Fixture files used (`daily-usage/<tenant>-<startedAt>.json`)
- Test outcome summary (pass/fail counts)
- Any anomalies (unexpected metadata deltas, manual fallback usage)
- Links to related telemetry artefacts or issues created

File naming: `YYYY-MM-DDThh-mm-ssZ.md` to align with audit timestamps.

After logging:
1. Update `memorybank/daily_usage_progress.md` with a brief summary of the run.
2. Attach the log path when updating confidence in `memorybank/daily_usage_alignment_plan.md` Workstream 3.
3. Confirm all TODO assertions in `tests/usageFetcherContract.test.ts` are satisfied (expected totals via `DAILY_USAGE_CONTRACT_EXPECTED_TOTALS_DIR`/`--expected`, dedupe invariants, cached vs uncached splits, pricing fallback telemetry; set `DAILY_USAGE_CONTRACT_EXPECTED_TOLERANCE` if non-zero variance allowed) before marking the run complete.
