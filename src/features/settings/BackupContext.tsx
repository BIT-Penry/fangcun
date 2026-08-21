import { createContext, useContext, type ReactNode } from "react";
import type { BackupService } from "./BackupService";

const BackupContext = createContext<BackupService | null>(null);

export function BackupProvider({ service, children }: { service: BackupService; children: ReactNode }) {
  return <BackupContext.Provider value={service}>{children}</BackupContext.Provider>;
}

export function useBackupService(): BackupService {
  const service = useContext(BackupContext);
  if (!service) throw new Error("useBackupService must be used inside BackupProvider");
  return service;
}
