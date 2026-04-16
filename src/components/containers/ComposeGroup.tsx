import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import type { ContainerInfo } from "../../lib/types";
import ContainerRow from "./ContainerRow";

interface ComposeGroupProps {
  projectName: string;
  containers: ContainerInfo[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleGroup: (ids: string[], select: boolean) => void;
  onAction: () => void;
}

export default function ComposeGroup({
  projectName,
  containers,
  selected,
  onToggleSelect,
  onToggleGroup,
  onAction,
}: ComposeGroupProps) {
  const [expanded, setExpanded] = useState(true);

  const running = containers.filter((c) => c.state === "running").length;
  const total = containers.length;
  const ids = containers.map((c) => c.id);
  const allSelected = ids.every((id) => selected.has(id));

  return (
    <>
      <tr className="bg-surface-overlay/40 border-b border-border">
        <td colSpan={8} className="px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <button
              type="button"
              className="flex items-center gap-2 flex-1 text-left hover:text-docker-blue transition-colors"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              )}
              <Layers className="w-4 h-4 text-accent" />
              <span className="font-medium">{projectName}</span>
              <span className="text-xs text-text-secondary">
                ({running}/{total} running)
              </span>
            </button>
            <button
              type="button"
              onClick={() => onToggleGroup(ids, !allSelected)}
              className="text-xs text-accent hover:text-docker-blue transition-colors"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>
        </td>
      </tr>
      {expanded &&
        containers.map((c) => (
          <ContainerRow
            key={c.id}
            container={c}
            selected={selected.has(c.id)}
            onToggleSelect={onToggleSelect}
            onAction={onAction}
          />
        ))}
    </>
  );
}
