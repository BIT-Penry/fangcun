import { invoke } from "@tauri-apps/api/core";

export interface BookmarkMetadata {
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  aiEnhanced: boolean;
  warning: string | null;
}

export function fetchBookmarkMetadata(url: string): Promise<BookmarkMetadata> {
  return invoke<BookmarkMetadata>("fetch_bookmark_metadata", { url });
}

export function fetchAiBookmarkMetadata(url: string): Promise<BookmarkMetadata> {
  return invoke<BookmarkMetadata>("fetch_ai_bookmark_metadata", { url });
}

export function fetchImportBookmarkMetadata(url: string): Promise<BookmarkMetadata> {
  return invoke<BookmarkMetadata>("fetch_import_bookmark_metadata", { url });
}
