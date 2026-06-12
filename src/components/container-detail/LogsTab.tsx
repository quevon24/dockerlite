import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Eraser, Clock } from "lucide-react";
import { useContainerLogs } from "../../lib/hooks/useContainerLogs";
import { useSettings } from "../../lib/SettingsContext";

interface LogsTabProps {
  containerId: string;
  resetKey?: number;
  active?: boolean;
}

export default function LogsTab({ containerId, resetKey = 0, active = true }: LogsTabProps) {
  const { settings } = useSettings();
  const { lines, error, ended, clear } = useContainerLogs(
    containerId,
    200,
    resetKey,
    settings.logBufferSize,
    active,
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Depend on the array identity, not its length: once the ring buffer is
  // full the length stays constant even though new lines keep arriving.
  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Pause auto-scroll if the user scrolls up
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 32;
    if (autoScroll !== atBottom) setAutoScroll(atBottom);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setAutoScroll((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            autoScroll
              ? "bg-docker-blue/20 text-docker-blue"
              : "bg-surface-overlay text-text-secondary hover:text-text-primary"
          }`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" /> Auto-scroll
        </button>
        <button
          onClick={() => setShowTimestamps((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            showTimestamps
              ? "bg-docker-blue/20 text-docker-blue"
              : "bg-surface-overlay text-text-secondary hover:text-text-primary"
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Timestamps
        </button>
        <button
          onClick={clear}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors"
        >
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
        <span className="ml-auto text-xs text-text-muted">
          {lines.length.toLocaleString()} lines
        </span>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 bg-surface border border-border rounded-lg p-3 font-mono text-xs overflow-auto leading-relaxed min-h-0"
      >
        {lines.length === 0 && !error && (
          <div className="text-text-muted italic">Waiting for log output...</div>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap ${
              line.stream === "stderr" ? "text-danger" : "text-text-primary"
            }`}
          >
            {showTimestamps && line.time && (
              <span className="text-text-muted mr-2">{line.time}</span>
            )}
            {line.text}
          </div>
        ))}
        {ended && (
          <div className="text-text-muted italic mt-2">Log stream ended (container removed).</div>
        )}
      </div>
    </div>
  );
}
