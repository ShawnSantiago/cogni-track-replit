---
id: integrations-monitoring
title: Integrations Monitoring Runbook
sidebar_label: Integrations Monitoring
---

**Summary:** Operational checklist for monitoring third-party integrations (Salesforce, HubSpot, Zendesk) that sync usage events into CogniTrack and responding to failures.

**Prerequisites:**
- Access to the integrations dashboard (`/admin/integrations`).
- Credentials for partner status pages and API consoles.
- Ability to view Temporal workflows and retry jobs.
- PagerDuty integration on-call rotation.

## Procedure

1. **Review dashboard status**
   - Navigate to `/admin/integrations` and confirm sync health indicators.
   - Note any connectors showing red/yellow status and affected tenants.
2. **Check Temporal workflows**
   - Open Temporal UI and search for workflow IDs matching failing integrations (`integration-sync-*`).
   - Inspect recent runs for errors; capture stack traces.
3. **Assess external provider health**
   - Visit provider status pages (e.g., `https://status.salesforce.com`).
   - If outage is external, communicate via `#customer-success` with expected resolution time.
4. **Retry or requeue jobs**
   - For transient errors, issue `temporal workflow run --workflow-id <id> --task-queue integrations`.
   - For per-tenant issues, toggle the integration off in the admin UI, clear stuck cursors in `openai_admin_cursors`, then re-enable.
5. **Escalate if needed**
   - If sync fails for >2 hours or impacts revenue metrics, escalate to integrations lead and create incident doc.
   - Coordinate with Customer Success to notify affected customers.
6. **Monitor after remediation**
   - Confirm new sync runs succeed for at least two cycles.
   - Validate data freshness in analytics dashboards (look for `data_lag_minutes` metric < 30).

## Verification

- Temporal queue depth returns to baseline (< 20 pending tasks).
- Admin dashboard displays green status across integrations.
- No new alerts triggered in the last 30 minutes.

## Follow-up

- Update `memorybank/integrations.md` with any new remediation steps.
- File Jira issues for code fixes discovered during investigation.
- Add monitoring gaps to the observability backlog if detection was delayed.
