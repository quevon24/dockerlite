import { useNavigate } from "react-router-dom";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import type { ContainerInfo, PortMapping } from "../../lib/types";
import StatusBadge from "../ui/StatusBadge";
import ContainerActions from "./ContainerActions";

interface ContainerRowProps {
  container: ContainerInfo;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onAction: () => void;
}

function formatPorts(ports: PortMapping[]): string {
  if (ports.length === 0) return "-";
  const mapped = ports
    .filter((p) => p.publicPort !== null)
    .map((p) => `${p.publicPort}:${p.privatePort}/${p.protocol}`);
  if (mapped.length > 0) return mapped.join(", ");
  return ports
    .map((p) => `${p.privatePort}/${p.protocol}`)
    .slice(0, 3)
    .join(", ");
}

function shortId(id: string): string {
  return id.slice(0, 12);
}

export default function ContainerRow({
  container,
  selected,
  onToggleSelect,
  onAction,
}: ContainerRowProps) {
  const navigate = useNavigate();

  return (
    <tr
      className="border-b border-border hover:bg-surface-overlay/40 cursor-pointer transition-colors"
      onClick={() => navigate(`/containers/${container.id}`)}
    >
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <Checkbox.Root
          checked={selected}
          onCheckedChange={() => onToggleSelect(container.id)}
          className="w-4 h-4 rounded border border-border bg-surface flex items-center justify-center data-[state=checked]:bg-docker-blue data-[state=checked]:border-docker-blue"
          aria-label={`Select ${container.name}`}
        >
          <Checkbox.Indicator>
            <Check className="w-3 h-3 text-surface" strokeWidth={3} />
          </Checkbox.Indicator>
        </Checkbox.Root>
      </td>
      <td className="px-3 py-2">
        <StatusBadge state={container.state} />
      </td>
      <td className="px-3 py-2 font-medium text-text-primary">
        {container.name}
      </td>
      <td className="px-3 py-2 text-text-secondary font-mono text-xs">
        {container.image}
      </td>
      <td className="px-3 py-2 text-text-secondary text-xs">
        {container.status || "-"}
      </td>
      <td className="px-3 py-2 text-text-secondary font-mono text-xs">
        {formatPorts(container.ports)}
      </td>
      <td className="px-3 py-2 text-text-muted font-mono text-xs">
        {shortId(container.id)}
      </td>
      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <ContainerActions container={container} onAction={onAction} />
      </td>
    </tr>
  );
}
