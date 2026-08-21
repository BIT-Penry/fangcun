import { invoke } from "@tauri-apps/api/core";

export interface BookmarkMetadata {
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
}

export function fetchBookmarkMetadata(url: string): Promise<BookmarkMetadata> {
  return invoke<BookmarkMetadata>("fetch_bookmark_metadata", { url });
}
