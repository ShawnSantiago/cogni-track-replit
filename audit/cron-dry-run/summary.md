# Daily Usage Cron Dry-Run Summary

## Purpose
Track 48-hour staging executions of the daily usage cron when `ENABLE_DAILY_USAGE_WINDOWS` is enabled for telemetry validation without impacting production.

## Checklist
- [ ] Record start/end timestamps for each staging run.
- [ ] Confirm `CRON_SECRET` header is accepted in staging via `curl` smoke test before scheduling (see `docs/daily_usage_cron_runbook.md`).
- [ ] Capture `telemetry` payload from `/api/cron/daily-usage` response and append JSON snippet below.
- [ ] Note throttling or Retry-After headers observed; link to logs if available.
- [ ] Verify no simulated keys (`simulatedKeys === 0`).
- [ ] Verify `windowsProcessed` matches expected day count × key count.
- [ ] File follow-up issues for any non-zero `issuesByCode` entries.

## Runs
<!-- Append newest entries to the top of this section. -->

