export class BookmarkUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookmarkUrlError";
  }
}

export function normalizeBookmarkUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new BookmarkUrlError("请输入完整的网页地址，例如 https://example.com");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BookmarkUrlError("只支持 http 或 https 网页地址");
  }

  url.hash = "";
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }
  return url.toString();
}

export function bookmarkHostname(input: string): string {
  return new URL(normalizeBookmarkUrl(input)).hostname;
}
