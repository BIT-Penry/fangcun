import { Navigate, Route, Routes } from "react-router-dom";
import { BookmarksPage } from "../features/bookmarks/BookmarksPage";
import { FormulaPage } from "../features/formula/FormulaPage";
import { HomePage } from "../features/home/HomePage";
import { JournalPage } from "../features/journal/JournalPage";
import { PromptsPage } from "../features/prompts/PromptsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SkillDetailPage } from "../features/skills/SkillDetailPage";
import { SkillsPage } from "../features/skills/SkillsPage";
import { ToolboxPage } from "../features/tools/ToolboxPage";
import { SpeedTestPage } from "../features/tools/SpeedTestPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/bookmarks" element={<BookmarksPage />} />
      <Route path="/prompts" element={<PromptsPage />} />
      <Route path="/skills" element={<SkillsPage />} />
      <Route path="/skills/:skillId" element={<SkillDetailPage />} />
      <Route path="/tools" element={<ToolboxPage />} />
      <Route path="/tools/formula" element={<FormulaPage />} />
      <Route path="/tools/speed-test" element={<SpeedTestPage />} />
      <Route path="/formula" element={<Navigate to="/tools/formula" replace />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
