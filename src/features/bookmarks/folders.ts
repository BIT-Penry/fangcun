import type { BookmarkFolder } from "./types";

export interface BookmarkFolderOption {
  id: string;
  path: string;
  depth: number;
}

export function buildBookmarkFolderOptions(folders: BookmarkFolder[]): BookmarkFolderOption[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const memo = new Map<string, string[]>();

  const resolve = (id: string, visiting = new Set<string>()): string[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    const folder = byId.get(id);
    if (!folder || visiting.has(id)) return [];
    const nextVisiting = new Set(visiting).add(id);
    const parent = folder.parentId ? resolve(folder.parentId, nextVisiting) : [];
    const path = [...parent, folder.name];
    memo.set(id, path);
    return path;
  };

  return folders.map((folder) => {
    const parts = resolve(folder.id);
    return { id: folder.id, path: parts.join(" / "), depth: Math.max(0, parts.length - 1) };
  }).sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
}

export function folderPathById(folders: BookmarkFolder[]): Map<string, string> {
  return new Map(buildBookmarkFolderOptions(folders).map((folder) => [folder.id, folder.path]));
}
