import { useEffect, useState } from "react";
import { Copy, Check, ChevronRight, ChevronDown } from "lucide-react";
import { inspectContainer } from "../../lib/tauri";

interface InspectTabProps {
  containerId: string;
}

interface JsonNodeProps {
  name: string;
  value: unknown;
  depth: number;
  defaultExpanded?: boolean;
}

function JsonNode({ name, value, depth, defaultExpanded = false }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (value === null || value === undefined) {
    return (
      <div className="flex items-start" style={{ paddingLeft: depth * 16 }}>
        <span className="text-accent">{name}</span>
        <span className="text-text-muted mx-1">:</span>
        <span className="text-text-muted italic">null</span>
      </div>
    );
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center hover:bg-surface-overlay/50 w-full text-left rounded px-1"
          style={{ paddingLeft: depth * 16 }}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
          )}
          <span className="text-accent ml-1">{name}</span>
          <span className="text-text-muted ml-1">{`{${entries.length}}`}</span>
        </button>
        {expanded &&
          entries.map(([k, v]) => <JsonNode key={k} name={k} value={v} depth={depth + 1} />)}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center hover:bg-surface-overlay/50 w-full text-left rounded px-1"
          style={{ paddingLeft: depth * 16 }}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
          )}
          <span className="text-accent ml-1">{name}</span>
          <span className="text-text-muted ml-1">[{value.length}]</span>
        </button>
        {expanded &&
          value.map((item, i) => (
            <JsonNode key={i} name={String(i)} value={item} depth={depth + 1} />
          ))}
      </div>
    );
  }

  const strValue = typeof value === "string" ? `"${value}"` : String(value);
  const colorClass =
    typeof value === "boolean"
      ? "text-warning"
      : typeof value === "number"
        ? "text-success"
        : "text-text-primary";

  return (
    <div className="flex items-start px-1" style={{ paddingLeft: depth * 16 }}>
      <span className="text-accent shrink-0">{name}</span>
      <span className="text-text-muted mx-1">:</span>
      <span className={`${colorClass} break-all`}>{strValue}</span>
    </div>
  );
}

export default function InspectTab({ containerId }: InspectTabProps) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    inspectContainer(containerId)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [containerId]);

  const copyJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (loading) {
    return <div className="text-text-muted text-sm">Loading inspect data...</div>;
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <button
          onClick={copyJson}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <div className="bg-surface border border-border rounded-lg p-3 font-mono text-xs leading-relaxed overflow-auto max-h-[70vh]">
        {data && typeof data === "object" && !Array.isArray(data) ? (
          Object.entries(data as Record<string, unknown>).map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={0} defaultExpanded={false} />
          ))
        ) : (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
