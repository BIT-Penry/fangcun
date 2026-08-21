import { useTheme } from "../../app/theme/ThemeProvider";
import type { ThemePreference } from "../../app/theme/theme";

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

export function SettingsPage() {
  const { preference, setPreference, saveStatus } = useTheme();
  return (
    <section>
      <h1 className="text-xl font-medium">设置</h1>
      <fieldset className="mt-6">
        <legend className="font-medium">主题</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="mt-3 flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={preference === option.value}
              disabled={saveStatus === "saving"}
              onChange={() => void setPreference(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <p role="status" className="mt-3 text-sm">
        {saveStatus === "saving" && "保存中…"}
        {saveStatus === "saved" && "已保存"}
        {saveStatus === "error" && "保存失败，请重试"}
      </p>
    </section>
  );
}
