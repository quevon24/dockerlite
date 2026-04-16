import { useMemo, useState } from "react";
import { Box, RefreshCw } from "lucide-react";
import { useContainers } from "../../lib/hooks/useContainers";
import type { ContainerInfo } from "../../lib/types";
import ContainerRow from "./ContainerRow";
import ComposeGroup from "./ComposeGroup";
import BulkActions from "./BulkActions";

interface Groups {
  ungrouped: ContainerInfo[];
  projects: Map<string, ContainerInfo[]>;
}

function groupByCompose(containers: ContainerInfo[]): Groups {
  const ungrouped: ContainerInfo[] = [];
  const projects = new Map<string, ContainerInfo[]>();
  for (const c of containers) {
    if (c.composeProject) {
      const list = projects.get(c.composeProject) ?? [];
      list.push(c);
      projects.set(c.composeProject, list);
    } else {
      ungrouped.push(c);
    }
  }
  return { ungrouped, projects };
}

export default function ContainerTable() {
  const { data, error, loading, refresh } = useContainers();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByCompose(data), [data]);
  const sortedProjectNames = useMemo(
    () => Array.from(groups.projects.keys()).sort(),
    [groups.projects],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleAction = () => {
    refresh();
  };

  if (loading && data.length === 0) {
    return (
      <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary">
        Loading containers...
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center">
        <p className="text-danger font-medium mb-2">Failed to load containers</p>
        <p className="text-text-secondary text-sm mb-3">{error}</p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 text-sm text-accent hover:text-docker-blue transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface-raised border border-border rounded-lg p-12 text-center">
        <Box className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <p className="text-text-primary font-medium">No containers yet</p>
        <p className="text-text-secondary text-sm mt-1">
          Run a container from the Images page to see it here.
        </p>
      </div>
    );
  }

  const selectedIds = Array.from(selected);

  return (
    <div>
      {selectedIds.length > 0 && (
        <BulkActions
          selectedIds={selectedIds}
          onAction={handleAction}
          onClear={clearSelection}
        />
      )}
      <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-overlay text-text-secondary text-xs uppercase tracking-wide">
              <th className="px-3 py-2 w-8 text-left"></th>
              <th className="px-3 py-2 text-left font-medium">State</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Image</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Ports</th>
              <th className="px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {groups.ungrouped.map((c) => (
              <ContainerRow
                key={c.id}
                container={c}
                selected={selected.has(c.id)}
                onToggleSelect={toggleSelect}
                onAction={handleAction}
              />
            ))}
            {sortedProjectNames.map((name) => (
              <ComposeGroup
                key={name}
                projectName={name}
                containers={groups.projects.get(name)!}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleGroup={toggleGroup}
                onAction={handleAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
