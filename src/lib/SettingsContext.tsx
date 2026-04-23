import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      applyTheme(s.theme);
      setMinimizeToTray(s.minimizeToTray).catch(() => {});
      setLoading(false);
    });
  }, []);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next).catch(() => {});
      if (partial.theme) applyTheme(partial.theme);
      if (partial.minimizeToTray !== undefined) {
        setMinimizeToTray(partial.minimizeToTray).catch(() => {});
      }
      return next;
    });
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
