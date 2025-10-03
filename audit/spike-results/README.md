# Admin Ingestion Spike

This spike replays the fixtures in `../admin-api-fixtures/` through a standalone TypeScript harness (`spikes/admin_ingestion_spike.ts`).

## Runbook

```bash
pnpm exec tsx spikes/admin_ingestion_spike.ts
```

### Expected Console Summary

```json
{
  "reportPath": "audit/spike-results/admin_ingestion_spike.json",
  "usageSummary": {
    "totalBuckets": 1,
    "totalRawEvents": 2,
    "totalDedupedEvents": 1,
    "tokensIn": 2849,
    "tokensOut": 912,
    "costEstimate": 0.003918,
    "cursor": {
      "endpoint": "usage/completions",
      "nextPage": null,
      "lastSyncedAt": "<execution timestamp>",
      "hasMore": false
    }
  },
  "relationshipIssues": []
}
```

The generated report includes detailed event payloads (`dedupedUsage`) plus referential integrity diagnostics.

## Assumptions & Follow-ups

- Fixtures are sanitized snapshots dated 2025-09-29; rerun the spike whenever fixtures change.
- Cursor metadata uses the execution timestamp; production implementation should persist `window_start`/`window_end` from scheduler context.
- Extend the harness with additional fixture permutations (e.g., multiple pages) before shipping ingestion jobs.
- `usage_completions_fixture_dual.json` validates that per-project/per-tier metadata produces distinct buckets; the spike now fails fast if those buckets disappear after dedupe.
- Upcoming work: add replay coverage for embeddings, moderations, images, audio (speeches + transcriptions), vector stores, code interpreter sessions, and daily costs. Each new fixture should register in `ENDPOINTS.md` and be incorporated into the dedupe assertions prior to cron enablement.
## Extending the Spike for New Usage Fixtures

1. Drop the sanitized fixture file(s) into `audit/admin-api-fixtures/` following the naming scheme above and recompute `CHECKSUMS.sha256`.
2. Update `spikes/admin_ingestion_spike.ts` to load each new fixture (e.g., `usage_embeddings_fixture.json`) and feed the payload through the normalization/dedupe helpers.
3. Assert bucket counters expected by each endpoint (tokens, images, characters, seconds, usage_bytes, num_sessions, amount) and surface them inside the JSON report under distinct keys.
4. Capture before/after console output in `ADMIN_INGESTION_SPIKE_NOTES.md` so reviewers can trace fixture provenance and dedupe behaviour.
5. Re-run the spike; verify the report includes every endpoint and that relationship diagnostics remain empty before rolling the cron jobs forward.
