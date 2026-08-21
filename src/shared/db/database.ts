import Database from "@tauri-apps/plugin-sql";
import type { DatabasePort } from "./types";

type DatabaseLoader = (url: string) => Promise<DatabasePort>;
const defaultLoader: DatabaseLoader = (url) => Database.load(url) as Promise<DatabasePort>;
let databasePromise: Promise<DatabasePort> | null = null;

export function initializeDatabase(loader: DatabaseLoader = defaultLoader): Promise<DatabasePort> {
  databasePromise ??= loader("sqlite:fangcun.db").catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

export function resetDatabaseForTests(): void {
  databasePromise = null;
}
