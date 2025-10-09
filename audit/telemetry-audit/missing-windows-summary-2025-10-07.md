# Missing Windows Summary – 2025-10-07 Staging Diff

Source: `audit/telemetry-audit/2025-10-07T22-44-28Z-staging.json`

## Overview
- Total windows missing in DB: **46**
- Aggregate tokens associated with missing windows:
  - `input_tokens`: **173,264,675**
  - `output_tokens`: **2,630,441**
  - `num_model_requests`: **1,437**

## Breakdown by Project
| Project ID | Windows | Input Tokens | Output Tokens |
| --- | ---: | ---: | ---: |
| *(blank)* | 15 | 0 | 0 |
| `proj_MhIbP1DyoTSqH6k2DtXVKvvV` | 31 | 173,264,675 | 2,630,441 |

*Blank project rows correspond to CSV entries with no metadata and zero token counts. They likely stem from summary rows and can be ignored once ingestion confirms real buckets.*

## Breakdown by API Key
| API Key | Windows | Input Tokens | Output Tokens |
| --- | ---: | ---: | ---: |
| *(blank)* | 15 | 0 | 0 |
| `key_NF7ZLeXYAXECwqv7` | 1 | 25,076 | 4,737 |
| `key_mPAw5OyZbONR4dAL` | 30 | 173,239,599 | 2,625,704 |

## Breakdown by Service Tier
| Service Tier | Windows | Input Tokens | Output Tokens |
| --- | ---: | ---: | ---: |
| *(blank)* | 15 | 0 | 0 |
| `default` | 15 | 158,182,034 | 2,326,638 |
| `incentivized-tier` | 16 | 15,082,641 | 303,803 |

## Next Checks
1. Confirm whether the 15 blank-metadata windows appear in the CSV as aggregate rows (they carry zero tokens). If confirmed, we can filter them out before diffing.
2. Focus backfill validation on project `proj_MhIbP1DyoTSqH6k2DtXVKvvV`, primarily key `key_mPAw5OyZbONR4dAL`, and ensure the manual dedupe fallback counters decrease on rerun.
3. After the next staging ingestion, rerun the telemetry diff and compare manual fallback counters to validate the guard fix.

## CSV Verification
- Source export contains **46** rows; **15** lack `project_id`/`api_key_id`/`user_id`.
- All blank rows carry zero metrics (tokens + request counts) — see `python3` audit above for sample windows starting `2025-09-06` through `2025-09-15`.
- Action: treat blank-metadata rows as summary lines and exclude them before comparing against `usage_events`.
