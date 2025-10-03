-- Extend usage_events with per-day window metadata and cached token breakdowns.
-- Generated 2025-10-01 to support OpenAI daily parity workstream.

BEGIN;

ALTER TABLE "usage_events"
    ADD COLUMN IF NOT EXISTS "window_start" timestamp,
    ADD COLUMN IF NOT EXISTS "window_end" timestamp,
    ADD COLUMN IF NOT EXISTS "project_id" text,
    ADD COLUMN IF NOT EXISTS "openai_user_id" text,
    ADD COLUMN IF NOT EXISTS "openai_api_key_id" text,
    ADD COLUMN IF NOT EXISTS "service_tier" text,
    ADD COLUMN IF NOT EXISTS "batch" boolean,
    ADD COLUMN IF NOT EXISTS "num_model_requests" integer;

ALTER TABLE "usage_events"
    ADD COLUMN IF NOT EXISTS "input_cached_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_uncached_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_text_tokens" integer,
    ADD COLUMN IF NOT EXISTS "output_text_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_cached_text_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_audio_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_cached_audio_tokens" integer,
    ADD COLUMN IF NOT EXISTS "output_audio_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_image_tokens" integer,
    ADD COLUMN IF NOT EXISTS "input_cached_image_tokens" integer,
    ADD COLUMN IF NOT EXISTS "output_image_tokens" integer;

DROP INDEX IF EXISTS "usage_admin_bucket_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "usage_admin_bucket_idx"
    ON "usage_events" (
        "key_id",
        "model",
        "window_start",
        "window_end",
        COALESCE("project_id", ''),
        COALESCE("openai_api_key_id", ''),
        COALESCE("openai_user_id", ''),
        COALESCE("service_tier", ''),
        COALESCE("batch", false)
    )
    WHERE "window_start" IS NOT NULL;

COMMIT;
