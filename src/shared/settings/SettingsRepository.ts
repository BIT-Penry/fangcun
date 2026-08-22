import type { ThemePreference } from "../../app/theme/theme";
import type { BrowserPreference } from "../openExternal";
import type { DatabasePort } from "../db/types";

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];
const BROWSERS: readonly BrowserPreference[] = ["system", "safari", "chrome", "edge", "firefox"];

export class SettingsRepository {
  constructor(private readonly db: DatabasePort) {}

  async getThemePreference(): Promise<ThemePreference> {
    const rows = await this.db.select<{ value: string }>(
      "SELECT value FROM settings WHERE key = $1 LIMIT 1",
      ["theme"],
    );
    const value = rows[0]?.value;
    return THEMES.includes(value as ThemePreference) ? value as ThemePreference : "system";
  }

  async setThemePreference(value: ThemePreference): Promise<void> {
    await this.db.execute(
      `INSERT INTO settings(key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ["theme", value],
    );
  }

  async getBrowserPreference(): Promise<BrowserPreference> {
    const rows = await this.db.select<{ value: string }>(
      "SELECT value FROM settings WHERE key = $1 LIMIT 1",
      ["browser"],
    );
    const value = rows[0]?.value;
    return BROWSERS.includes(value as BrowserPreference) ? value as BrowserPreference : "system";
  }

  async setBrowserPreference(value: BrowserPreference): Promise<void> {
    await this.db.execute(
      `INSERT INTO settings(key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ["browser", value],
    );
  }
}
