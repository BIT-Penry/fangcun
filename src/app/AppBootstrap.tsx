import { useEffect, useState } from "react";
import { BookmarksProvider } from "../features/bookmarks/BookmarksContext";
import { BookmarksRepository } from "../features/bookmarks/BookmarksRepository";
import { PromptsProvider } from "../features/prompts/PromptsContext";
import { PromptsRepository } from "../features/prompts/PromptsRepository";
import { JournalProvider } from "../features/journal/JournalContext";
import { JournalRepository } from "../features/journal/JournalRepository";
import { BackupProvider } from "../features/settings/BackupContext";
import { BackupService } from "../features/settings/BackupService";
import { initializeDatabase } from "../shared/db/database";
import type { DatabasePort } from "../shared/db/types";
import { SettingsRepository } from "../shared/settings/SettingsRepository";
import { AppShell } from "./AppShell";
import { BrowserPreferenceProvider } from "./browser/BrowserPreferenceProvider";
import type { ThemePreference } from "./theme/theme";
import { ThemeProvider } from "./theme/ThemeProvider";
import type { BrowserPreference } from "../shared/openExternal";
import { SkillsProvider } from "../features/skills/SkillsContext";
import { SkillsRepository } from "../features/skills/SkillsRepository";

type BootstrapState =
  | { status: "loading" }
  | {
      status: "ready";
      theme: ThemePreference;
      browser: BrowserPreference;
      settingsRepository: SettingsRepository;
      bookmarksRepository: BookmarksRepository;
      promptsRepository: PromptsRepository;
      skillsRepository: SkillsRepository;
      journalRepository: JournalRepository;
      backupService: BackupService;
    }
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
        const settingsRepository = new SettingsRepository(db);
        const [theme, browser] = await Promise.all([
          settingsRepository.getThemePreference(),
          settingsRepository.getBrowserPreference(),
        ]);
        return {
          theme,
          browser,
          settingsRepository,
          bookmarksRepository: new BookmarksRepository(db),
          promptsRepository: new PromptsRepository(db),
          skillsRepository: new SkillsRepository(db),
          journalRepository: new JournalRepository(db),
          backupService: new BackupService(db),
        };
      })
      .then((ready) => active && setState({ status: "ready", ...ready }))
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
      onPreferenceChange={(value) => state.settingsRepository.setThemePreference(value)}
    >
      <BrowserPreferenceProvider
        initialPreference={state.browser}
        onPreferenceChange={(value) => state.settingsRepository.setBrowserPreference(value)}
      >
        <BookmarksProvider repository={state.bookmarksRepository}>
          <PromptsProvider repository={state.promptsRepository}>
            <SkillsProvider repository={state.skillsRepository}>
              <JournalProvider repository={state.journalRepository}>
                <BackupProvider service={state.backupService}>
                  <AppShell />
                </BackupProvider>
              </JournalProvider>
            </SkillsProvider>
          </PromptsProvider>
        </BookmarksProvider>
      </BrowserPreferenceProvider>
    </ThemeProvider>
  );
}
