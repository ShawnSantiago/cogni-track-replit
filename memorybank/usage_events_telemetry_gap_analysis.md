# Usage Telemetry Gap Analysis

## Sources Compared
- **Internal schema**: `src/db/schema.ts` definition for `usage_events` plus downstream transformations in `src/lib/usage-fetcher.ts`.
- **OpenAI export**: `openAI-data/completions_usage_2025-09-01_2025-10-01.csv` (daily completions report).

## Current Internal Columns
`usage_events` stores:
- `id` (serial)
- `keyId`
- `model`
- `tokensIn`
- `tokensOut`
- `costEstimate`
- `timestamp`

Derived data in app UI relies only on these fields; cost is inferred via `calculateCost` when OpenAI omits explicit totals.

## OpenAI CSV Columns (Daily Buckets)
- `start_time`
- `end_time`
- `start_time_iso`
- `end_time_iso`
- `project_id`
- `num_model_requests`
- `user_id`
- `api_key_id`
- `model`
- `batch`
- `service_tier`
- `input_tokens`
- `output_tokens`
- `input_cached_tokens`
- `input_uncached_tokens`
- `input_text_tokens`
- `output_text_tokens`
- `input_cached_text_tokens`
- `input_audio_tokens`
- `input_cached_audio_tokens`
- `output_audio_tokens`
- `input_image_tokens`
- `input_cached_image_tokens`
- `output_image_tokens`

## Gaps Identified
- **Temporal granularity**: CSV represents midnight-to-midnight buckets via `start_time_iso`/`end_time_iso`. Internal events only retain a single `timestamp` (from API response). No explicit window or duration is persisted.
- **Project & key context**: Internal schema lacks `project_id`, `api_key_id`, and `user_id`, preventing per-project/key filtering.
- **Request counts**: No equivalent to `num_model_requests`.
- **Tier/batch**: `service_tier` and `batch` columns are absent; UI cannot distinguish incentivized tiers vs default.
- **Cached token breakdown**: Internal schema collapses `input_cached_tokens`, `input_uncached_tokens`, `input_cached_text_tokens`, etc., into a single `tokensIn` value, losing cache/uncached insight.
- **Modalities**: Audio/image-specific token columns are dropped, so multi-modal usage cannot be surfaced or costed accurately.
- **Windowed cost**: CSV omits cost; internal system derives cost using static pricing tables. Cached token discounts / tier pricing adjustments are not accounted for.

## Additional Observations
- CSV rows omit explicit `cost`; OpenAI dashboard likely applies tier-aware pricing. To match totals we must capture tier + cached breakdowns and revise pricing model.
- Our unique index `usage_admin_bucket_idx` dedupes by `(timestamp, model, keyId)` which is insufficient once we store per-day buckets for multiple keys/projects with identical timestamps.
- To preserve auditability we should treat `start_time_iso`/`end_time_iso` as canonical identifiers for aggregation windows.

## Next Questions
1. Do other OpenAI exports introduce more columns (e.g., `input_cached_image_tokens` vs `input_cached_audio_tokens`)? Need wider sample set.
2. Should we represent cost per row or compute at query time using captured tier + cached splits?
3. How do we map `batch` and `service_tier` into customer-facing concepts?

## Tooling Updates (2025-10-02)
- Added `scripts/usage-telemetry-diff.ts` to compare OpenAI CSV exports against staging `usage_events` buckets across metadata dimensions. Requires staging `DATABASE_URL` (or run with `--skip-db` for CSV-only summaries) and stores diff artefacts under `audit/telemetry-audit/`.
