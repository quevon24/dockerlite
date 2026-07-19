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

  // When following the OS theme, re-apply whenever the desktop switches
  // between light and dark (GNOME/KDE expose this via prefers-color-scheme).
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme]);

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

function resolveTheme(theme: AppSettings["theme"]): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: AppSettings["theme"]) {
  document.documentElement.classList.toggle("light", resolveTheme(theme) === "light");
}
