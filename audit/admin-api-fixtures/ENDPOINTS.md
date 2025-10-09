# OpenAI Admin API Surface (2025-09 Snapshot)

## Usage & Telemetry

| Endpoint | Method | Purpose | Key Query Params | Response Highlights | Rate Guidance | Fixture |
| --- | --- | --- | --- | --- | --- | --- |
| /v1/organization/usage/completions | GET | Aggregated token and cost buckets per organization/project | start_time, end_time, bucket_width, limit, page, group_by (project_id, user_id, api_key_id, model, batch), batch filter | `data[]` usage buckets, text/audio token counters, cached token fields, `has_more`, `next_page` | Org-level endpoints currently 60 req/min shared across admin surface | ✅ `usage_completions_fixture.json`, `usage_completions_fixture_dual.json` |
| /v1/organization/usage/embeddings | GET | Vector ingestion token usage | start_time, end_time, bucket_width, limit, page, group_by (project_id, user_id, api_key_id, model) | `data[]` buckets with `organization.usage.embeddings.result` (input_tokens, num_model_requests) | Same shared pool; keep <30 RPM until dedupe proven | ✅ `usage_embeddings_fixture.json` |
| /v1/organization/usage/moderations | GET | Moderation call volume + tokens | start_time, end_time, bucket_width, limit, page, group_by (project_id, user_id, api_key_id, model) | Token counts per moderation result, `num_model_requests` | Treat as same usage budget (prefetch low frequency) | ✅ `usage_moderations_fixture.json` |
| /v1/organization/usage/images | GET | Image generations/edits per project | start_time, end_time, bucket_width, limit, page, group_by (project_id, user_id, api_key_id, model, size, source), sizes, sources | `organization.usage.images.result` exposing `images`, `num_model_requests`, size/source breakdown | Larger payloads when grouping by size; rate limit 30 RPM suggested | ✅ `usage_images_fixture.json` |
| /v1/organization/usage/audio_speeches | GET | Text-to-speech characters + requests | start_time, end_time, bucket_width, limit, page, group_by (project_id, user_id, api_key_id, model) | `characters`, `num_model_requests` fields | Use same 60 RPM pool; expect low volume | ✅ `usage_audio_speeches_fixture.json` |
| /v1/organization/usage/audio_transcriptions | GET | Speech-to-text processing seconds | start_time, end_time, bucket_width, limit, page, group_by (project_id, user_id, api_key_id, model) | `seconds`, `num_model_requests` per bucket | Rate expectations mirror audio_speeches | ✅ `usage_audio_transcriptions_fixture.json` |
| /v1/organization/usage/vector_stores | GET | Vector storage consumption in bytes | start_time, end_time, bucket_width, limit, page, group_by (project_id), project_ids | `usage_bytes` per bucket | Payload is light; still under admin pool | ✅ `usage_vector_stores_fixture.json` |
| /v1/organization/usage/code_interpreter_sessions | GET | Notebooks/code interpreter session counts | start_time, end_time, bucket_width, limit, page, group_by (project_id), project_ids | `num_sessions` per bucket | Similar throttling; expect sparse data | ✅ `usage_code_interpreter_fixture.json` |
| /v1/organization/costs | GET | Daily cost rollups per line item/project | start_time, end_time, bucket_width(=1d), limit (≤180), page, group_by (project_id, line_item), project_ids | `organization.costs.result` with `amount { value, currency }` | Costs endpoint shares same pool; treat as P1 for rate budgeting | ✅ `costs_fixture.json` |
| /v1/organization/usage/summary | GET | Daily cost rollups (fallback coarse telemetry) | start_time, end_time | `daily_totals[]` by category | Same bucket as completions usage | ⬜ Deprecated (prefer `/costs`) |

## Project Management

| Endpoint | Method | Purpose | Response Highlights | Notes |
| --- | --- | --- | --- | --- |
| /v1/organization/projects | GET | List projects visible to admin key | `data[]` projects with `id`, `name`, `status`, timestamps | `has_more` pagination via `page_token` |
| /v1/organization/projects/{project_id} | GET | Fetch project metadata | `object`, `status`, `billing_reference` | Includes soft-deleted state via `archived_at` |
| /v1/organization/projects/{project_id}/members | GET | Enumerate user memberships | `members[]` with `user_id`, `email`, `role`, `invited_at` | Supports pagination; returns `next_page` URL |

## Service Accounts & Keys

| Endpoint | Method | Purpose | Response Highlights | Notes |
| --- | --- | --- | --- | --- |
| /v1/organization/projects/{project_id}/service_accounts | GET | Service accounts tied to a project | `data[]` accounts with `id`, `name`, `role`, `created_at`, `deleted_at` | Filterable by `status` |
| /v1/organization/projects/{project_id}/service_accounts/{service_account_id}/keys | GET | List keys for a service account | `data[]` keys with `id`, `name`, `redacted_value`, `created_at`, `last_used_at` | Key material is redacted after creation |

## Certificates & Credentials

| Endpoint | Method | Purpose | Response Highlights | Notes |
| --- | --- | --- | --- | --- |
| /v1/organization/certificates | GET | Manage TLS client certificates | `data[]` certificates with `status`, `expires_at`, `fingerprint` | `status` transitions tracked via events |
| /v1/organization/certificates/{certificate_id}/events | GET | Audit log for certificate lifecycle | `events[]` with `action`, `actor_id`, `occurred_at`, metadata | Use to enrich `openai_certificate_events` |

## Rate Limit & Header Requirements

