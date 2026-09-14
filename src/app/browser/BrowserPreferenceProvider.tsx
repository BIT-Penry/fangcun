import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { BrowserPreference } from "../../shared/openExternal";

export type BrowserSaveStatus = "idle" | "saving" | "saved" | "error";

interface BrowserPreferenceContextValue {
  preference: BrowserPreference;
  setPreference: (value: BrowserPreference) => Promise<void>;
  saveStatus: BrowserSaveStatus;
}

const BrowserPreferenceContext = createContext<BrowserPreferenceContextValue | null>(null);

export function BrowserPreferenceProvider({
  children,
  initialPreference = "system",
  onPreferenceChange = async () => undefined,
}: {
  children: ReactNode;
  initialPreference?: BrowserPreference;
  onPreferenceChange?: (value: BrowserPreference) => Promise<void>;
}) {
  const [preference, setPreferenceState] = useState<BrowserPreference>(initialPreference);
  const [saveStatus, setSaveStatus] = useState<BrowserSaveStatus>("idle");
  const saveInFlight = useRef(false);

  const setPreference = useCallback(async (value: BrowserPreference) => {
    if (saveInFlight.current || value === preference) return;
    const previous = preference;
    saveInFlight.current = true;
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
    () => ({ preference, setPreference, saveStatus }),
    [preference, saveStatus, setPreference],
  );

  return <BrowserPreferenceContext.Provider value={value}>{children}</BrowserPreferenceContext.Provider>;
}

export function useBrowserPreference(): BrowserPreferenceContextValue {
  const value = useContext(BrowserPreferenceContext);
  if (!value) throw new Error("useBrowserPreference must be used inside BrowserPreferenceProvider");
  return value;
}
