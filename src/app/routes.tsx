import { Route, Routes } from "react-router-dom";
import { BookmarksPage } from "../features/bookmarks/BookmarksPage";
import { HomePage } from "../features/home/HomePage";
import { JournalPage } from "../features/journal/JournalPage";
import { PromptsPage } from "../features/prompts/PromptsPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/bookmarks" element={<BookmarksPage />} />
      <Route path="/prompts" element={<PromptsPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
