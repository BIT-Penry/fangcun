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
        favicon_url: "https://example.com/icon.png",
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
      faviconUrl: "https://example.com/icon.png",
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
      faviconUrl: "https://example.com/icon.png",
      folderName: "文档",
      tags: ["API", "api", ""],
    });

    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmarks"), [
      "bookmark-1",
      "HTTPS://Example.com:443#intro",
      "https://example.com/",
      "Example",
      "Reference",
      "https://example.com/icon.png",
      "folder-1",
      "2026-08-21T00:00:00.000Z",
    ]);
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it("creates nested folders from a manually entered path", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const ids = ["folder-research", "folder-papers", "bookmark-1"];
    const repository = new BookmarksRepository(
      { select, execute } as unknown as DatabasePort,
      () => ids.shift() ?? "extra-id",
      () => "2026-08-21T00:00:00.000Z",
    );

    await repository.createBookmark({
      url: "https://example.com/paper",
      title: "论文主页",
      description: "",
      faviconUrl: "",
      folderName: "研究 / 论文",
      tags: [],
    });

    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmark_folders"), [
      "folder-research", null, "研究", "2026-08-21T00:00:00.000Z",
    ]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmark_folders"), [
      "folder-papers", "folder-research", "论文", "2026-08-21T00:00:00.000Z",
    ]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmarks"), [
      "bookmark-1", "https://example.com/paper", "https://example.com/paper", "论文主页",
      "", null, "folder-papers", "2026-08-21T00:00:00.000Z",
    ]);
  });

  it("creates an empty child folder while rejecting duplicate sibling names", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "folder-existing" }]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository(
      { select, execute } as unknown as DatabasePort,
      () => "folder-new",
      () => "2026-08-26T00:00:00.000Z",
    );

    await expect(repository.createFolder(" 实验 ", "folder-research")).resolves.toBe("folder-new");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmark_folders"), [
      "folder-new", "folder-research", "实验", "2026-08-26T00:00:00.000Z",
    ]);
    await expect(repository.createFolder("实验", "folder-research"))
      .rejects.toThrow("当前位置已有同名文件夹");
  });

  it("renames a folder while rejecting duplicate sibling names", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{ parent_id: "folder-research" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ parent_id: "folder-research" }])
      .mockResolvedValueOnce([{ id: "folder-existing" }]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository(
      { select, execute } as unknown as DatabasePort,
      () => "unused",
      () => "2026-08-26T00:00:00.000Z",
    );

    await expect(repository.renameFolder("folder-linux", " Linux 入门 ")).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledWith(
      "UPDATE bookmark_folders SET name = $1, updated_at = $2 WHERE id = $3",
      ["Linux 入门", "2026-08-26T00:00:00.000Z", "folder-linux"],
    );
    await expect(repository.renameFolder("folder-linux", "Docker"))
      .rejects.toThrow("当前位置已有同名文件夹");
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
      faviconUrl: "",
      folderName: "",
      tags: [],
    })).rejects.toBeInstanceOf(DuplicateBookmarkError);
  });

  it("deletes an empty folder branch", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{ id: "folder-research" }, { id: "folder-papers" }])
      .mockResolvedValueOnce([]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 3 });
    const repository = new BookmarksRepository({ select, execute } as unknown as DatabasePort);

    await expect(repository.deleteFolder("folder-research")).resolves.toBeUndefined();
    expect(select).toHaveBeenCalledWith(expect.stringContaining("WITH RECURSIVE descendants"), ["folder-research"]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM bookmark_folders"), ["folder-research", "folder-papers"]);
  });

  it("deletes bookmarks after removing their folder branch", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{ id: "folder-research" }])
      .mockResolvedValueOnce([{ id: "bookmark-1" }, { id: "bookmark-2" }]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository({ select, execute } as unknown as DatabasePort);

    await expect(repository.deleteFolder("folder-research")).resolves.toBeUndefined();
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining("DELETE FROM bookmark_folders"), ["folder-research"]);
    expect(execute).toHaveBeenNthCalledWith(2, expect.stringContaining("DELETE FROM bookmarks"), ["bookmark-1", "bookmark-2"]);
  });

  it("moves a bookmark into another folder", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository(
      { select: vi.fn(), execute } as unknown as DatabasePort,
      undefined,
      () => "2026-08-23T00:00:00.000Z",
    );

    await expect(repository.moveBookmark("bookmark-1", "folder-target")).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledWith(
      "UPDATE bookmarks SET folder_id = $1, updated_at = $2 WHERE id = $3",
      ["folder-target", "2026-08-23T00:00:00.000Z", "bookmark-1"],
    );
  });

  it("moves a folder to the root while preventing hierarchy cycles", async () => {
    const select = vi.fn().mockResolvedValue([{ id: "folder-child" }]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository(
      { select, execute } as unknown as DatabasePort,
      undefined,
      () => "2026-08-23T00:00:00.000Z",
    );

    await expect(repository.moveFolder("folder-child", null)).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledWith(
      "UPDATE bookmark_folders SET parent_id = $1, updated_at = $2 WHERE id = $3",
      [null, "2026-08-23T00:00:00.000Z", "folder-child"],
    );

    await expect(repository.moveFolder("folder-parent", "folder-child")).rejects.toThrow("不能把文件夹移动到自己的子目录");
  });

  it("fills imported metadata without replacing an existing title or description", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository(
      { select: vi.fn(), execute } as unknown as DatabasePort,
      undefined,
      () => "2026-08-23T00:00:00.000Z",
    );

    await repository.updateBookmarkMetadata(
      "bookmark-1",
      "AI 生成的简介",
      "https://example.com/favicon.ico",
    );

    expect(execute).toHaveBeenCalledWith(expect.stringContaining("CASE WHEN TRIM(description) = ''"), [
      "AI 生成的简介",
      "https://example.com/favicon.ico",
      "2026-08-23T00:00:00.000Z",
      "bookmark-1",
    ]);
    expect(execute.mock.calls[0][0]).not.toContain("title =");
  });

  it("imports bookmarks while preserving nested folders", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const ids = ["folder-research", "folder-papers", "bookmark-1"];
    const repository = new BookmarksRepository(
      { select, execute } as unknown as DatabasePort,
      () => ids.shift() ?? "extra-id",
      () => "2026-08-21T00:00:00.000Z",
    );

    await expect(repository.importBookmarks([{
      url: "https://example.com/paper",
      normalizedUrl: "https://example.com/paper",
      title: "论文主页",
      folderPath: ["研究", "论文"],
    }], "skip")).resolves.toEqual({
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      enrichmentTargets: [{ id: "bookmark-1", url: "https://example.com/paper" }],
    });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bookmarks"), [
      "bookmark-1", "https://example.com/paper", "https://example.com/paper", "论文主页",
      "folder-papers", "2026-08-21T00:00:00.000Z",
    ]);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("does not create folders for skipped duplicate imports", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{
        id: "bookmark-existing", normalized_url: "https://example.com/", title: "Existing",
        description: "", favicon_url: null, folder_id: null,
        updated_at: "2026-08-20T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new BookmarksRepository({ select, execute } as unknown as DatabasePort);

    await expect(repository.importBookmarks([{
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      title: "Imported",
      folderPath: ["不应创建"],
    }], "skip")).resolves.toEqual({ importedCount: 0, updatedCount: 0, skippedCount: 1, enrichmentTargets: [] });
    expect(execute).not.toHaveBeenCalled();
  });

  it("previews duplicates already stored in the library", async () => {
    const select = vi.fn().mockResolvedValue([{ count: 2 }]);
    const repository = new BookmarksRepository({ select, execute: vi.fn() } as unknown as DatabasePort);
    await expect(repository.countExistingBookmarks([
      "https://example.com/a", "https://example.com/b", "https://example.com/c",
    ])).resolves.toBe(2);
    expect(select).toHaveBeenCalledWith(expect.stringContaining("normalized_url IN ($1, $2, $3)"), [
      "https://example.com/a", "https://example.com/b", "https://example.com/c",
    ]);
  });
});
