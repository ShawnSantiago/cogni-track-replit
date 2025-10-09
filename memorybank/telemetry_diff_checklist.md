Telemetry Diff Prerequisites Checklist
======================================

- [x] Neon staging credentials confirmed in `.env.local`.
- [x] Staging usage snapshot captured (filename + checksum noted).
- [x] Dry-run diff executed with output archived under `audit/telemetry-audit/` and checksum recorded.
- [x] Full staging diff executed with output archived and checksum recorded.
- [x] Temporary telemetry logging/dashboard toggle enabled for upcoming backfill cycles (structured logs now emit persistence counters).
- [x] Synthetic test dataset queued for next pipeline dry-run to validate guard behavior on metadata-rich buckets (`audit/telemetry-audit/synthetic-manual-fallback.json`).
