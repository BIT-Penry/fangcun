import type { DatabasePort } from "../../shared/db/types";
import type { Bookmark, BookmarkFolder, BookmarkInput, BookmarksStore } from "./types";
import { bookmarkHostname, normalizeBookmarkUrl } from "./url";

interface BookmarkRow {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string;
  folder_id: string | null;
  folder_name: string | null;
  created_at: string;
  updated_at: string;
}

interface TagLinkRow {
  bookmark_id: string;
  name: string;
}

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
}

export class DuplicateBookmarkError extends Error {
  constructor() {
    super("这个网址已经收藏过了");
    this.name = "DuplicateBookmarkError";
  }
}

function isDuplicateUrlError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes("UNIQUE constraint failed: bookmarks.normalized_url");
}

function cleanTags(tags: string[]): string[] {
  const unique = new Map<string, string>();
  for (const tag of tags) {
    const name = tag.trim();
    if (name) unique.set(name.toLocaleLowerCase(), name);
  }
  return [...unique.values()];
}

export class BookmarksRepository implements BookmarksStore {
  constructor(
    private readonly db: DatabasePort,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listBookmarks(): Promise<Bookmark[]> {
    const rows = await this.db.select<BookmarkRow>(
      `SELECT b.id, b.url, b.normalized_url, b.title, b.description,
              b.folder_id, f.name AS folder_name, b.created_at, b.updated_at
       FROM bookmarks b
       LEFT JOIN bookmark_folders f ON f.id = b.folder_id
       ORDER BY b.updated_at DESC`,
    );
    const tagRows = await this.db.select<TagLinkRow>(
      `SELECT l.bookmark_id, t.name
       FROM bookmark_tag_links l
       JOIN bookmark_tags t ON t.id = l.tag_id
       ORDER BY t.name COLLATE NOCASE`,
    );
    const tagsByBookmark = new Map<string, string[]>();
    for (const tag of tagRows) {
      const names = tagsByBookmark.get(tag.bookmark_id) ?? [];
      names.push(tag.name);
      tagsByBookmark.set(tag.bookmark_id, names);
    }
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      normalizedUrl: row.normalized_url,
      title: row.title,
      description: row.description,
      folderId: row.folder_id,
      folderName: row.folder_name,
      tags: tagsByBookmark.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listFolders(): Promise<BookmarkFolder[]> {
    const rows = await this.db.select<FolderRow>(
      `SELECT id, name, parent_id
       FROM bookmark_folders
       ORDER BY sort_order, name COLLATE NOCASE`,
    );
    return rows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id }));
  }

  async createBookmark(input: BookmarkInput): Promise<void> {
    const normalizedUrl = normalizeBookmarkUrl(input.url);
    const timestamp = this.now();
    try {
      const folderId = await this.ensureFolder(input.folderName, timestamp);
      const bookmarkId = this.createId();
      await this.db.execute(
        `INSERT INTO bookmarks(
           id, url, normalized_url, title, description, folder_id, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [
          bookmarkId,
          input.url.trim(),
          normalizedUrl,
          input.title.trim() || bookmarkHostname(input.url),
          input.description.trim(),
          folderId,
          timestamp,
        ],
      );
      await this.replaceTags(bookmarkId, input.tags, timestamp);
    } catch (error) {
      if (isDuplicateUrlError(error)) throw new DuplicateBookmarkError();
      throw error;
    }
  }

  async updateBookmark(id: string, input: BookmarkInput): Promise<void> {
    const normalizedUrl = normalizeBookmarkUrl(input.url);
    const timestamp = this.now();
    try {
      const folderId = await this.ensureFolder(input.folderName, timestamp);
      const result = await this.db.execute(
        `UPDATE bookmarks
         SET url = $1, normalized_url = $2, title = $3, description = $4,
             folder_id = $5, updated_at = $6
         WHERE id = $7`,
        [
          input.url.trim(),
          normalizedUrl,
          input.title.trim() || bookmarkHostname(input.url),
          input.description.trim(),
          folderId,
          timestamp,
          id,
        ],
      );
      if (result.rowsAffected === 0) throw new Error("要编辑的书签不存在");
      await this.replaceTags(id, input.tags, timestamp);
    } catch (error) {
      if (isDuplicateUrlError(error)) throw new DuplicateBookmarkError();
      throw error;
    }
  }

  async deleteBookmark(id: string): Promise<void> {
    await this.db.execute("DELETE FROM bookmarks WHERE id = $1", [id]);
  }

  private async ensureFolder(nameInput: string, timestamp: string): Promise<string | null> {
    const name = nameInput.trim();
    if (!name) return null;
    const existing = await this.db.select<{ id: string }>(
      `SELECT id FROM bookmark_folders
       WHERE parent_id IS NULL AND name = $1 COLLATE NOCASE
       LIMIT 1`,
      [name],
    );
    if (existing[0]) return existing[0].id;
    const id = this.createId();
    await this.db.execute(
      `INSERT INTO bookmark_folders(id, parent_id, name, sort_order, created_at, updated_at)
       VALUES ($1, NULL, $2, 0, $3, $3)`,
      [id, name, timestamp],
    );
    return id;
  }

  private async replaceTags(bookmarkId: string, tags: string[], timestamp: string): Promise<void> {
    await this.db.execute("DELETE FROM bookmark_tag_links WHERE bookmark_id = $1", [bookmarkId]);
    for (const name of cleanTags(tags)) {
      const proposedId = this.createId();
      await this.db.execute(
        `INSERT INTO bookmark_tags(id, name, color, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, $3)
         ON CONFLICT(name) DO NOTHING`,
        [proposedId, name, timestamp],
      );
      const [tag] = await this.db.select<{ id: string }>(
        "SELECT id FROM bookmark_tags WHERE name = $1 COLLATE NOCASE LIMIT 1",
        [name],
      );
      if (!tag) throw new Error("无法保存书签标签");
      await this.db.execute(
        "INSERT INTO bookmark_tag_links(bookmark_id, tag_id) VALUES ($1, $2)",
        [bookmarkId, tag.id],
      );
    }
  }

}
