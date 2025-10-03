import { pgTable, text, timestamp, foreignKey, serial, integer, numeric, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
	id: serial().primaryKey().notNull(),
	keyId: integer("key_id").notNull(),
	model: text().notNull(),
	tokensIn: integer("tokens_in").default(0),
	tokensOut: integer("tokens_out").default(0),
	costEstimate: numeric("cost_estimate", { precision: 10, scale:  6 }).default('0'),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	windowStart: timestamp("window_start", { mode: 'string' }),
	windowEnd: timestamp("window_end", { mode: 'string' }),
	projectId: text("project_id"),
	openaiUserId: text("openai_user_id"),
	openaiApiKeyId: text("openai_api_key_id"),
	serviceTier: text("service_tier"),
	batch: boolean(),
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
}, (table) => [
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [providerKeys.id],
			name: "usage_events_key_id_fkey"
		}).onDelete("cascade"),
]);

export const providerKeys = pgTable("provider_keys", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	provider: text().notNull(),
	encryptedKey: text("encrypted_key").notNull(),
	iv: text().notNull(),
	authTag: text("auth_tag").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	usageMode: text("usage_mode").default('standard').notNull(),
	encryptedMetadata: text("encrypted_metadata"),
	metadataIv: text("metadata_iv"),
	metadataAuthTag: text("metadata_auth_tag"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "provider_keys_user_id_fkey"
		}).onDelete("cascade"),
]);
