import { createContext, useContext, type ReactNode } from "react";
import type { PromptsStore } from "./types";

const PromptsContext = createContext<PromptsStore | null>(null);

export function PromptsProvider({ repository, children }: {
  repository: PromptsStore;
  children: ReactNode;
}) {
  return <PromptsContext.Provider value={repository}>{children}</PromptsContext.Provider>;
}

export function usePromptsStore(): PromptsStore {
  const repository = useContext(PromptsContext);
  if (!repository) throw new Error("usePromptsStore must be used inside PromptsProvider");
  return repository;
}
