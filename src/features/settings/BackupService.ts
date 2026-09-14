import { getVersion } from "@tauri-apps/api/app";
import { appDataDir, join, tempDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { BaseDirectory, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import type { DatabasePort } from "../../shared/db/types";
import { createBackupArchive, readBackupArchive } from "./backupArchive";

function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}

export class BackupService {
  constructor(private readonly db: DatabasePort) {}

  async getAppInfo(): Promise<{ version: string; dataLocation: string }> {
    const [version, dataLocation] = await Promise.all([getVersion(), appDataDir()]);
    return { version, dataLocation };
  }

  async createBackup(): Promise<string | null> {
    const target = await save({
      defaultPath: `fangcun-backup-${timestampForFilename()}.zip`,
      filters: [{ name: "方寸备份", extensions: ["zip"] }],
    });
    if (!target) return null;
    const database = await this.snapshotDatabase();
    const archive = createBackupArchive(database, await getVersion(), new Date().toISOString());
    await writeFile(target, archive);
    return target;
  }

  async restoreBackup(): Promise<string | null> {
    const source = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "方寸备份", extensions: ["zip"] }],
    });
    if (!source || Array.isArray(source)) return null;
    const incoming = readBackupArchive(await readFile(source));
    const current = await this.snapshotDatabase();
    const safetyName = `fangcun-before-restore-${timestampForFilename()}.zip`;
    const safetyArchive = createBackupArchive(current, await getVersion(), new Date().toISOString());
    await writeFile(safetyName, safetyArchive, { baseDir: BaseDirectory.AppData });

    if (!this.db.close) throw new Error("当前数据库连接无法安全关闭");
    await this.db.close("sqlite:fangcun.db");
    try {
      await this.removeSidecar("fangcun.db-wal");
      await this.removeSidecar("fangcun.db-shm");
      await writeFile("fangcun.db", incoming.database, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      await writeFile("fangcun.db", current, { baseDir: BaseDirectory.AppData });
      throw error;
    }
    window.location.reload();
    return safetyName;
  }

  private async snapshotDatabase(): Promise<Uint8Array> {
    const temporaryPath = await join(await tempDir(), `fangcun-snapshot-${crypto.randomUUID()}.db`);
    try {
      await this.db.execute("VACUUM INTO $1", [temporaryPath]);
      return await readFile(temporaryPath);
    } finally {
      try { await remove(temporaryPath); } catch { /* snapshot may not have been created */ }
    }
  }

  private async removeSidecar(name: string): Promise<void> {
    try { await remove(name, { baseDir: BaseDirectory.AppData }); } catch { /* file is optional */ }
  }
}
