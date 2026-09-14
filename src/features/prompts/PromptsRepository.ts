import type { DatabasePort } from "../../shared/db/types";
import type { Prompt, PromptInput, PromptsStore } from "./types";
import { likePattern } from "../../shared/db/search";

interface PromptRow {
  id: string;
  title: string;
  content: string;
  notes: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  prompt_id: string;
  name: string;
}

interface PromptSearchRow extends PromptRow {
  tag_names: string | null;
}

function cleanTags(tags: string[]): string[] {
  const unique = new Map<string, string>();
  for (const tag of tags) {
    const name = tag.trim();
    if (name) unique.set(name.toLocaleLowerCase(), name);
  }
  return [...unique.values()];
}

export class PromptsRepository implements PromptsStore {
  constructor(
    private readonly db: DatabasePort,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listPrompts(): Promise<Prompt[]> {
    const rows = await this.db.select<PromptRow>(
      `SELECT id, title, content, notes, is_favorite, created_at, updated_at
       FROM prompts
       ORDER BY is_favorite DESC, updated_at DESC`,
    );
    const tagRows = await this.db.select<TagRow>(
      `SELECT l.prompt_id, t.name
       FROM prompt_tag_links l
       JOIN prompt_tags t ON t.id = l.tag_id
       ORDER BY t.name COLLATE NOCASE`,
    );
    const tagsByPrompt = new Map<string, string[]>();
    for (const tag of tagRows) {
      const names = tagsByPrompt.get(tag.prompt_id) ?? [];
      names.push(tag.name);
      tagsByPrompt.set(tag.prompt_id, names);
    }
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      notes: row.notes,
      isFavorite: Boolean(row.is_favorite),
      tags: tagsByPrompt.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createPrompt(input: PromptInput): Promise<string> {
    if (!input.content.trim()) throw new Error("提示词正文不能为空");
    const id = this.createId();
    const timestamp = this.now();
    await this.db.execute(
      `INSERT INTO prompts(id, title, content, notes, is_favorite, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [id, input.title.trim(), input.content, input.notes, input.isFavorite ? 1 : 0, timestamp],
    );
    await this.replaceTags(id, input.tags, timestamp);
    return id;
  }

  async searchPrompts(query: string, limit = 5): Promise<Prompt[]> {
    const pattern = likePattern(query.trim());
    const rows = await this.db.select<PromptSearchRow>(
      `SELECT p.id, p.title, p.content, p.notes, p.is_favorite, p.created_at, p.updated_at,
              GROUP_CONCAT(t.name, CHAR(31)) AS tag_names
       FROM prompts p
       LEFT JOIN prompt_tag_links l ON l.prompt_id = p.id
       LEFT JOIN prompt_tags t ON t.id = l.tag_id
       WHERE p.title LIKE $1 ESCAPE '\\' OR p.content LIKE $1 ESCAPE '\\'
          OR p.notes LIKE $1 ESCAPE '\\' OR t.name LIKE $1 ESCAPE '\\'
       GROUP BY p.id
       ORDER BY p.is_favorite DESC, p.updated_at DESC
       LIMIT $2`,
      [pattern, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      notes: row.notes,
      isFavorite: Boolean(row.is_favorite),
      tags: row.tag_names?.split(String.fromCharCode(31)).filter(Boolean) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updatePrompt(id: string, input: PromptInput): Promise<void> {
    if (!input.content.trim()) throw new Error("提示词正文不能为空");
    const timestamp = this.now();
    const result = await this.db.execute(
      `UPDATE prompts
       SET title = $1, content = $2, notes = $3, is_favorite = $4, updated_at = $5
       WHERE id = $6`,
      [input.title.trim(), input.content, input.notes, input.isFavorite ? 1 : 0, timestamp, id],
    );
    if (result.rowsAffected === 0) throw new Error("要编辑的提示词不存在");
    await this.replaceTags(id, input.tags, timestamp);
  }

  async deletePrompt(id: string): Promise<void> {
    await this.db.execute("DELETE FROM prompts WHERE id = $1", [id]);
  }

  private async replaceTags(promptId: string, tags: string[], timestamp: string): Promise<void> {
    await this.db.execute("DELETE FROM prompt_tag_links WHERE prompt_id = $1", [promptId]);
    for (const name of cleanTags(tags)) {
      await this.db.execute(
        `INSERT INTO prompt_tags(id, name, color, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, $3)
         ON CONFLICT(name) DO NOTHING`,
        [this.createId(), name, timestamp],
      );
      const [tag] = await this.db.select<{ id: string }>(
        "SELECT id FROM prompt_tags WHERE name = $1 COLLATE NOCASE LIMIT 1",
        [name],
      );
      if (!tag) throw new Error("无法保存提示词标签");
      await this.db.execute(
        "INSERT INTO prompt_tag_links(prompt_id, tag_id) VALUES ($1, $2)",
        [promptId, tag.id],
      );
    }
  }
}
