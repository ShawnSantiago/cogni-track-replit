# Telemetry Audit Evidence Log

## Objective
Maintain artefacts (screenshots, CSV excerpts, diff reports) that demonstrate parity between `usage_events` rows and OpenAI completions exports.

## Capture Guidance
- [ ] Store raw CSV snippets (anonymized) that highlight each required column.
- [ ] Attach screenshots from manual spot-checks covering three distinct project tiers.
- [ ] Document tool/version details for scripted diffs.
- [ ] Summarize findings and confidence adjustments in `memorybank/daily_usage_alignment_plan.md` after each audit.

## Scripted Diff Workflow
Use the helper to baseline multiple exports against staging:

```bash
# Example (writes diff JSON next to audit artefacts)
tsx scripts/usage-telemetry-diff.ts \
  --csv openAI-data/completions_usage_2025-09-01_2025-10-01.csv \
  --csv-dir openAI-data/additional_exports \
  --from 2025-09-01T00:00:00Z \
  --to 2025-10-01T00:00:00Z \
  --output audit/telemetry-audit/latest-diff.json
```

- Include `DATABASE_URL` in the environment to compare against staging; otherwise pass `--skip-db` to capture CSV-only totals.
- In sandboxed environments where `tsx` IPC is blocked, bundle the script first: `pnpm exec esbuild scripts/usage-telemetry-diff.ts --bundle --format=esm --platform=node --target=node20 --outfile=tmp/usage-telemetry-diff.mjs` and run `node tmp/usage-telemetry-diff.mjs <flags>`.
- Archive the generated JSON and any supporting notes in this directory with a timestamped filename.

### 2025-10-02 CSV Spot-Check Notes
- Project `proj_MhIbP1DyoTSqH6k2DtXVKvvV` (`incentivized-tier`, key `key_NF7ZLeXYAXECwqv7`) shows a single-request window on 2025-09-01 with 25,076 input / 4,737 output tokens (model `gpt-5-2025-08-07`).
- Same project in `default` tier (key `key_mPAw5OyZbONR4dAL`) records 274 requests on 2025-09-02 totaling 30,856,737 input / 447,569 output tokens, confirming cached tokens remain zero.
- No third service tier appears in the export; flagged as gap for future audits to capture additional tiers when available.

## Artefacts
- 2025-10-02: `latest.json` (CSV-only diff against completions_usage_2025-09-01_2025-10-01.csv; staging DB comparison skipped).

<!-- Add links to stored evidence files here. -->

