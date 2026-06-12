import { NavLink } from "react-router-dom";
import { Box, Layers, HardDrive, Network, Trash2, Settings } from "lucide-react";
import { useSystemInfo } from "../../lib/hooks/useSystemInfo";

const navItems = [
  { to: "/", icon: Box, label: "Containers", end: true },
  { to: "/images", icon: Layers, label: "Images" },
  { to: "/volumes", icon: HardDrive, label: "Volumes" },
  { to: "/networks", icon: Network, label: "Networks" },
  { to: "/system", icon: Trash2, label: "Cleanup" },
];

function navClass({ isActive }: { isActive: boolean }): string {
  const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors";
  if (isActive) {
    return `${base} bg-surface-overlay text-docker-blue font-medium`;
  }
  return `${base} text-text-secondary hover:text-text-primary hover:bg-surface-raised`;
}

export default function Sidebar() {
  const { data, error } = useSystemInfo(10_000);

  const connected = data !== null && error === null;

  return (
    <aside className="w-60 h-full bg-surface-raised border-r border-border flex flex-col shrink-0">
      <div className="p-4 flex items-center gap-2.5">
        <Box className="w-6 h-6 text-docker-blue" />
        <span className="text-lg font-semibold text-text-primary">DockerLite</span>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-2">
        <NavLink to="/settings" className={navClass}>
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </NavLink>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-success" : "bg-danger"}`} />
          <span>{connected ? "Connected" : "Disconnected"}</span>
          {data && <span className="ml-auto text-text-muted">v{data.dockerVersion}</span>}
        </div>
      </div>
    </aside>
  );
}
