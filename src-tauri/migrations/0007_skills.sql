CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  package_type TEXT NOT NULL DEFAULT 'markdown' CHECK (package_type IN ('markdown', 'zip')),
  package_data BLOB,
  cover_data_url TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  compatibility_json TEXT NOT NULL DEFAULT '[]',
  resources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills(is_favorite DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS skill_tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_tag_links (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES skill_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_tag_links_tag ON skill_tag_links(tag_id, skill_id);
