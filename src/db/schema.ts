import { pgTable, text, timestamp, serial, integer, decimal, jsonb, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Users table to store Clerk user IDs
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk User ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Encrypted API keys for providers
export const providerKeys = pgTable("provider_keys", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(), // e.g., 'openai'
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(), // Initialization Vector for AES-256-GCM
  authTag: text("auth_tag").notNull(), // Auth Tag for AES-256-GCM
  usageMode: text("usage_mode").default("standard").notNull(),
  encryptedMetadata: text("encrypted_metadata"),
  metadataIv: text("metadata_iv"),
  metadataAuthTag: text("metadata_auth_tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Individual usage events
export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  keyId: integer("key_id").notNull().references(() => providerKeys.id, { onDelete: 'cascade' }),
  model: text("model").notNull(), // e.g., 'gpt-4-turbo'
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costEstimate: decimal("cost_estimate", { precision: 10, scale: 6 }).default("0"),
  timestamp: timestamp("timestamp").notNull(),
  windowStart: timestamp("window_start"),
  windowEnd: timestamp("window_end"),
  projectId: text("project_id"),
  openaiUserId: text("openai_user_id"),
  openaiApiKeyId: text("openai_api_key_id"),
  serviceTier: text("service_tier"),
  batch: boolean("batch"),
  numModelRequests: integer("num_model_requests"),
  inputCachedTokens: integer("input_cached_tokens"),
  inputUncachedTokens: integer("input_uncached_tokens"),
  inputTextTokens: integer("input_text_tokens"),
  outputTextTokens: integer("output_text_tokens"),
  inputCachedTextTokens: integer("input_cached_text_tokens"),
  inputAudioTokens: integer("input_audio_tokens"),
  inputCachedAudioTokens: integer("input_cached_audio_tokens"),
  outputAudioTokens: integer("output_audio_tokens"),
  inputImageTokens: integer("input_image_tokens"),
  inputCachedImageTokens: integer("input_cached_image_tokens"),
  outputImageTokens: integer("output_image_tokens"),
}, (usageEvents) => ({
  // NOTE: The column order (keyId, model, windowStart) in this unique index
  // matches the query pattern in the fetcher for optimal performance.
  // If you change the index column order or the query pattern, review for performance impact.
  // NOTE: Column order mirrors the lookup order in fetchAndStoreUsageForUser (keyId → model → windowStart → windowEnd)
  // so modifications should evaluate query performance and dedupe semantics together.
  usageAdminBucketIdx: uniqueIndex("usage_admin_bucket_idx")
    .on(
      usageEvents.keyId,
      usageEvents.model,
      usageEvents.windowStart,
      usageEvents.windowEnd,
      sql`COALESCE(${usageEvents.projectId}, '')`,
      sql`COALESCE(${usageEvents.openaiApiKeyId}, '')`,
      sql`COALESCE(${usageEvents.openaiUserId}, '')`,
      sql`COALESCE(${usageEvents.serviceTier}, '')`,
      sql`COALESCE(${usageEvents.batch}, false)`
    )
    .where(sql`window_start IS NOT NULL`),
}));

export const openaiProjects = pgTable("openai_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at"),
  billingReferenceType: text("billing_reference_type"),
  billingReferenceId: text("billing_reference_id"),
});

export const openaiProjectMembers = pgTable("openai_project_members", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => openaiProjects.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull(),
  email: text("email"),
  role: text("role").notNull(),
  invitedAt: timestamp("invited_at"),
  addedAt: timestamp("added_at"),
  removedAt: timestamp("removed_at"),
}, (members) => ({
  projectUserIdx: uniqueIndex("openai_proj_members_project_user_idx").on(members.projectId, members.userId),
}));

export const openaiServiceAccounts = pgTable("openai_service_accounts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => openaiProjects.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const openaiServiceAccountKeys = pgTable("openai_service_account_keys", {
  id: text("id").primaryKey(),
  serviceAccountId: text("service_account_id").notNull().references(() => openaiServiceAccounts.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  redactedValue: text("redacted_value").notNull(),
  createdAt: timestamp("created_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  deletedAt: timestamp("deleted_at"),
});

export const openaiCertificates = pgTable("openai_certificates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  fingerprint: text("fingerprint").notNull(),
  validAt: timestamp("valid_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const openaiCertificateEvents = pgTable("openai_certificate_events", {
  id: text("id").primaryKey(),
  certificateId: text("certificate_id").notNull().references(() => openaiCertificates.id, { onDelete: 'cascade' }),
  action: text("action").notNull(),
  actorId: text("actor_id"),
  occurredAt: timestamp("occurred_at").notNull(),
  metadata: jsonb("metadata"),
});

export const openaiAdminCursors = pgTable("openai_admin_cursors", {
  endpoint: text("endpoint").primaryKey(),
  nextPage: text("next_page"),
  version: integer("version").default(1).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  windowStart: timestamp("window_start"),
  windowEnd: timestamp("window_end"),
  errorCount: integer("error_count").default(0).notNull(),
});
