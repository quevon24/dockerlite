import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useContainerStats } from "../../lib/hooks/useContainerStats";

interface StatsTabProps {
  containerId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString();
}

const CHART_THEME = {
  grid: "#30363d",
  text: "#8b949e",
  tooltip: "#161b22",
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
      </div>
      <div className="h-48">{children}</div>
    </div>
  );
}

export default function StatsTab({ containerId }: StatsTabProps) {
  const { history, latest, error } = useContainerStats(containerId);

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return <div className="text-text-muted text-sm italic">Waiting for stats...</div>;
  }

  const memSubtitle = latest
    ? `${formatBytes(latest.memoryUsed)} / ${formatBytes(latest.memoryLimit)}`
    : "";

  const cpuSubtitle = latest ? `${latest.cpuPercent.toFixed(1)}%` : "";

  const netSubtitle = latest
    ? `RX ${formatBytes(latest.networkRx)} / TX ${formatBytes(latest.networkTx)}`
    : "";

  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard title="CPU Usage" subtitle={cpuSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke={CHART_THEME.text}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={[0, "auto"]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              stroke={CHART_THEME.text}
              tick={{ fontSize: 10 }}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_THEME.tooltip,
                border: `1px solid ${CHART_THEME.grid}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(v) => [`${Number(v).toFixed(2)}%`, "CPU"]}
            />
            <Area
              type="monotone"
              dataKey="cpuPercent"
              stroke="#0db7ed"
              fill="#0db7ed"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Memory Usage" subtitle={memSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke={CHART_THEME.text}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={[0, "auto"]}
              tickFormatter={(v: number) => formatBytes(v)}
              stroke={CHART_THEME.text}
              tick={{ fontSize: 10 }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_THEME.tooltip,
                border: `1px solid ${CHART_THEME.grid}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(v) => [formatBytes(Number(v)), "Memory"]}
            />
            <Area
              type="monotone"
              dataKey="memoryUsed"
              stroke="#3fb950"
              fill="#3fb950"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Network I/O" subtitle={netSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke={CHART_THEME.text}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(v: number) => formatBytes(v)}
              stroke={CHART_THEME.text}
              tick={{ fontSize: 10 }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_THEME.tooltip,
                border: `1px solid ${CHART_THEME.grid}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(v, name) => [formatBytes(Number(v)), name === "networkRx" ? "RX" : "TX"]}
            />
            <Area
              type="monotone"
              dataKey="networkRx"
              stroke="#58a6ff"
              fill="#58a6ff"
              fillOpacity={0.1}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="networkTx"
              stroke="#d29922"
              fill="#d29922"
              fillOpacity={0.1}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
