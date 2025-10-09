SELECT window_start, project_id, openai_api_key_id, openai_user_id, model, tokens_in, tokens_out
FROM usage_events
WHERE window_start = '2025-09-01 00:00:00+00'::timestamptz
  AND openai_api_key_id = 'key_NF7ZLeXYAXECwqv7'
  AND model = 'gpt-5-2025-08-07'
ORDER BY id;
