import { likePattern } from "../../shared/db/search";
import type { DatabasePort } from "../../shared/db/types";
import type { ListSkillsOptions, Skill, SkillInput, SkillsStore } from "./types";

interface SkillRow {
  id: string;
  name: string;
  description: string;
  content: string;
  notes: string;
  source_name: string;
  package_type: "markdown" | "zip";
  package_data: Uint8Array | null;
  cover_data_url: string | null;
  is_favorite: number;
  compatibility_json: string;
  resources_json: string;
  created_at: string;
  updated_at: string;
  tag_names?: string | null;
}

interface TagRow { skill_id: string; name: string }

function cleanStrings(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const clean = value.trim();
    if (clean) unique.set(clean.toLocaleLowerCase(), clean);
  }
  return [...unique.values()];
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch { return []; }
}

function rowToSkill(row: SkillRow, tags: string[]): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    notes: row.notes,
    sourceName: row.source_name,
    packageType: row.package_type,
    packageData: row.package_data,
    coverDataUrl: row.cover_data_url,
    isFavorite: Boolean(row.is_favorite),
    tags,
    compatibility: parseJsonArray<string>(row.compatibility_json),
    resources: parseJsonArray(row.resources_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SkillsRepository implements SkillsStore {
  constructor(
    private readonly db: DatabasePort,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listSkills(options: ListSkillsOptions = {}): Promise<Skill[]> {
    const packageDataColumn = options.includePackageData ? "package_data" : "NULL AS package_data";
    const rows = await this.db.select<SkillRow>(
      `SELECT id, name, description, content, notes, source_name, package_type,
              ${packageDataColumn}, cover_data_url, is_favorite, compatibility_json,
              resources_json, created_at, updated_at
       FROM skills ORDER BY is_favorite DESC, updated_at DESC`,
    );
    const tagRows = await this.db.select<TagRow>(
      `SELECT l.skill_id, t.name FROM skill_tag_links l
       JOIN skill_tags t ON t.id = l.tag_id ORDER BY t.name COLLATE NOCASE`,
    );
    const tags = new Map<string, string[]>();
    for (const row of tagRows) tags.set(row.skill_id, [...(tags.get(row.skill_id) ?? []), row.name]);
    return rows.map((row) => rowToSkill(row, tags.get(row.id) ?? []));
  }

  async getSkill(id: string): Promise<Skill | null> {
    const [row] = await this.db.select<SkillRow>(
      `SELECT id, name, description, content, notes, source_name, package_type, package_data,
              cover_data_url, is_favorite, compatibility_json, resources_json, created_at, updated_at
       FROM skills WHERE id = $1 LIMIT 1`, [id],
    );
    if (!row) return null;
    const tags = await this.db.select<{ name: string }>(
      `SELECT t.name FROM skill_tag_links l JOIN skill_tags t ON t.id = l.tag_id
       WHERE l.skill_id = $1 ORDER BY t.name COLLATE NOCASE`, [id],
    );
    return rowToSkill(row, tags.map((tag) => tag.name));
  }

  async createSkill(input: SkillInput): Promise<string> {
    if (!input.name.trim()) throw new Error("Skill 名称不能为空");
    if (!input.content.trim()) throw new Error("SKILL.md 内容不能为空");
    const id = this.createId();
    const timestamp = this.now();
    await this.db.execute(
      `INSERT INTO skills(id, name, description, content, notes, source_name, package_type, package_data,
                          cover_data_url, is_favorite, compatibility_json, resources_json, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
      [id, input.name.trim(), input.description.trim(), input.content, input.notes.trim(), input.sourceName,
        input.packageType, input.packageData, input.coverDataUrl, input.isFavorite ? 1 : 0,
        JSON.stringify(cleanStrings(input.compatibility)), JSON.stringify(input.resources), timestamp],
    );
    await this.replaceTags(id, input.tags, timestamp);
    return id;
  }

  async updateSkill(id: string, input: SkillInput): Promise<void> {
    if (!input.name.trim()) throw new Error("Skill 名称不能为空");
    if (!input.content.trim()) throw new Error("SKILL.md 内容不能为空");
    const timestamp = this.now();
    const result = await this.db.execute(
      `UPDATE skills SET name=$1, description=$2, content=$3, notes=$4, source_name=$5,
       package_type=$6, package_data=$7, cover_data_url=$8, is_favorite=$9,
       compatibility_json=$10, resources_json=$11, updated_at=$12 WHERE id=$13`,
      [input.name.trim(), input.description.trim(), input.content, input.notes.trim(), input.sourceName,
        input.packageType, input.packageData, input.coverDataUrl, input.isFavorite ? 1 : 0,
        JSON.stringify(cleanStrings(input.compatibility)), JSON.stringify(input.resources), timestamp, id],
    );
    if (!result.rowsAffected) throw new Error("要编辑的 Skill 不存在");
    await this.replaceTags(id, input.tags, timestamp);
  }

  async deleteSkill(id: string): Promise<void> {
    await this.db.execute("DELETE FROM skills WHERE id = $1", [id]);
  }

  async searchSkills(query: string, limit = 5): Promise<Skill[]> {
    const pattern = likePattern(query.trim());
    const rows = await this.db.select<SkillRow>(
      `SELECT s.id, s.name, s.description, s.content, s.notes, s.source_name, s.package_type,
              NULL AS package_data, s.cover_data_url, s.is_favorite, s.compatibility_json, s.resources_json,
              s.created_at, s.updated_at, GROUP_CONCAT(t.name, CHAR(31)) AS tag_names
       FROM skills s LEFT JOIN skill_tag_links l ON l.skill_id=s.id LEFT JOIN skill_tags t ON t.id=l.tag_id
       WHERE s.name LIKE $1 ESCAPE '\\' OR s.description LIKE $1 ESCAPE '\\'
          OR s.content LIKE $1 ESCAPE '\\' OR s.notes LIKE $1 ESCAPE '\\' OR t.name LIKE $1 ESCAPE '\\'
       GROUP BY s.id ORDER BY s.is_favorite DESC, s.updated_at DESC LIMIT $2`, [pattern, limit],
    );
    return rows.map((row) => rowToSkill(row, row.tag_names?.split(String.fromCharCode(31)).filter(Boolean) ?? []));
  }

  private async replaceTags(skillId: string, values: string[], timestamp: string): Promise<void> {
    await this.db.execute("DELETE FROM skill_tag_links WHERE skill_id = $1", [skillId]);
    for (const name of cleanStrings(values)) {
      await this.db.execute(
        `INSERT INTO skill_tags(id,name,created_at,updated_at) VALUES($1,$2,$3,$3)
         ON CONFLICT(name) DO NOTHING`, [this.createId(), name, timestamp],
      );
      const [tag] = await this.db.select<{ id: string }>(
        "SELECT id FROM skill_tags WHERE name = $1 COLLATE NOCASE LIMIT 1", [name],
      );
      if (!tag) throw new Error("无法保存 Skill 标签");
      await this.db.execute("INSERT INTO skill_tag_links(skill_id,tag_id) VALUES($1,$2)", [skillId, tag.id]);
    }
  }
}
