ALTER TABLE daily_entries ADD COLUMN mood_emoji TEXT;

ALTER TABLE todos ADD COLUMN due_time TEXT;
ALTER TABLE todos ADD COLUMN priority TEXT
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high'));

CREATE INDEX IF NOT EXISTS idx_todos_date_status_order
  ON todos(todo_date, is_completed, sort_order, created_at);
