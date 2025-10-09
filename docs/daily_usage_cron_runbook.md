# Daily Usage Cron Runbook

## Purpose
Guide operators through staging validation of the daily usage cron job before enabling the feature flag in production.

## Prerequisites
- `DATABASE_URL` and `CRON_SECRET` for the staging environment available locally.
- Feature flag `ENABLE_DAILY_USAGE_WINDOWS` enabled in staging (`vercel env pull` or dashboard check).
- Access to staging logs (Vercel or Neon) for telemetry review.

## Pre-Run Validation
1. Export required secrets:
   ```bash
   export DATABASE_URL="postgres://..."
   export CRON_SECRET="<staging-secret>"
   ```
2. Smoke test authentication:
   ```bash
   curl -i \
     -X POST \
     -H "Authorization: Bearer ${CRON_SECRET}" \
     -H "Content-Type: application/json" \
     https://staging.cogni-track.app/api/cron/daily-usage \| tee audit/cron-dry-run/smoke-$(date -u +%Y%m%dT%H%M%SZ).log
   ```
   - Expect `200 OK` with a JSON payload. A `401` indicates missing/incorrect secret; resolve before scheduling.
3. Confirm flag state in response (`flags.enableDailyUsageWindows === true`).

## 48-Hour Dry-Run Checklist
1. Schedule the cron (Vercel dashboard) or trigger manually every 24h using the curl command above.
2. After each run, capture telemetry:
   - Append the JSON body to `audit/cron-dry-run/summary.md` under **Runs**.
   - Record `windowsProcessed`, `updatedEvents`, `issuesByCode`, and any throttling headers.
3. Monitor Neon query logs for `usage_events` writes scoped to the expected window range.
4. If throttling is observed, verify rate-limit backoff logs and adjust scheduling cadence.

## Post-Run Verification
- Compare totals with OpenAI exports using `tsx scripts/usage-telemetry-diff.ts` (with staged `DATABASE_URL`).
- Ensure no `simulatedKeyCount` entries appear in telemetry.
- Update `memorybank/daily_usage_alignment_plan.md` confidence scores once artefacts are archived.

## Parity Alarm Response
1. Review the parity diff artefact linked in the alert (stored under `audit/telemetry-audit/`). Confirm whether variance exceeds the documented threshold (currently 2% token delta or any missing window).
2. If variance is legitimate, pause the cron in staging to prevent further divergence. Capture `usage-fetcher` logs and note affected projects/keys in `audit/cron-dry-run/notes-<date>.md`.
3. Escalate to data QA via the on-call channel with:
   - Timestamp of the failing cron run
   - Relevant `issuesByCode` entries and affected window range
   - Link to the diff JSON and Neon query logs
4. After remediation, rerun the cron manually, re-run the parity diff, and annotate recovery details in `memorybank/daily_usage_progress.md`.
5. If variance was false-positive, update alert thresholds in `docs/daily_usage_cron_runbook.md` and record the rationale in `audit/cron-dry-run/notes-<date>.md` to prevent recurrence.

## Rollback Procedure
- Disable the cron schedule in Vercel.
- Reset `ENABLE_DAILY_USAGE_WINDOWS` flag to `false` in staging environment variables.
- Truncate any partially ingested staging rows if needed using `DELETE FROM usage_events WHERE window_start >= '<dry-run-start>'`.
- Document rollback actions in `audit/rollback_log.md` with timestamps and log references.

## Evidence Storage
- Curl smoke-test logs → `audit/cron-dry-run/smoke-*.log`
- Telemetry JSON snapshots → append to `audit/cron-dry-run/summary.md`
- Diff outputs → `audit/telemetry-audit/<timestamp>-cron-diff.json`
- Operator notes → `audit/cron-dry-run/notes-<date>.md`
