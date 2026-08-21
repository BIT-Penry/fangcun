import { useEffect, useState } from "react";
import { initializeDatabase } from "../shared/db/database";
import type { DatabasePort } from "../shared/db/types";
import { SettingsRepository } from "../shared/settings/SettingsRepository";
import { AppShell } from "./AppShell";
import type { ThemePreference } from "./theme/theme";
import { ThemeProvider } from "./theme/ThemeProvider";

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; theme: ThemePreference; repository: SettingsRepository }
  | { status: "error" };

export function AppBootstrap({ loadDatabase = initializeDatabase }: {
  loadDatabase?: () => Promise<DatabasePort>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadDatabase()
      .then(async (db) => {
        const repository = new SettingsRepository(db);
        const theme = await repository.getThemePreference();
        return { theme, repository };
      })
      .then(({ theme, repository }) => active && setState({ status: "ready", theme, repository }))
      .catch(() => active && setState({ status: "error" }));
    return () => { active = false; };
  }, [attempt, loadDatabase]);

  if (state.status === "loading") return <p>正在打开方寸…</p>;
  if (state.status === "error") {
    return <div role="alert">无法打开本地数据库 <button onClick={() => setAttempt((value) => value + 1)}>重试</button></div>;
  }
  return (
    <ThemeProvider
      initialPreference={state.theme}
      onPreferenceChange={(value) => state.repository.setThemePreference(value)}
    >
      <AppShell />
    </ThemeProvider>
  );
}
