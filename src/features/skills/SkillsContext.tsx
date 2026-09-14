import { createContext, useContext, type ReactNode } from "react";
import type { SkillsStore } from "./types";

const SkillsContext = createContext<SkillsStore | null>(null);

export function SkillsProvider({ repository, children }: { repository: SkillsStore; children: ReactNode }) {
  return <SkillsContext.Provider value={repository}>{children}</SkillsContext.Provider>;
}

export function useSkillsStore(): SkillsStore {
  const repository = useContext(SkillsContext);
  if (!repository) throw new Error("useSkillsStore must be used inside SkillsProvider");
  return repository;
}
