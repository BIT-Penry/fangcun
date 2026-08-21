import { beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "./database";
import type { DatabasePort } from "./types";

describe("database adapter", () => {
  beforeEach(() => resetDatabaseForTests());

  it("loads the application database once", async () => {
    const fakeDb = {} as DatabasePort;
    const loader = vi.fn().mockResolvedValue(fakeDb);
    await expect(initializeDatabase(loader)).resolves.toBe(fakeDb);
    await expect(initializeDatabase(loader)).resolves.toBe(fakeDb);
    expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith("sqlite:fangcun.db");
  });

  it("allows retry after an initialization failure", async () => {
    const fakeDb = {} as DatabasePort;
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("open failed"))
      .mockResolvedValueOnce(fakeDb);
    await expect(initializeDatabase(loader)).rejects.toThrow("open failed");
    await expect(initializeDatabase(loader)).resolves.toBe(fakeDb);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
