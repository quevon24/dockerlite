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
  // update() calls that land before the async load resolves are recorded
  // here so the load can't clobber them (and they get re-persisted on top
  // of the loaded values).
  const loadedRef = useRef(false);
  const pendingRef = useRef<Partial<AppSettings>>({});

  useEffect(() => {
    loadSettings().then((s) => {
      const next = { ...s, ...pendingRef.current };
      const hadPending = Object.keys(pendingRef.current).length > 0;
      loadedRef.current = true;
      pendingRef.current = {};
      settingsRef.current = next;
      setSettings(next);
      applyTheme(next.theme);
      setMinimizeToTray(next.minimizeToTray).catch(() => {});
      setLoading(false);
      // An early update() persisted defaults + partial; rewrite the merged
      // result so disk matches memory.
      if (hadPending) saveSettings(next).catch(() => {});
    });
  }, []);

  // Side effects run outside the state updater: updaters must be pure
  // (StrictMode double-invokes them, so saving inside would persist twice).
  const update = useCallback(async (partial: Partial<AppSettings>) => {
    if (!loadedRef.current) {
      pendingRef.current = { ...pendingRef.current, ...partial };
    }
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
