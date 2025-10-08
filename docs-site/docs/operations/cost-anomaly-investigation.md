---
id: cost-anomaly-investigation
title: Cost Anomaly Investigation
sidebar_label: Cost Anomaly Investigation
---

**Summary:** Guide for triaging unexpected cost spikes detected by the FinOps anomaly alerts across OpenAI, Vercel, and Neon services.

**Prerequisites:**
- PagerDuty incident assigned to the on-call engineer.
- Access to OpenAI usage dashboard, Vercel analytics, and Neon cost explorer.
- Credentials for CogniTrack internal metrics (Looker or Metabase).
- Knowledge of the current promotional credits or discounts logged in `memorybank/billing.md`.

## Procedure

1. **Acknowledge alert**
   - Confirm PagerDuty incident and communicate status in `#incidents`.
   - Review alert payload to identify impacted provider and timeframe.
2. **Gather metrics**
   - For OpenAI, run `./scripts/openai/spend-report.sh --range 24h`.
   - For Vercel, export deployment usage for the affected project.
   - For Neon, review storage and compute hours for the production branch.
3. **Correlate with product events**
   - Check release calendar and experiment flags for recent launches.
   - Review `usage_events` table for abnormal query counts: `SELECT source, count(*) FROM usage_events WHERE timestamp > NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 2 DESC;`
4. **Isolate root cause**
   - If tied to runaway job, throttle queue via Temporal UI or disable flag.
   - For external abuse, enable rate limiting middleware and rotate API keys.
   - Document hypothesis and mitigating steps in the incident doc (`audit/incidents/<date>-cost-anomaly.md`).
5. **Implement mitigation**
   - Apply scaling limits (e.g., reduce Vercel concurrent builds, adjust OpenAI rate limits).
   - Coordinate with Finance to extend credit if needed.
6. **Confirm stabilization**
   - Monitor provider dashboards for cost returning to baseline for two consecutive intervals.
   - Update PagerDuty incident with resolution details and set status to resolved.

## Verification

- Ensure anomaly detector clears after next evaluation window.
- Validate that cost projections in Looker return to within ±5% of forecast.
- Confirm no new customer-impacting incidents were triggered.

## Follow-up

- File a post-incident review within 48 hours (template in `audit/postmortems/cost-anomaly-template.md`).
- Create engineering tasks for long-term fixes (rate limiting, caching, etc.).
- Update `docs-site/docs/architecture/overview.md` if structural mitigations were implemented.
