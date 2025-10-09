# Backfill Rehearsal Logs

## Purpose
Document staging backfill exercises validating the historical ingestion tooling under throttled conditions.

## Checklist
- [ ] Record anonymized dataset used and staging database snapshot hash.
- [ ] Capture throttle metrics (requests/minute, Retry-After headers) and link to logs.
- [ ] Store resumable cursor checkpoints for each provider key.
- [ ] Summarize discrepancies vs. OpenAI exports and note remediation steps.

## Runs
<!-- Add most recent run entries first. -->
- **2025-10-02 – staging-dry-run**
  - Range: 2025-09-03 → 2025-10-02 (3-day chunks)
  - Result: Chunks 0/2/4/5/6/7 reported `Cannot read properties of undefined (reading 'keyAsName')`; root cause traced to undefined Drizzle index metadata when using `onConflictDoUpdate`.
  - Next actions: Patch ingestion to use raw `ON CONSTRAINT usage_admin_bucket_idx` upsert and rerun once deployed (see 2025-10-02 follow-up run).
- **2025-10-02 – staging-dry-run (post-upsert fix)**
  - Range: 2025-09-30 → 2025-10-02 (single 3-day chunk)
  - Result: Backfill completed without errors; windows processed 1, no new buckets (OpenAI returned no rows for range but upsert succeeded).
  - Next actions: Re-run full 30-day rehearsal after deploying new code and confirming staging secrets.
- **2025-10-02 – staging-dry-run (insert/update fallback)**
  - Range: 2025-09-03 → 2025-10-02 (3-day chunks)
  - Result: Insert attempts now surface Neon error `column "window_start" ... does not exist`; staging database missing migration `0003_usage_event_windows.sql`, so historical windows cannot be stored yet.
  - Next actions: Apply pending migration in staging, rerun rehearsal, and verify updates succeed under the new insert+update fallback.
