import type { DatabasePort } from "../../shared/db/types";
import type { JournalMonthSummary, JournalSearchHit, JournalStore, Todo, TodoDetails, TodoPriority } from "./types";
import { likePattern } from "../../shared/db/search";

interface TodoRow {
  id: string;
  todo_date: string;
  content: string;
  is_completed: number;
  sort_order: number;
  due_time: string | null;
  priority: TodoPriority | null;
  created_at: string;
  updated_at: string;
}

export class JournalRepository implements JournalStore {
  constructor(
    private readonly db: DatabasePort,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getEntry(date: string): Promise<string> {
    const [entry] = await this.db.select<{ content: string }>(
      "SELECT content FROM daily_entries WHERE entry_date = $1 LIMIT 1",
      [date],
    );
    return entry?.content ?? "";
  }

  async getEntryMood(date: string): Promise<string | null> {
    const [entry] = await this.db.select<{ mood_emoji: string | null }>(
      "SELECT mood_emoji FROM daily_entries WHERE entry_date = $1 LIMIT 1",
      [date],
    );
    return entry?.mood_emoji ?? null;
  }

  async saveEntry(date: string, content: string): Promise<void> {
    const timestamp = this.now();
    await this.db.execute(
      `INSERT INTO daily_entries(id, entry_date, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT(entry_date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      [this.createId(), date, content, timestamp],
    );
  }

  async setEntryMood(date: string, moodEmoji: string | null): Promise<void> {
    const timestamp = this.now();
    await this.db.execute(
      `INSERT INTO daily_entries(id, entry_date, content, mood_emoji, created_at, updated_at)
       VALUES ($1, $2, '', $3, $4, $4)
       ON CONFLICT(entry_date) DO UPDATE SET mood_emoji = excluded.mood_emoji, updated_at = excluded.updated_at`,
      [this.createId(), date, moodEmoji, timestamp],
    );
  }

  async listTodos(date: string): Promise<Todo[]> {
    const rows = await this.db.select<TodoRow>(
      `SELECT id, todo_date, content, is_completed, sort_order, due_time, priority, created_at, updated_at
       FROM todos WHERE todo_date = $1 ORDER BY is_completed, sort_order, created_at`,
      [date],
    );
    return rows.map((row) => ({
      id: row.id,
      date: row.todo_date,
      content: row.content,
      isCompleted: Boolean(row.is_completed),
      sortOrder: row.sort_order,
      dueTime: row.due_time,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createTodo(date: string, content: string, details: Partial<TodoDetails> = {}): Promise<string> {
    if (!content.trim()) throw new Error("Todo 内容不能为空");
    const dueTime = details.dueTime ?? null;
    const priority = details.priority ?? "low";
    this.validateTodoDetails({ dueTime, priority });
    const [row] = await this.db.select<{ next_order: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM todos WHERE todo_date = $1",
      [date],
    );
    const id = this.createId();
    const timestamp = this.now();
    await this.db.execute(
      `INSERT INTO todos(id, todo_date, content, is_completed, sort_order, due_time, priority, created_at, updated_at)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $7)`,
      [id, date, content.trim(), row?.next_order ?? 0, dueTime, priority, timestamp],
    );
    return id;
  }

  async updateTodoContent(id: string, content: string): Promise<void> {
    if (!content.trim()) throw new Error("Todo 内容不能为空");
    await this.db.execute(
      "UPDATE todos SET content = $1, updated_at = $2 WHERE id = $3",
      [content.trim(), this.now(), id],
    );
  }

  async updateTodoDetails(id: string, details: TodoDetails): Promise<void> {
    this.validateTodoDetails(details);
    await this.db.execute(
      "UPDATE todos SET due_time = $1, priority = $2, updated_at = $3 WHERE id = $4",
      [details.dueTime, details.priority, this.now(), id],
    );
  }

  async setTodoCompleted(id: string, completed: boolean): Promise<void> {
    await this.db.execute(
      `UPDATE todos
       SET is_completed = $1,
           sort_order = CASE WHEN $1 = 1 THEN (
             SELECT COALESCE(MAX(peer.sort_order), -1) + 1
             FROM todos AS peer WHERE peer.todo_date = todos.todo_date
           ) ELSE sort_order END,
           updated_at = $2
       WHERE id = $3`,
      [completed ? 1 : 0, this.now(), id],
    );
  }

  async moveTodo(id: string, date: string): Promise<void> {
    const [row] = await this.db.select<{ next_order: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM todos WHERE todo_date = $1",
      [date],
    );
    await this.db.execute(
      "UPDATE todos SET todo_date = $1, sort_order = $2, updated_at = $3 WHERE id = $4",
      [date, row?.next_order ?? 0, this.now(), id],
    );
  }

  async reorderTodos(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const timestamp = this.now();
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
    const original = await this.db.select<{ id: string; sort_order: number; updated_at: string }>(
      `SELECT id, sort_order, updated_at FROM todos WHERE id IN (${placeholders})`,
      ids,
    );
    try {
      for (const [index, id] of ids.entries()) {
        await this.db.execute(
          "UPDATE todos SET sort_order = $1, updated_at = $2 WHERE id = $3",
          [index, timestamp, id],
        );
      }
    } catch (error) {
      for (const todo of original) {
        try {
          await this.db.execute(
            "UPDATE todos SET sort_order = $1, updated_at = $2 WHERE id = $3",
            [todo.sort_order, todo.updated_at, todo.id],
          );
        } catch { /* best-effort rollback */ }
      }
      throw error;
    }
  }

  async deleteTodo(id: string): Promise<void> {
    await this.db.execute("DELETE FROM todos WHERE id = $1", [id]);
  }

  async getMonthSummary(startDate: string, endDate: string): Promise<JournalMonthSummary> {
    const [row] = await this.db.select<{
      entry_days: number;
      todo_count: number;
      completed_todo_count: number;
      p1_todo_count: number;
      p2_todo_count: number;
      p3_todo_count: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM daily_entries
         WHERE entry_date >= $1 AND entry_date < $2
           AND (TRIM(content) <> '' OR mood_emoji IS NOT NULL)) AS entry_days,
        (SELECT COUNT(*) FROM todos
         WHERE todo_date >= $1 AND todo_date < $2) AS todo_count,
        (SELECT COUNT(*) FROM todos
         WHERE todo_date >= $1 AND todo_date < $2 AND is_completed = 1) AS completed_todo_count,
        (SELECT COUNT(*) FROM todos
         WHERE todo_date >= $1 AND todo_date < $2 AND is_completed = 0 AND priority = 'high') AS p1_todo_count,
        (SELECT COUNT(*) FROM todos
         WHERE todo_date >= $1 AND todo_date < $2 AND is_completed = 0 AND priority = 'medium') AS p2_todo_count,
        (SELECT COUNT(*) FROM todos
         WHERE todo_date >= $1 AND todo_date < $2 AND is_completed = 0
           AND (priority = 'low' OR priority IS NULL)) AS p3_todo_count`,
      [startDate, endDate],
    );
    return {
      entryDays: row?.entry_days ?? 0,
      todoCount: row?.todo_count ?? 0,
      completedTodoCount: row?.completed_todo_count ?? 0,
      p1TodoCount: row?.p1_todo_count ?? 0,
      p2TodoCount: row?.p2_todo_count ?? 0,
      p3TodoCount: row?.p3_todo_count ?? 0,
    };
  }

