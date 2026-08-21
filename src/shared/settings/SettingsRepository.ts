import type { ThemePreference } from "../../app/theme/theme";
import type { DatabasePort } from "../db/types";

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];

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
}
