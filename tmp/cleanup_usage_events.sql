DELETE FROM usage_events ue
USING usage_events meta
WHERE ue.id <> meta.id
  AND ue.key_id = meta.key_id
  AND ue.model = meta.model
  AND ue.window_start = meta.window_start
  AND ue.window_end = meta.window_end
  AND COALESCE(meta.project_id, '') <> ''
  AND COALESCE(meta.openai_api_key_id, '') <> ''
  AND COALESCE(meta.openai_user_id, '') <> ''
  AND COALESCE(ue.project_id, '') = ''
  AND COALESCE(ue.openai_api_key_id, '') = ''
  AND COALESCE(ue.openai_user_id, '') = '';
