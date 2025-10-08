---
id: openai-admin-security-controls
title: OpenAI Admin Data Security & Compliance
sidebar_label: Security & Compliance
description: Controls and review plan for handling OpenAI Admin data within CogniTrack.
---

**Prepared:** 2025-09-29  
**Author:** Codex agent  
**Scope:** Tables proposed in [OpenAI Admin Data Schema & Migration](../../architecture/openai-admin-migration-design.md) plus ingestion spike harness.

## Data Classification & Storage Controls

| Table / Asset | Classification | Storage Controls | Access Controls | Notes |
| --- | --- | --- | --- | --- |
| `openai_projects`, `openai_project_members` | Internal (Org metadata) | Plaintext; soft-delete columns logged | API + analytics roles (read), ingestion worker (write) | Contains user emails → ensure GDPR export hooks documented. |
| `openai_service_accounts` | Confidential | Plaintext; no secrets | Ingestion + SecOps (read/write) | Only identifiers + names retained. |
| `openai_service_account_keys` | Restricted | Redacted token only; no secret material stored | SecOps read, ingestion write | Encrypt-on-create handled via `encryption.ts`; enforce masking in logs/UI. |
| `openai_certificates`, `openai_certificate_events` | Confidential | Plaintext metadata + lifecycle JSON | Ingestion write, SecOps + Infra read | Include fingerprints for incident response; treat as secrets under SOC2. |
| `openai_admin_cursors` | Internal | Plaintext | Ingestion read/write | Rotate on schema changes via `version` column. |
| `usage_events` (admin buckets) | Confidential | Existing token/cost data | Analytics read, ingestion write | Unique index prevents duplicate cost accrual. |

## Encryption & Secret Handling

- Reuse `src/lib/encryption.ts` for any workflow that temporarily holds full service-account key material. Keys are never persisted post-ingestion; only `redacted_value` strings stored.
- Update notifier: add sanitizer to logging pipeline to redact any `redacted_value`, `fingerprint`, or `actor_email` fields before structured logging.
- New env requirements: `OPENAI_ADMIN_AUDIT_WEBHOOK` (optional) for security notifications; document rotation policy in `integrations.md`.

## RBAC & Least Privilege

- Introduce DB role `openai_admin_app` (ingestion) with write access to new tables; analytics role receives SELECT on read-only views excluding `openai_service_account_keys`.
- API routes serving admin insights must enforce Clerk role `admin` or higher; add integration tests around `/app/admin` dashboards.
- Background jobs executing admin sync run under dedicated queue worker identity; ensure secrets accessible only to that workload.

## Logging, Monitoring, and Alerting

- Emit structured log per sync run with counts, cursor positions, and PII scrubbing status; ship to central logging with 30-day retention.
- Add metrics: `admin_sync_failures_total`, `admin_cursor_drift_seconds`, `admin_certificate_expiring_total` (threshold 14d), `admin_service_account_keys_rotated_total`.
- Wire alerts to SecOps Slack channel when failure count exceeds 3 in a rolling hour or certificate expiry < 7 days.

## Compliance Checklist

- [x] Map data to existing SOC2 trust categories (availability, confidentiality).
- [x] Confirm GDPR data subject export path (projects + memberships).
- [ ] Verify with Legal whether service-account metadata is governed by DPAs. (Review brief circulated 2025-09-29; pending 2025-10-02 meeting.)
- [ ] Attach security sign-off once review meeting completed (target 2025-10-02).

## Review Plan & Owners

| Task | Owner | Target Date | Status |
| --- | --- | --- | --- |
| Review schema + controls with Security (Maya) | Codex → Maya | 2025-10-01 | Invite sent 2025-09-29 (see `audit/security-review/2025-10-01_security_review_agenda.md`) |
| Confirm logging sanitizer coverage | Codex → Infra (Jamal) | 2025-10-02 | Agenda shared with Infra; follow-up pending security review decisions |
| Update `integrations.md` with admin onboarding guardrails | Codex | 2025-09-30 | Scheduled; draft live in `memorybank/integrations.md` |
| Coordinate Legal consent/DPA review | Codex → Legal | 2025-10-02 | Brief prepared (`audit/legal-review/2025-10-02_legal_review_brief.md`); meeting TBD |

**Confidence:** 8/10 — Controls mapped to encryption/RBAC patterns, review sessions scheduled (Maya 2025-10-01, Jamal 2025-10-02), and compliance follow-ups tracked with identified owners.
