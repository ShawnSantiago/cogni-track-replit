# OpenAI Admin Data – Schema & Migration Design

**Prepared:** 2025-09-29  
**Author:** Codex agent (handoff-ready)  
**Inputs:** `audit/admin-api-fixtures/*.json`, existing Drizzle schema (`src/db/schema.ts`, `drizzle/meta/0001_snapshot.json`)

---

## 1. Objectives

1. Persist OpenAI Admin resources (projects, memberships, service accounts, keys, certificates, usage cursors) with auditability and soft-delete semantics.
2. Enable ingestion workers to upsert admin usage buckets into `usage_events` while tracking `next_page` cursors and replay safety.
3. Provide security primitives for sensitive material (service-account key redactions) consistent with existing AES-GCM helpers.

---

## 2. Source Mapping Summary

| Fixture | Target Table | Notes |
| --- | --- | --- |
| `usage_completions_fixture.json` | `usage_events` (existing) + `openai_admin_cursors` | Usage buckets will reuse `usage_events` with new unique index to prevent duplicates. |
| `projects_list_fixture.json` | `openai_projects` | Soft delete when `archived_at` presented. |
| `project_members_fixture.json` | `openai_project_members` | Maintain unique `(project_id, user_id)` and track invite/add timestamps. |
| `service_accounts_fixture.json` | `openai_service_accounts` | Keep `deleted_at` nullable for soft delete. |
| `service_account_keys_fixture.json` | `openai_service_account_keys` | Store only redacted values; real secret never persists. |
| `certificates_fixture.json` | `openai_certificates` | Include fingerprint for join with events. |
| `certificate_events_fixture.json` | `openai_certificate_events` | Persist actor & metadata JSON for audit trails. |

---

## 3. Proposed Drizzle Tables

```ts
// schema additions (TypeScript + Drizzle)
export const openaiProjects = pgTable('openai_projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at'),
  billingReferenceType: text('billing_reference_type'),
  billingReferenceId: text('billing_reference_id'),
});

export const openaiProjectMembers = pgTable('openai_project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => openaiProjects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  email: text('email'),
  role: text('role').notNull(),
  invitedAt: timestamp('invited_at'),
  addedAt: timestamp('added_at'),
  removedAt: timestamp('removed_at'),
}, (table) => ({
  projectMemberUnique: uniqueIndex('openai_proj_members_project_user_idx').on(table.projectId, table.userId),
}));

export const openaiServiceAccounts = pgTable('openai_service_accounts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => openaiProjects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const openaiServiceAccountKeys = pgTable('openai_service_account_keys', {
  id: text('id').primaryKey(),
  serviceAccountId: text('service_account_id').notNull().references(() => openaiServiceAccounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  redactedValue: text('redacted_value').notNull(),
  createdAt: timestamp('created_at').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  deletedAt: timestamp('deleted_at'),
});

export const openaiCertificates = pgTable('openai_certificates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  fingerprint: text('fingerprint').notNull(),
  validAt: timestamp('valid_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const openaiCertificateEvents = pgTable('openai_certificate_events', {
  id: text('id').primaryKey(),
  certificateId: text('certificate_id').notNull().references(() => openaiCertificates.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  actorId: text('actor_id'),
  occurredAt: timestamp('occurred_at').notNull(),
  metadata: jsonb('metadata'),
});

export const openaiAdminCursors = pgTable('openai_admin_cursors', {
  endpoint: text('endpoint').primaryKey(),
  nextPage: text('next_page'),
  version: integer('version').default(1).notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  windowStart: timestamp('window_start'),
  windowEnd: timestamp('window_end'),
  errorCount: integer('error_count').default(0).notNull(),
});

export const usageEventUniq = uniqueIndex('usage_admin_bucket_idx')
  .on(
    usageEvents.keyId,
    usageEvents.model,
    usageEvents.windowStart,
    sql`COALESCE(${usageEvents.projectId}, '')`,
    sql`COALESCE(${usageEvents.openaiApiKeyId}, '')`,
    sql`COALESCE(${usageEvents.openaiUserId}, '')`,
    sql`COALESCE(${usageEvents.serviceTier}, '')`,
    sql`COALESCE(${usageEvents.batch}, false)`
  )
  .where(sql`window_start IS NOT NULL`);
```

**Notes**
- All timestamps are UTC; client conversions handled upstream.
- Import helpers: add `jsonb` and `uniqueIndex` from `drizzle-orm/pg-core` in schema module.
- `usageEventUniq` prevents duplicate inserts when admin buckets replay.
- `openai_admin_cursors.endpoint` examples: `"usage/completions"`, `"projects"`, `"service_accounts:proj_abc123"`.
- The dedupe key matches OpenAI grouping dimensions (project, API key, user, tier, batch) so concurrent buckets stay isolated.
- Optional fields collapse to empty strings/false for uniqueness, ensuring "missing" metadata maps to a single row while still distinguishing populated fields.
- Upsert statements should target `usage_admin_bucket_idx` to refresh metrics safely.
- Monitoring: ingestion emits a single `usage_admin_bucket_idx missing; using manual dedupe fallback` warning when the index is absent. Ops should treat repeated warnings (>3/hour) as a cue to apply pending migrations before forecast buckets skew.

---

## 4. Migration Ordering

1. **Add jsonb helper import** to generated schema & update Drizzle snapshot.  
2. **Create independent tables** in order of dependencies (`openai_projects` → `openai_project_members` / `openai_service_accounts` → keys → certificates → events).  
3. **Add cursors table.**  
4. **Create unique index** on `usage_events`.  
5. **Backfill** from fixtures via idempotent scripts (dry-run first).  
6. **Enforce not-null** upgrades only after backfill verification (e.g., `status` already not null via API).

Each migration stays additive; no existing data mutated until backfill confidence reached.

---

## 5. Data Retention & Soft Delete Strategy

- Rely on OpenAI `deleted_at` / `archived_at` to mark inactive rows.  
- Never hard-delete; if API omits a row without a deleted timestamp, flag in `openai_admin_sync_runs` (future work).  
- Purge policies follow organization data retention rules (documented separately in `integrations.md`).

---

## 6. Security & Privacy Considerations

- Service account keys store only redacted token; full key handed off to encryption helper during creation flow and discarded after ingest.
- Add logging guard to ensure `redacted_value` is masked before writing to structured logs.
- Limit direct querying via RBAC: DB role used by analytics UI gets read-only view without key tables (expose via `openai_admin_readonly` view if needed).

---

## 7. Open Questions for Reviewers

1. Should `openai_projects` include billing currency/plan fields? (Fixture omits but API doc mentions optional billing info.)
2. Do we require historical snapshots (SCD Type 2) for project membership, or are current-state rows sufficient?
3. Confirm retention policy for certificate events – is 90-day rolling window acceptable?
4. Do we need composite keys for `openai_admin_cursors` keyed by organization + endpoint when multi-org support lands?

---

## 8. Approvals & Next Steps

- Share this document with Data (Alice) and Infra (Jamal) for async comments.  
- Blocker: waiting on confirmation for question (4) above before finalizing cursor primary key.  
- Draft migration scaffold committed in `drizzle/0002_openai_admin_tables.sql` pending review feedback.  
- Upon approval, generate Drizzle migration scaffolding (`pnpm drizzle-kit generate`) and ensure snapshot matches design.

**Confidence:** 8/10 — Fixtures align with proposed schema, and changes are additive with clear FK graph; pending reviewer answers may adjust cursor key strategy but not core tables.
