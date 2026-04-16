import type { ContainerState } from "../../lib/types";

interface StatusBadgeProps {
  state: ContainerState;
  label?: string;
}

const STATE_COLORS: Record<string, string> = {
  running: "bg-success",
  paused: "bg-warning",
  restarting: "bg-warning animate-pulse",
  exited: "bg-text-muted",
  created: "bg-accent",
  removing: "bg-danger animate-pulse",
  dead: "bg-danger",
  "": "bg-text-muted",
};

export default function StatusBadge({ state, label }: StatusBadgeProps) {
  const color = STATE_COLORS[state] ?? "bg-text-muted";
  const displayLabel = label ?? state ?? "unknown";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="capitalize">{displayLabel}</span>
    </span>
  );
}
