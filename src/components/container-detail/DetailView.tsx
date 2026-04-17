import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useContainer } from "../../lib/hooks/useContainer";
import StatusBadge from "../ui/StatusBadge";
import ContainerActions from "../containers/ContainerActions";
import type { ContainerActionKind } from "../containers/ContainerActions";
import LogsTab from "./LogsTab";
import StatsTab from "./StatsTab";
import TerminalTab from "./TerminalTab";
import InspectTab from "./InspectTab";
import EnvTab from "./EnvTab";

interface DetailViewProps {
  containerId: string;
}

const TAB_TRIGGER =
  "px-4 py-2 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:text-docker-blue data-[state=active]:border-docker-blue transition-colors";

export default function DetailView({ containerId }: DetailViewProps) {
  const { data, error, loading, refresh } = useContainer(containerId);
  const navigate = useNavigate();
  const [logsResetKey, setLogsResetKey] = useState(0);

  const handleAction = (kind: ContainerActionKind) => {
    refresh();
    if (kind === "restart" || kind === "start") {
      setLogsResetKey((k) => k + 1);
    }
  };

  if (loading) {
    return (
      <div className="text-text-secondary">Loading container...</div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-6">
        <p className="text-danger font-medium">
          {error ?? "Container not found"}
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-3 text-sm text-accent hover:text-docker-blue transition-colors"
        >
          Back to containers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded hover:bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{data.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge state={data.state} />
            <span className="text-xs text-text-muted font-mono">
              {data.id.slice(0, 12)}
            </span>
            <span className="text-xs text-text-secondary">{data.image}</span>
          </div>
        </div>
        <ContainerActions container={data} onAction={handleAction} />
      </div>

      <Tabs.Root defaultValue="logs" className="flex flex-col flex-1 min-h-0">
        <Tabs.List className="flex border-b border-border mb-4">
          <Tabs.Trigger value="logs" className={TAB_TRIGGER}>
            Logs
          </Tabs.Trigger>
          <Tabs.Trigger value="terminal" className={TAB_TRIGGER}>
            Terminal
          </Tabs.Trigger>
          <Tabs.Trigger value="stats" className={TAB_TRIGGER}>
            Stats
          </Tabs.Trigger>
          <Tabs.Trigger value="inspect" className={TAB_TRIGGER}>
            Inspect
          </Tabs.Trigger>
          <Tabs.Trigger value="env" className={TAB_TRIGGER}>
            Environment
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content
          value="logs"
          forceMount
          className="flex-1 min-h-0 outline-none data-[state=inactive]:hidden flex flex-col"
        >
          <LogsTab containerId={containerId} resetKey={logsResetKey} />
        </Tabs.Content>
        <Tabs.Content value="terminal" className="flex-1 min-h-0 outline-none">
          <TerminalTab containerId={containerId} />
        </Tabs.Content>
        <Tabs.Content
          value="stats"
          forceMount
          className="flex-1 min-h-0 outline-none data-[state=inactive]:hidden overflow-auto"
        >
          <StatsTab containerId={containerId} />
        </Tabs.Content>
        <Tabs.Content value="inspect" className="flex-1 min-h-0 outline-none overflow-auto">
          <InspectTab containerId={containerId} />
        </Tabs.Content>
        <Tabs.Content value="env" className="flex-1 min-h-0 outline-none overflow-auto">
          <EnvTab containerId={containerId} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
