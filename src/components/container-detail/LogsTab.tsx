import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Eraser, Clock, Copy, TextSelect } from "lucide-react";
import { useContainerLogs } from "../../lib/hooks/useContainerLogs";
import { useSettings } from "../../lib/SettingsContext";
import { useToast } from "../ui/Toast";

interface LogsTabProps {
  containerId: string;
  resetKey?: number;
  active?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  hasSelection: boolean;
}

export default function LogsTab({ containerId, resetKey = 0, active = true }: LogsTabProps) {
  const { settings } = useSettings();
  const { toast } = useToast();
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
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  // Build the plain-text representation of the current logs, honoring the
  // timestamp toggle so "Copy all" matches what's on screen.
  const logsToText = () =>
    lines
      .map((line) => (showTimestamps && line.time ? `${line.time} ${line.text}` : line.text))
      .join("\n");

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => toast(label, undefined, "success"))
      .catch(() => toast("Failed to copy to clipboard", undefined, "error"));
  };

  // Replace the default WebKitGTK webview menu (which only offers navigation
  // items) with our own so text can be copied via the mouse.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection()?.toString() ?? "";
    // Keep the menu inside the viewport (rough menu size: 180x110).
    const x = Math.min(e.clientX, window.innerWidth - 190);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    setMenu({ x, y, hasSelection: selection.length > 0 });
  };

  const copySelection = () => {
    const selection = window.getSelection()?.toString() ?? "";
    copyText(selection, "Selection copied");
  };

  const selectAll = () => {
    const el = containerRef.current;
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // Dismiss the custom menu on any outside interaction or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

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
        onContextMenu={onContextMenu}
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

      {menu && (
        <div
          className="fixed z-50 min-w-[180px] py-1 bg-surface-raised border border-border rounded-lg shadow-xl text-sm"
          style={{ top: menu.y, left: menu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={copySelection}
            disabled={!menu.hasSelection}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-surface-overlay disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button
            onClick={() => copyText(logsToText(), "All logs copied")}
            disabled={lines.length === 0}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-surface-overlay disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copy all logs
          </button>
          <button
            onClick={selectAll}
            disabled={lines.length === 0}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-surface-overlay disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <TextSelect className="w-3.5 h-3.5" /> Select all
          </button>
        </div>
      )}
    </div>
  );
}
