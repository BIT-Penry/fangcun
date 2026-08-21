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
  folderName: string;
  tags: string[];
}

export interface BookmarksStore {
  listBookmarks(): Promise<Bookmark[]>;
  listFolders(): Promise<BookmarkFolder[]>;
  createBookmark(input: BookmarkInput): Promise<void>;
  updateBookmark(id: string, input: BookmarkInput): Promise<void>;
  deleteBookmark(id: string): Promise<void>;
}
