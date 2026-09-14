import { describe, expect, it } from "vitest";
import { buildBookmarkHtml } from "./export";
import { parseBookmarkHtml } from "./import";
import type { Bookmark, BookmarkFolder } from "./types";

describe("buildBookmarkHtml", () => {
  it("exports browser-compatible HTML while preserving nested folders", () => {
    const folders: BookmarkFolder[] = [
      { id: "research", name: "研究 & 资料", parentId: null },
      { id: "papers", name: "论文", parentId: "research" },
    ];
    const bookmarks: Bookmark[] = [{
      id: "bookmark-1",
      url: "https://example.com/search?q=a&lang=zh",
      normalizedUrl: "https://example.com/search?q=a&lang=zh",
      title: "示例 <文档>",
      description: "",
      faviconUrl: null,
      folderId: "papers",
      folderName: "论文",
      tags: [],
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T01:00:00.000Z",
    }];

    const html = buildBookmarkHtml(bookmarks, folders);
    expect(html).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
    expect(html).toContain("研究 &amp; 资料");
    expect(html).toContain("示例 &lt;文档&gt;");
    expect(html).toContain("q=a&amp;lang=zh");
    expect(parseBookmarkHtml(html).bookmarks).toEqual([
      expect.objectContaining({
        title: "示例 <文档>",
        url: "https://example.com/search?q=a&lang=zh",
        folderPath: ["研究 & 资料", "论文"],
      }),
    ]);
  });

  it("keeps unfiled bookmarks at the export root", () => {
    const html = buildBookmarkHtml([{
      id: "bookmark-root",
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      title: "根目录书签",
      description: "",
      faviconUrl: null,
      folderId: null,
      folderName: null,
      tags: [],
      createdAt: "",
      updatedAt: "",
    }], []);

    expect(parseBookmarkHtml(html).bookmarks[0]).toEqual(expect.objectContaining({
      title: "根目录书签",
      folderPath: [],
    }));
  });
});
