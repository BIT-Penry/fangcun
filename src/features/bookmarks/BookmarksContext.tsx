import { createContext, useContext, type ReactNode } from "react";
import type { BookmarksStore } from "./types";

const BookmarksContext = createContext<BookmarksStore | null>(null);

export function BookmarksProvider({ repository, children }: {
  repository: BookmarksStore;
  children: ReactNode;
}) {
  return <BookmarksContext.Provider value={repository}>{children}</BookmarksContext.Provider>;
}

export function useBookmarksStore(): BookmarksStore {
  const repository = useContext(BookmarksContext);
  if (!repository) throw new Error("useBookmarksStore must be used inside BookmarksProvider");
  return repository;
}
