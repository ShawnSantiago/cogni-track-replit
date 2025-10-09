SELECT window_start, project_id, openai_api_key_id, openai_user_id, SUM(tokens_in) AS tokens_in, SUM(tokens_out) AS tokens_out
FROM usage_events
WHERE window_start BETWEEN '2025-09-10'::timestamptz AND '2025-09-11'::timestamptz
GROUP BY window_start, project_id, openai_api_key_id, openai_user_id
ORDER BY window_start, project_id;
