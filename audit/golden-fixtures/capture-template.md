# Daily Usage Fixture Capture – Template

> Duplicate this file as `capture-<tenant>-<timestamp>.md` when recording a new fixture. Replace bracketed values and remove guidance after completion.

- **Capture date (UTC)**: [2025-10-09]
- **Tenant/project identifier**: [proj_xxx]
- **OpenAI org/project env vars**: [OPENAI_ORGANIZATION=..., OPENAI_PROJECT=...]
- **Source command**: `OPENAI_API_KEY=... OPENAI_ORGANIZATION=... OPENAI_PROJECT=... tsx scripts/admin-usage-sample.ts > tmp/raw-fixture.json`
- **Sanitization command**: `DAILY_USAGE_SANITIZE_SALT=... tsx scripts/sanitize-admin-usage-fixture.ts tmp/raw-fixture.json audit/golden-fixtures/daily-usage/<tenant>-<date>.json`
- **Hashed fields verified**: [yes/no]
- **Metadata present (project/api key/user/service tier/cached tokens)**: [summary]
- **Stored output path**: `audit/golden-fixtures/daily-usage/<tenant>-<date>.json`
- **Notes / anomalies**: [freeform]

Checklist:
- [ ] Raw fixture generated and stored securely (not committed).
- [ ] Sanitized output saved under `audit/golden-fixtures/daily-usage/`.
- [ ] Capture log committed alongside sanitized fixture.
- [ ] `test-run-logs/` updated after contract test execution.
