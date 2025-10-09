SELECT key_id, model, project_id, openai_api_key_id, openai_user_id, tokens_in, tokens_out
FROM usage_events
WHERE window_start = '2025-09-02 00:00:00+00'::timestamptz
ORDER BY id;
