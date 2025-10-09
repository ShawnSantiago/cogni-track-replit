SELECT id,key_id,model,window_start,project_id,openai_api_key_id,openai_user_id
FROM usage_events
WHERE window_start = '2025-09-01 00:00:00+00'::timestamptz
ORDER BY id;
