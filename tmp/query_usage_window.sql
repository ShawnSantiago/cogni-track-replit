SELECT window_start, COUNT(*) FILTER (WHERE COALESCE(project_id,'') <> '') AS with_metadata,
       COUNT(*) FILTER (WHERE COALESCE(project_id,'') = '') AS without_metadata
FROM usage_events
WHERE window_start BETWEEN '2025-09-01' AND '2025-10-01'
GROUP BY window_start
ORDER BY window_start;