  async getOpenTodoCounts(startDate: string, endDate: string): Promise<Record<string, number>> {
    const rows = await this.db.select<{ date: string; open_count: number }>(
      `SELECT todo_date AS date, COUNT(*) AS open_count
       FROM todos
       WHERE todo_date >= $1 AND todo_date < $2 AND is_completed = 0
       GROUP BY todo_date`,
      [startDate, endDate],
    );
    return Object.fromEntries(rows.map((row) => [row.date, row.open_count]));
  }

  async searchJournal(query: string, limit = 8): Promise<JournalSearchHit[]> {
    const pattern = likePattern(query.trim());
    return this.db.select<JournalSearchHit>(
      `SELECT id, entry_date AS date, content, 'entry' AS kind
       FROM daily_entries WHERE content LIKE $1 ESCAPE '\\'
       UNION ALL
       SELECT id, todo_date AS date, content, 'todo' AS kind
       FROM todos WHERE content LIKE $1 ESCAPE '\\'
       ORDER BY date DESC LIMIT $2`,
      [pattern, limit],
    );
  }

  private validateTodoDetails(details: TodoDetails): void {
    if (details.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(details.dueTime)) {
      throw new Error("截止时刻格式无效");
    }
    if (details.priority && !["low", "medium", "high"].includes(details.priority)) {
      throw new Error("Todo 优先级无效");
    }
  }
}
