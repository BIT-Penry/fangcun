import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../../shared/db/types";
import { BookmarksRepository, DuplicateBookmarkError } from "./BookmarksRepository";

describe("BookmarksRepository", () => {
  it("loads bookmarks with folders and tags", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{
        id: "bookmark-1",
        url: "https://example.com/docs",
        normalized_url: "https://example.com/docs",
        title: "Example Docs",
        description: "Reference",
        folder_id: "folder-1",
        folder_name: "文档",
        created_at: "2026-08-21T00:00:00.000Z",
        updated_at: "2026-08-21T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([
        { bookmark_id: "bookmark-1", name: "API" },
        { bookmark_id: "bookmark-1", name: "参考" },
      ]);
    const db = { select, execute: vi.fn() } as unknown as DatabasePort;

    await expect(new BookmarksRepository(db).listBookmarks()).resolves.toEqual([expect.objectContaining({
      id: "bookmark-1",
      folderName: "文档",
      tags: ["API", "参考"],
    })]);
  });

  it("creates a bookmark, folder, and case-insensitive unique tags", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const select = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "tag-1" }]);
    const ids = ["folder-1", "bookmark-1", "tag-proposal"];
    const db = { select, execute } as unknown as DatabasePort;
    const repository = new BookmarksRepository(
      db,
      () => ids.shift() ?? "extra-id",
      () => "2026-08-21T00:00:00.000Z",
    );

    await repository.createBookmark({
      url: "HTTPS://Example.com:443#intro",
      title: "Example",
      description: " Reference ",
      folderName: "文档",
      tags: ["API", "api", ""],
    });

    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmarks"), [
      "bookmark-1",
      "HTTPS://Example.com:443#intro",
      "https://example.com/",
      "Example",
      "Reference",
      "folder-1",
      "2026-08-21T00:00:00.000Z",
    ]);
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it("reports duplicate normalized URLs", async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new Error("UNIQUE constraint failed: bookmarks.normalized_url"));
    const db = { select: vi.fn(), execute } as unknown as DatabasePort;
    const repository = new BookmarksRepository(db, () => "bookmark-1");

    await expect(repository.createBookmark({
      url: "https://example.com",
      title: "Example",
      description: "",
      folderName: "",
      tags: [],
    })).rejects.toBeInstanceOf(DuplicateBookmarkError);
  });
});
