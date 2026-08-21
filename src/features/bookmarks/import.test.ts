import { describe, expect, it } from "vitest";
import { parseBookmarkHtml } from "./import";

describe("parseBookmarkHtml", () => {
  it("preserves nested folder paths and ignores unsupported links", () => {
    const preview = parseBookmarkHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL><p>
        <DT><H3>研究</H3>
        <DL><p>
          <DT><H3>论文</H3>
          <DL><p>
            <DT><A HREF="https://Example.com:443/paper#intro">论文主页</A>
            <DT><A HREF="ftp://example.com/file">旧文件</A>
          </DL><p>
        </DL><p>
      </DL><p>`);

    expect(preview.bookmarks).toEqual([{
      url: "https://Example.com:443/paper#intro",
      normalizedUrl: "https://example.com/paper",
      title: "论文主页",
      folderPath: ["研究", "论文"],
    }]);
    expect(preview.folderPaths).toEqual([["研究"], ["研究", "论文"]]);
    expect(preview.invalidCount).toBe(1);
    expect(preview.existingCount).toBe(0);
  });

  it("deduplicates normalized URLs inside one file", () => {
    const preview = parseBookmarkHtml(`<DL><p>
      <DT><A HREF="https://example.com">Example</A>
      <DT><A HREF="https://EXAMPLE.com:443/#section">Example duplicate</A>
    </DL><p>`);
    expect(preview.bookmarks).toHaveLength(1);
    expect(preview.duplicateInFileCount).toBe(1);
  });

  it("rejects files without a bookmark list", () => {
    expect(() => parseBookmarkHtml("<html><body>not bookmarks</body></html>"))
      .toThrow("没有找到浏览器书签列表");
  });
});
