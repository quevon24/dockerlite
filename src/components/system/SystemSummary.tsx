import { Box, Layers, Cpu, HardDrive, RefreshCw } from "lucide-react";
import { useSystemInfo } from "../../lib/hooks/useSystemInfo";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

interface CardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}

function SummaryCard({ icon, label, value, description }: CardProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-text-muted mt-1">{description}</div>
    </div>
  );
}

export default function SystemSummary() {
  const { data, error, loading, refresh } = useSystemInfo();

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface-raised rounded-lg p-4 border border-border animate-pulse h-24"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-6">
        <p className="text-danger font-medium">Failed to connect to Docker</p>
        <p className="text-text-secondary text-sm mt-2">{error}</p>
        <button
          onClick={refresh}
          className="mt-3 flex items-center gap-2 text-sm text-accent hover:text-docker-blue transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const paused = data.containersPaused > 0 ? `, ${data.containersPaused} paused` : "";
  const stopped = data.containersStopped > 0 ? `, ${data.containersStopped} stopped` : "";

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <SummaryCard
        icon={<Box className="w-5 h-5 text-docker-blue" />}
        label="Containers"
        value={`${data.containersRunning} running`}
        description={`${data.containersTotal} total${paused}${stopped}`}
      />
      <SummaryCard
        icon={<Layers className="w-5 h-5 text-accent" />}
        label="Images"
        value={String(data.images)}
        description="local images"
      />
      <SummaryCard
        icon={<Cpu className="w-5 h-5 text-success" />}
        label="Docker Engine"
        value={`v${data.dockerVersion}`}
        description={`${data.os} (${data.arch})`}
      />
      <SummaryCard
        icon={<HardDrive className="w-5 h-5 text-warning" />}
        label="System Memory"
        value={formatBytes(data.totalMemory)}
        description={`Kernel ${data.kernelVersion}`}
      />
    </div>
  );
}
