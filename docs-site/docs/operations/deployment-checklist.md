---
id: deployment-checklist
title: Deployment Checklist
sidebar_label: Deployment Checklist
---

**Summary:** Standard procedure for promoting a CogniTrack release from staging to production, ensuring feature toggles, database migrations, and monitoring are in place.

**Prerequisites:**
- Release ticket approved with QA sign-off recorded in Linear.
- Access to Vercel production project and Neon production database.
- `bun` runtime installed locally (or GitHub Actions deploy workflow permissions).
- Feature flag configuration exported from `memorybank/feature-flags.md` for validation.

## Procedure

1. **Confirm release scope**
   - Review merged PRs on the `main` branch tagged for the release.
   - Validate that all migrations are present in `drizzle/migrations` and have been applied in staging.
2. **Freeze staging**
   - Announce deploy freeze in `#ops` Slack channel.
   - Run `npm run build` to confirm the application compiles.
   - Execute `bun run drizzle-kit up --config drizzle.config.ts --url $STAGING_DATABASE_URL` to ensure staging schema parity.
3. **Tag release**
   - Create a semver tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   - Update the release notes in `memorybank/releases/<version>.md` with highlights and rollback plan.
4. **Trigger production deploy**
   - From Vercel dashboard, promote the latest staging build or re-run the production pipeline.
   - Monitor GitHub Actions `deploy.yml` workflow for a green build.
5. **Database migrations**
   - If migrations exist, run `bun run drizzle-kit up --config drizzle.config.ts --url $PROD_DATABASE_URL`.
   - Confirm migration success in Neon activity logs.
6. **Feature flags**
   - Compare production LaunchDarkly flags against exported configuration, enabling flags per rollout plan.
   - Capture before/after screenshots in the release ticket.
7. **Post-deploy validation**
   - Run smoke tests: visit `/dashboard`, `/integrations`, and `/admin` to confirm no HTTP 500s.
   - Execute synthetic check `npm run test -- smoke` if available.

## Verification

- Check Datadog dashboards for `http_error_rate` < 1% and `p95_latency` within baseline.
- Confirm Sentry shows no new errors tied to the release commit.
- Validate CRON jobs in Temporal dashboard report success within 10 minutes of deploy.

## Follow-up

- Post release summary in `#release-updates` referencing Linear ticket.
- Schedule retro if any incident occurred (`/retro schedule <ticket>` in Slack).
- Update onboarding docs if new operational steps were introduced.