- All admin endpoints require admin capability key with headers: `Authorization: Bearer <key>`, `OpenAI-Organization`, and optionally `OpenAI-Project` when scoping usage.
- Pagination is cursor-based; responses include `has_more` + either `next_page` URL or `next_page_token`.
- Responses observed in August–September 2025 indicate 60 RPM baseline, with burst to 90 RPM; treat as shared budget across organization admin endpoints.

## Fixture Coverage Checklist

- [x] Usage bucket response (`usage_completions_fixture.json`)
- [x] Embeddings usage response (`usage_embeddings_fixture.json`)
- [x] Moderations usage response (`usage_moderations_fixture.json`)
- [x] Images usage response (`usage_images_fixture.json`)
- [x] Audio speeches usage response (`usage_audio_speeches_fixture.json`)
- [x] Audio transcriptions usage response (`usage_audio_transcriptions_fixture.json`)
- [x] Vector stores usage response (`usage_vector_stores_fixture.json`)
- [x] Code interpreter sessions usage response (`usage_code_interpreter_fixture.json`)
- [x] Costs response (`costs_fixture.json`)
- [x] Project list (`projects_list_fixture.json`)
- [x] Project members (`project_members_fixture.json`)
- [x] Service accounts (`service_accounts_fixture.json`)
- [x] Service account keys (`service_account_keys_fixture.json`)
- [x] Certificates (`certificates_fixture.json`)
- [x] Certificate events (`certificate_events_fixture.json`)

> Source: OpenAI Admin API docs + observed responses captured 2025-09-29 (see hashed fixtures in this directory). Update planned entries once sanitized fixtures are captured and hashed into `CHECKSUMS.sha256`.

## Fixture Capture Playbook

### Shared Sanitization Rules
- Capture responses with the smallest practical window (`start_time` = start of current UTC day, `bucket_width=1d`) to keep payloads small.
- Reuse canonical project identifiers from `projects_list_fixture.json` (for example `proj_abc123`, `proj_xyz890`) so referential checks match metadata; keep user/key placeholders for non-critical fields.
- Remove or blank `next_page` cursors unless pagination is explicitly under test; document any retained cursor in the accompanying notes.
- Strip timestamps to ISO strings when present (`start_time_iso`) so dedupe comparisons remain deterministic.
- After editing JSON, run `jq -S '.'` for stable key ordering before hashing.

### Endpoint Checklists

**Embeddings Usage → `usage_embeddings_fixture.json`**
1. Request `GET /v1/organization/usage/embeddings?start_time=<epoch>&limit=1&bucket_width=1d`.
2. Confirm `results[]` contain `input_tokens` and `num_model_requests`; keep at least one entry with null grouping fields.
3. Scrub `project_id`, `user_id`, `api_key_id`, `model` values to placeholders and ensure numeric counters remain intact.
4. Save JSON under `audit/admin-api-fixtures/usage_embeddings_fixture.json` and append checksum.

**Moderations Usage → `usage_moderations_fixture.json`**
1. Request `GET /v1/organization/usage/moderations` with identical window parameters.
2. Verify presence of `organization.usage.moderations.result` objects containing `input_tokens` + `num_model_requests`.
3. Redact project/user/key fields; ensure at least one record exercises `model` grouping.
4. Store JSON + checksum update.

**Images Usage → `usage_images_fixture.json`**
1. Issue `GET /v1/organization/usage/images?bucket_width=1d&limit=1` and include `sizes=512x512` if data sparse.
2. Keep `results[].images`, `num_model_requests`, `size`, `source` fields; ensure at least one record includes `source="image.generation"`.
3. Replace IDs and sanitize any URLs or metadata strings.
4. Save, format, and hash.

**Audio Speeches Usage → `usage_audio_speeches_fixture.json`**
1. Call `GET /v1/organization/usage/audio_speeches?bucket_width=1d&limit=1`.
2. Confirm `characters` + `num_model_requests` exist; maintain numeric totals.
3. Redact identifiers; ensure at least one record keeps `model` placeholder to validate grouping.
4. Persist JSON + checksum.

**Audio Transcriptions Usage → `usage_audio_transcriptions_fixture.json`**
1. Run `GET /v1/organization/usage/audio_transcriptions` with the standard window.
2. Ensure `seconds` + `num_model_requests` fields are present and non-zero to exercise duration handling.
3. Scrub identifier fields; keep sample `model` entry.
4. Save and update checksum.

**Vector Stores Usage → `usage_vector_stores_fixture.json`**
1. Execute `GET /v1/organization/usage/vector_stores` with `limit=1` (only supports `project_id` grouping).
2. Verify `usage_bytes` value is non-zero and include a placeholder `project_id`.
3. Redact additional metadata if present; confirm bucket start/end exist.
4. Save + hash.

**Code Interpreter Sessions Usage → `usage_code_interpreter_fixture.json`**
1. Request `GET /v1/organization/usage/code_interpreter_sessions?bucket_width=1d&limit=1`.
2. Ensure `num_sessions` counter populates and optionally include a grouped `project_id`.
3. Replace identifiers; retain bucket metadata.
4. Save + hash.

**Costs → `costs_fixture.json`**
1. Call `GET /v1/organization/costs?start_time=<epoch>&limit=1` (only `bucket_width=1d` supported).
2. Confirm `organization.costs.result` entries contain `amount.value` and `amount.currency`; optionally include a `line_item` example.
3. Redact `project_id` as needed; ensure `amount.value` retains decimal precision.
4. Persist JSON and update checksum list.

Document any anomalies (e.g., empty results, missing optional fields) in `ADMIN_INGESTION_SPIKE_NOTES.md` alongside hash updates.
