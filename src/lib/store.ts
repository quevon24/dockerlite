import { getStore, type Store } from "@tauri-apps/plugin-store";

export interface AppSettings {
  socketPath: string;
  refreshIntervalContainers: number;
  refreshIntervalImages: number;
  refreshIntervalVolumes: number;
  refreshIntervalNetworks: number;
  theme: "dark" | "light";
  logBufferSize: number;
  minimizeToTray: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  socketPath: "/var/run/docker.sock",
  refreshIntervalContainers: 3000,
  refreshIntervalImages: 10000,
  refreshIntervalVolumes: 10000,
  refreshIntervalNetworks: 10000,
  theme: "dark",
  logBufferSize: 10000,
  minimizeToTray: false,
};

const STORE_PATH = "settings.json";

let storeInstance: Store | null = null;

/**
 * The store is created by the Rust side at startup; the webview only holds
 * the `get-store` capability (a handle to an existing store), so it cannot
 * load or create stores at arbitrary paths.
 */
async function getSettingsStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await getStore(STORE_PATH);
  }
  if (!storeInstance) {
    throw new Error("Settings store was not initialized by the backend");
  }
  return storeInstance;
}

/**
 * Validate persisted settings field by field: settings.json can be edited
 * by hand, so wrong types or out-of-range values fall back to defaults.
 */
function sanitizeSettings(saved: Partial<AppSettings>): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  if (typeof merged.socketPath !== "string" || merged.socketPath.length === 0) {
    merged.socketPath = DEFAULT_SETTINGS.socketPath;
  }
  const numericKeys = [
    "refreshIntervalContainers",
    "refreshIntervalImages",
    "refreshIntervalVolumes",
    "refreshIntervalNetworks",
    "logBufferSize",
  ] as const;
  for (const key of numericKeys) {
    const value = merged[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      merged[key] = DEFAULT_SETTINGS[key];
    }
  }
  if (merged.theme !== "dark" && merged.theme !== "light") {
    merged.theme = DEFAULT_SETTINGS.theme;
  }
  if (typeof merged.minimizeToTray !== "boolean") {
    merged.minimizeToTray = DEFAULT_SETTINGS.minimizeToTray;
  }
  return merged;
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getSettingsStore();
    const saved = await store.get<Partial<AppSettings>>("settings");
    return sanitizeSettings(saved ?? {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getSettingsStore();
  await store.set("settings", settings);
  await store.save();
}
