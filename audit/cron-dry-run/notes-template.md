# Daily Usage Cron Rehearsal Notes (Template)

> Replace bracketed sections before committing. One file per day/run is recommended, e.g. `notes-2025-10-09.md`.

- **Run timestamp (UTC)**: [2025-10-09T00:00Z]
- **Trigger mode**: [Manual curl | Scheduled Vercel Cron]
- **Feature flag state**: [ENABLE_DAILY_USAGE_WINDOWS=true]
- **Windows processed**: [count]
- **Updated events**: [count]
- **Issues by code**: [JSON blob]
- **Retry-After headers**: [none | details]
- **Manual fallback usage**: [0 windows]
- **Notable logs**: [link to Vercel/Neon logs]
- **Parity diff result**: [link to audit/telemetry-audit/...]
- **Follow-ups**: [tickets, owners, due dates]

Additional context / operator comments:
- [ ] Verify curl smoke log stored in `audit/cron-dry-run/smoke-*.log`
- [ ] Append telemetry JSON snippet to `audit/cron-dry-run/summary.md`
- [ ] Update `memorybank/daily_usage_progress.md` if remediation required
