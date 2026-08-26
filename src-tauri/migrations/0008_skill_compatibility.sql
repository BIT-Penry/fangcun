UPDATE skills
SET compatibility_json = '["通用 Markdown"]'
WHERE (source_name LIKE 'https://%' OR source_name LIKE 'http://%')
  AND (compatibility_json = '[]' OR TRIM(compatibility_json) = '');
