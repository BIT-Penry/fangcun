export interface BookmarkFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Bookmark {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  faviconUrl: string | null;
  folderId: string | null;
  folderName: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkInput {
  url: string;
  title: string;
  description: string;
  faviconUrl: string;
  folderName: string;
  tags: string[];
}

export interface ImportedBookmark {
  url: string;
  normalizedUrl: string;
  title: string;
  folderPath: string[];
}

export interface BookmarkImportPreview {
  bookmarks: ImportedBookmark[];
  folderPaths: string[][];
  invalidCount: number;
  duplicateInFileCount: number;
  existingCount: number;
}

export interface BookmarkImportResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export type BookmarkImportStrategy = "skip" | "fill";

export interface BookmarksStore {
  listBookmarks(): Promise<Bookmark[]>;
  listFolders(): Promise<BookmarkFolder[]>;
  createBookmark(input: BookmarkInput): Promise<void>;
  updateBookmark(id: string, input: BookmarkInput): Promise<void>;
  deleteBookmark(id: string): Promise<void>;
  importBookmarks(bookmarks: ImportedBookmark[], strategy: BookmarkImportStrategy): Promise<BookmarkImportResult>;
  searchBookmarks(query: string, limit?: number): Promise<Bookmark[]>;
  countExistingBookmarks(normalizedUrls: string[]): Promise<number>;
}
