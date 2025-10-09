# Security Audit Report

## Findings

### Unsanitized pagination URL leaks decrypted OpenAI API keys
- **Location:** `src/lib/usage-fetcher.ts`, `fetchAdminUsage` pagination loop
- **Severity:** High
- **Description:** The ingestion loop trusts `json.next_page` from the OpenAI Admin API, instantiates a new `URL` from it, and reuses the decrypted OpenAI API key and organization headers for the follow-up request. If an attacker controls or tampers with the upstream response, they can supply an arbitrary absolute URL.
- **Exploit Scenario:** A malicious `next_page` pointing to `https://attacker.example/` will cause the worker to send the victim's decrypted OpenAI credential to the attacker-controlled host.
- **Recommendation:** Treat `next_page` as untrusted. Only follow relative paths or explicitly validate that absolute URLs point to `https://api.openai.com`. Abort pagination and log any unexpected hostnames.
- **Status (2025-10-08):** Mitigated by `sanitizeAdminNextPageUrl` guard in `src/lib/usage-fetcher.ts`, which enforces `https://api.openai.com/v1/organization/` paths and rejects unexpected hosts/paths with telemetry coverage (`tests/usageFetcherSecurity.test.ts`).

### Cron authorization accepts `Bearer undefined`
- **Location:** `src/app/api/cron/daily-usage/route.ts`
- **Severity:** Medium
- **Description:** The cron endpoint compares the Authorization header to `` `Bearer ${process.env.CRON_SECRET}` `` without ensuring the secret exists. When `CRON_SECRET` is unset, the route accepts `Bearer undefined` and exposes per-user identifiers in the success response.
- **Exploit Scenario:** On deployments missing `CRON_SECRET`, an attacker can call the endpoint with `Authorization: Bearer undefined`, triggering ingestion for all users and receiving the list of affected user IDs.
- **Recommendation:** Fail closed if `CRON_SECRET` is missing. Strip the `Bearer` prefix, perform a timing-safe comparison against the expected value, and avoid returning detailed user identifiers in the response payload.
- **Status (2025-10-08):** Mitigated by rejecting absent/placeholder secrets (`undefined`, `null`, empty) before DB access in `src/app/api/cron/daily-usage/route.ts`; response payload continues to omit user identifiers.

## Threat Modeling Summary

| Module | Attack Surface & Observations | Likelihood | Severity |
| --- | --- | --- | --- |
| Authentication & Middleware | Clerk guards sensitive dashboards and API routes. Ensure production cookies enforce HTTPS and same-site attributes to prevent session hijacking. | Medium | High |
| Secrets & Database Layer | API keys stored with AES-256-GCM. Exposure of `ENCRYPTION_KEY` compromises all stored credentials; rotate and safeguard keys. | Low | Critical |
| Keys API | Requires authenticated Clerk user. Risk centers on account takeover and lack of tenant isolation beyond user ID. | Medium | High |
| Usage API & Dashboard | Allows users to trigger ingestion and fetch history. Lack of rate limiting could enable abuse against upstream APIs. | Medium | Medium |
| Integrations & Background Jobs | Pagination bug and weak cron auth enable credential exfiltration and unauthorized ingestion. | High | Critical |

## Dependency & Configuration Notes
- Dependencies in `package.json`/lockfiles are up-to-date, but run `pnpm audit` regularly to catch CVEs.
- Production must set `ENCRYPTION_KEY`, `CRON_SECRET`, and `DATABASE_URL`; missing secrets cause runtime failure or weaken authentication.
