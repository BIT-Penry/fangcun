import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export interface BackupManifest {
  formatVersion: 1;
  product: "fangcun";
  appVersion: string;
  createdAt: string;
}

const DATABASE_NAME = "fangcun.db";
const MANIFEST_NAME = "manifest.json";

export function createBackupArchive(database: Uint8Array, appVersion: string, createdAt: string): Uint8Array {
  const manifest: BackupManifest = {
    formatVersion: 1,
    product: "fangcun",
    appVersion,
    createdAt,
  };
  return zipSync({
    [DATABASE_NAME]: database,
    [MANIFEST_NAME]: strToU8(JSON.stringify(manifest, null, 2)),
  }, { level: 6 });
}

export function readBackupArchive(archive: Uint8Array): { database: Uint8Array; manifest: BackupManifest } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(archive);
  } catch {
    throw new Error("备份文件不是有效的 ZIP 压缩包");
  }
  const database = files[DATABASE_NAME];
  const manifestBytes = files[MANIFEST_NAME];
  if (!database || !manifestBytes) throw new Error("备份文件缺少数据库或版本清单");

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  } catch {
    throw new Error("备份版本清单无法解析");
  }
  if (manifest.product !== "fangcun" || manifest.formatVersion !== 1) {
    throw new Error("备份格式不受当前版本支持");
  }
  if (strFromU8(database.subarray(0, 16)) !== "SQLite format 3\0") {
    throw new Error("备份中的数据库文件无效");
  }
  return { database, manifest };
}
