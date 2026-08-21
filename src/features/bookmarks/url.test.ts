import { describe, expect, it } from "vitest";
import { BookmarkUrlError, normalizeBookmarkUrl } from "./url";

describe("normalizeBookmarkUrl", () => {
  it("normalizes the host, default port, root path, and fragment", () => {
    expect(normalizeBookmarkUrl(" HTTPS://Example.COM:443#section ")).toBe("https://example.com/");
  });

  it("keeps paths and query parameter order", () => {
    expect(normalizeBookmarkUrl("https://example.com/docs?b=2&a=1#part"))
      .toBe("https://example.com/docs?b=2&a=1");
  });

  it("rejects unsupported and incomplete addresses", () => {
    expect(() => normalizeBookmarkUrl("ftp://example.com")).toThrow(BookmarkUrlError);
    expect(() => normalizeBookmarkUrl("example.com")).toThrow("请输入完整的网页地址");
  });
});
