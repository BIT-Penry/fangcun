import { createContext, useContext, type ReactNode } from "react";
import type { JournalStore } from "./types";

const JournalContext = createContext<JournalStore | null>(null);

export function JournalProvider({ repository, children }: {
  repository: JournalStore;
  children: ReactNode;
}) {
  return <JournalContext.Provider value={repository}>{children}</JournalContext.Provider>;
}

export function useJournalStore(): JournalStore {
  const repository = useContext(JournalContext);
  if (!repository) throw new Error("useJournalStore must be used inside JournalProvider");
  return repository;
}
