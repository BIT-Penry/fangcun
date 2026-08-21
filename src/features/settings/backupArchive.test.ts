import { strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { createBackupArchive, readBackupArchive } from "./backupArchive";

function sqliteBytes(): Uint8Array {
  const header = strToU8("SQLite format 3\0");
  const database = new Uint8Array(128);
  database.set(header);
  return database;
}

describe("backup archive", () => {
  it("round-trips the database and versioned manifest", () => {
    const archive = createBackupArchive(sqliteBytes(), "0.1.0", "2026-08-22T00:00:00.000Z");
    const restored = readBackupArchive(archive);
    expect(restored.database).toEqual(sqliteBytes());
    expect(restored.manifest).toEqual({
      formatVersion: 1,
      product: "fangcun",
      appVersion: "0.1.0",
      createdAt: "2026-08-22T00:00:00.000Z",
    });
  });

  it("rejects invalid archives", () => {
    expect(() => readBackupArchive(strToU8("not a zip"))).toThrow("不是有效的 ZIP");
  });
});
