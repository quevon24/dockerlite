import { useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { RotateCw, CheckCircle2, Moon, Sun, Monitor } from "lucide-react";
import type { AppSettings } from "../lib/store";
import { useSettings } from "../lib/SettingsContext";
import { reconnectDocker } from "../lib/tauri";
import { useToast } from "../components/ui/Toast";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [socketPath, setSocketPath] = useState(settings.socketPath);
  const [testing, setTesting] = useState(false);

  // Settings load asynchronously; re-seed the input when the persisted
  // value arrives (otherwise the page shows the default path on app start).
  useEffect(() => {
    setSocketPath(settings.socketPath);
  }, [settings.socketPath]);

  const testConnection = async () => {
    setTesting(true);
    try {
      await reconnectDocker(socketPath);
      await update({ socketPath });
      toast("Connected", `Docker socket at ${socketPath}`, "success");
    } catch (e) {
      toast("Connection failed", String(e), "error");
    } finally {
      setTesting(false);
    }
  };

  const intervalOptions = [
    { label: "1s", value: 1000 },
    { label: "3s", value: 3000 },
    { label: "5s", value: 5000 },
    { label: "10s", value: 10000 },
    { label: "30s", value: 30000 },
  ];

  const themeOptions: {
    value: AppSettings["theme"];
    label: string;
    hint: string;
    icon: typeof Moon;
  }[] = [
    { value: "dark", label: "Dark", hint: "Always use the dark theme", icon: Moon },
    { value: "light", label: "Light", hint: "Always use the light theme", icon: Sun },
    {
      value: "system",
      label: "System",
      hint: "Follow your OS / desktop appearance setting",
      icon: Monitor,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="space-y-6">
        <section className="bg-surface-raised border border-border rounded-lg p-5">
          <h2 className="text-base font-medium mb-4">Docker Connection</h2>
          <label className="block text-sm text-text-secondary mb-2">Socket path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={socketPath}
              onChange={(e) => setSocketPath(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-docker-blue transition-colors"
            />
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-docker-blue text-surface font-medium hover:bg-docker-blue/80 disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Test
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">Default: /var/run/docker.sock</p>
        </section>

        <section className="bg-surface-raised border border-border rounded-lg p-5">
          <h2 className="text-base font-medium mb-4">Refresh Intervals</h2>
          <div className="space-y-4">
            {[
              { key: "refreshIntervalContainers" as const, label: "Containers" },
              { key: "refreshIntervalImages" as const, label: "Images" },
              { key: "refreshIntervalVolumes" as const, label: "Volumes" },
              { key: "refreshIntervalNetworks" as const, label: "Networks" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{label}</span>
                <div className="flex gap-1">
                  {intervalOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update({ [key]: opt.value })}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        settings[key] === opt.value
                          ? "bg-docker-blue text-surface font-medium"
                          : "bg-surface-overlay text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-raised border border-border rounded-lg p-5">
          <h2 className="text-base font-medium mb-4">Appearance</h2>
          <fieldset>
            <legend className="sr-only">Theme</legend>
            <div className="space-y-1">
              {themeOptions.map(({ value, label, hint, icon: Icon }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-overlay transition-colors"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={settings.theme === value}
                    onChange={() => update({ theme: value })}
                    className="peer sr-only"
                  />
                  <span className="relative w-4 h-4 shrink-0 rounded-full border-2 border-text-muted transition-colors peer-checked:border-docker-blue after:absolute after:inset-0 after:m-auto after:h-2 after:w-2 after:scale-0 after:rounded-full after:bg-docker-blue after:transition-transform peer-checked:after:scale-100" />
                  <Icon className="w-4 h-4 shrink-0 text-text-secondary" />
                  <div>
                    <span className="text-sm text-text-primary">{label}</span>
                    <p className="text-xs text-text-muted mt-0.5">{hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="bg-surface-raised border border-border rounded-lg p-5">
          <h2 className="text-base font-medium mb-4">Window Behavior</h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-text-primary">Minimize to tray on close</span>
              <p className="text-xs text-text-muted mt-0.5">
                Hide the window to the system tray instead of quitting. Right-click the tray icon to
                open or quit.
              </p>
            </div>
            <Switch.Root
              checked={settings.minimizeToTray}
              onCheckedChange={(checked) => update({ minimizeToTray: checked })}
              className="w-10 h-5 rounded-full bg-surface-overlay data-[state=checked]:bg-docker-blue transition-colors"
            >
              <Switch.Thumb className="block w-4 h-4 rounded-full bg-text-primary translate-x-0.5 transition-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>
        </section>

        <section className="bg-surface-raised border border-border rounded-lg p-5">
          <h2 className="text-base font-medium mb-4">Log Viewer</h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-text-secondary">Buffer size</span>
              <p className="text-xs text-text-muted mt-0.5">
                Maximum log lines kept in memory per container
              </p>
            </div>
            <div className="flex gap-1">
              {[5000, 10000, 25000, 50000].map((size) => (
                <button
                  key={size}
                  onClick={() => update({ logBufferSize: size })}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    settings.logBufferSize === size
                      ? "bg-docker-blue text-surface font-medium"
                      : "bg-surface-overlay text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {(size / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
