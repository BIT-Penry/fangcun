import type { Bookmark, BookmarkFolder } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function epochSeconds(value: string): string {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? "" : String(Math.floor(timestamp / 1000));
}

export function buildBookmarkHtml(bookmarks: Bookmark[], folders: BookmarkFolder[]): string {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const childrenByParent = new Map<string | null, BookmarkFolder[]>();
  const bookmarksByFolder = new Map<string | null, Bookmark[]>();

  for (const folder of folders) {
    const parentId = folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), folder]);
  }
  for (const bookmark of bookmarks) {
    const folderId = bookmark.folderId && folderIds.has(bookmark.folderId) ? bookmark.folderId : null;
    bookmarksByFolder.set(folderId, [...(bookmarksByFolder.get(folderId) ?? []), bookmark]);
  }

  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>方寸书签</TITLE>",
    "<H1>方寸书签</H1>",
    "<DL><p>",
  ];
  const renderedFolders = new Set<string>();
  const compareNames = (left: { name?: string; title?: string }, right: { name?: string; title?: string }) =>
    (left.name ?? left.title ?? "").localeCompare(right.name ?? right.title ?? "", "zh-CN", { numeric: true });

  const renderBookmark = (bookmark: Bookmark, depth: number) => {
    const indent = "    ".repeat(depth);
    const addDate = epochSeconds(bookmark.createdAt);
    const modified = epochSeconds(bookmark.updatedAt);
    const attributes = [
      `HREF="${escapeHtml(bookmark.url)}"`,
      addDate ? `ADD_DATE="${addDate}"` : "",
      modified ? `LAST_MODIFIED="${modified}"` : "",
    ].filter(Boolean).join(" ");
    lines.push(`${indent}<DT><A ${attributes}>${escapeHtml(bookmark.title)}</A>`);
  };

  const renderLevel = (parentId: string | null, depth: number, ancestors: Set<string>) => {
    for (const bookmark of [...(bookmarksByFolder.get(parentId) ?? [])].sort(compareNames)) {
      renderBookmark(bookmark, depth);
    }
    for (const folder of [...(childrenByParent.get(parentId) ?? [])].sort(compareNames)) {
      if (ancestors.has(folder.id) || renderedFolders.has(folder.id)) continue;
      renderedFolders.add(folder.id);
      const indent = "    ".repeat(depth);
      lines.push(`${indent}<DT><H3>${escapeHtml(folder.name)}</H3>`);
      lines.push(`${indent}<DL><p>`);
      renderLevel(folder.id, depth + 1, new Set(ancestors).add(folder.id));
      lines.push(`${indent}</DL><p>`);
    }
  };

  renderLevel(null, 1, new Set());
  for (const folder of folders) {
    if (renderedFolders.has(folder.id)) continue;
    childrenByParent.set(null, [...(childrenByParent.get(null) ?? []), { ...folder, parentId: null }]);
  }
  renderLevel(null, 1, new Set());
  lines.push("</DL><p>");
  return `${lines.join("\n")}\n`;
}
