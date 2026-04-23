import { load } from "@tauri-apps/plugin-store";

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

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_PATH, { autoSave: true, defaults: {} });
  }
  return storeInstance;
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getStore();
    const saved = await store.get<Partial<AppSettings>>("settings");
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set("settings", settings);
}
