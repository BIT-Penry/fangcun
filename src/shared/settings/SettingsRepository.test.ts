import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../db/types";
import { SettingsRepository } from "./SettingsRepository";

describe("SettingsRepository", () => {
  it("returns system when no theme preference exists", async () => {
    const db = { select: vi.fn().mockResolvedValue([]), execute: vi.fn() } as unknown as DatabasePort;
    await expect(new SettingsRepository(db).getThemePreference()).resolves.toBe("system");
  });

  it("upserts the selected theme", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const db = { select: vi.fn(), execute } as unknown as DatabasePort;
    await new SettingsRepository(db).setThemePreference("dark");
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(key) DO UPDATE"),
      ["theme", "dark"],
    );
  });

  it("ignores an invalid stored theme", async () => {
    const db = {
      select: vi.fn().mockResolvedValue([{ value: "sepia" }]),
      execute: vi.fn(),
    } as unknown as DatabasePort;
    await expect(new SettingsRepository(db).getThemePreference()).resolves.toBe("system");
  });

  it("persists and validates the preferred browser", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const db = { select: vi.fn().mockResolvedValue([{ value: "chrome" }]), execute } as unknown as DatabasePort;
    const repository = new SettingsRepository(db);
    await expect(repository.getBrowserPreference()).resolves.toBe("chrome");
    await repository.setBrowserPreference("firefox");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT(key) DO UPDATE"), ["browser", "firefox"]);
  });
});
