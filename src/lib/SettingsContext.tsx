import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from "./store";
import { setMinimizeToTray } from "./tauri";

interface SettingsContextValue {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: async () => {},
  loading: true,
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  // Latest settings, updated synchronously so rapid update() calls don't
  // clobber each other before React re-renders.
  const settingsRef = useRef(settings);

  useEffect(() => {
    loadSettings().then((s) => {
      settingsRef.current = s;
      setSettings(s);
      applyTheme(s.theme);
      setMinimizeToTray(s.minimizeToTray).catch(() => {});
      setLoading(false);
    });
  }, []);

  // Side effects run outside the state updater: updaters must be pure
  // (StrictMode double-invokes them, so saving inside would persist twice).
  const update = useCallback(async (partial: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    setSettings(next);
    if (partial.theme) applyTheme(partial.theme);
    if (partial.minimizeToTray !== undefined) {
      setMinimizeToTray(partial.minimizeToTray).catch(() => {});
    }
    await saveSettings(next).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("light", theme === "light");
}
