import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyTheme, resolveTheme, type ThemePreference } from "./theme";

export type ThemeSaveStatus = "idle" | "saving" | "saved" | "error";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => Promise<void>;
  resolvedTheme: "light" | "dark";
  saveStatus: ThemeSaveStatus;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPreference = "system",
  onPreferenceChange = async () => undefined,
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
  onPreferenceChange?: (value: ThemePreference) => Promise<void>;
}) {
  const media = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [saveStatus, setSaveStatus] = useState<ThemeSaveStatus>("idle");
  const [systemDark, setSystemDark] = useState(media.matches);
  const saveInFlight = useRef(false);
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [media]);

  useEffect(() => applyTheme(document.documentElement, resolvedTheme), [resolvedTheme]);

  const setPreference = useCallback(async (value: ThemePreference): Promise<void> => {
    if (saveInFlight.current || value === preference) return;
    saveInFlight.current = true;
    const previous = preference;
    setPreferenceState(value);
    setSaveStatus("saving");
    try {
      await onPreferenceChange(value);
      setSaveStatus("saved");
    } catch {
      setPreferenceState(previous);
      setSaveStatus("error");
    } finally {
      saveInFlight.current = false;
    }
  }, [onPreferenceChange, preference]);

  const value = useMemo(
    () => ({ preference, setPreference, resolvedTheme, saveStatus }),
    [preference, resolvedTheme, saveStatus, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
