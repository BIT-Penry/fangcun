import type { BookmarkImportPreview, ImportedBookmark } from "./types";
import { normalizeBookmarkUrl } from "./url";

function directChild(element: Element, selector: string): Element | null {
  return Array.from(element.children).find((child) => child.matches(selector)) ?? null;
}

export function parseBookmarkHtml(html: string): BookmarkImportPreview {
  const document = new DOMParser().parseFromString(html, "text/html");
  const root = document.querySelector("dl");
  if (!root) throw new Error("没有找到浏览器书签列表，请选择 Bookmark HTML 文件");

  const bookmarks: ImportedBookmark[] = [];
  const folderPaths: string[][] = [];
  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateInFileCount = 0;

  const addBookmark = (anchor: Element, path: string[]) => {
    const url = anchor.getAttribute("href")?.trim() ?? "";
    try {
      const normalizedUrl = normalizeBookmarkUrl(url);
      if (seen.has(normalizedUrl)) {
        duplicateInFileCount += 1;
        return;
      }
      seen.add(normalizedUrl);
      bookmarks.push({
        url,
        normalizedUrl,
        title: anchor.textContent?.trim() || new URL(normalizedUrl).hostname,
        folderPath: path,
      });
    } catch {
      invalidCount += 1;
    }
  };

  const parseList = (list: Element, path: string[]) => {
    const entries = Array.from(list.children).flatMap((child) =>
      child.tagName.toLowerCase() === "p" ? Array.from(child.children) : [child]);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.tagName.toLowerCase() !== "dt") continue;
      const folder = directChild(entry, "h3");
      const anchor = directChild(entry, "a");
      if (anchor) addBookmark(anchor, path);
      if (!folder) continue;
      const name = folder.textContent?.trim();
      if (!name) continue;
      const nextPath = [...path, name];
      folderPaths.push(nextPath);
      const nested = directChild(entry, "dl")
        ?? (entries[index + 1]?.tagName.toLowerCase() === "dl" ? entries[index + 1] : null);
      if (nested) parseList(nested, nextPath);
    }
  };

  parseList(root, []);
  return { bookmarks, folderPaths, invalidCount, duplicateInFileCount, existingCount: 0 };
}
