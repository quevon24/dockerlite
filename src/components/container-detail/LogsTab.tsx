import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Eraser,
  Clock,
  Copy,
  TextSelect,
  Search,
  ChevronUp,
  ChevronDown,
  CaseSensitive,
  X,
} from "lucide-react";
import { useContainerLogs } from "../../lib/hooks/useContainerLogs";
import { findLogMatches, matchKey, type LogMatch } from "../../lib/logSearch";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  // Track the current match by identity rather than index so it stays put
  // while new lines stream in or old ones rotate out of the buffer.
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  // Bumped on every selection so re-selecting the same match still scrolls.
  const [jumpSeq, setJumpSeq] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeQuery = searchOpen ? query : "";
  const matches = useMemo(
    () => findLogMatches(lines, activeQuery, caseSensitive),
    [lines, activeQuery, caseSensitive],
  );
  const matchesByLine = useMemo(() => {
    const map = new Map<number, LogMatch[]>();
    for (const m of matches) {
      const list = map.get(m.lineId);
      if (list) list.push(m);
      else map.set(m.lineId, [m]);
    }
    return map;
  }, [matches]);
  const currentIndex = currentKey ? matches.findIndex((m) => matchKey(m) === currentKey) : -1;

  // Select a match and stop following the tail so it stays on screen.
  const selectMatch = (m: LogMatch | undefined) => {
    setCurrentKey(m ? matchKey(m) : null);
    if (!m) return;
    setAutoScroll(false);
    setJumpSeq((n) => n + 1);
  };

  // New search terms start at the newest match, closest to the live tail.
  const updateSearch = (nextQuery: string, nextCaseSensitive: boolean) => {
    setQuery(nextQuery);
    setCaseSensitive(nextCaseSensitive);
    const found = findLogMatches(lines, nextQuery, nextCaseSensitive);
    selectMatch(found[found.length - 1]);
  };

  const stepMatch = (delta: number) => {
    if (matches.length === 0) return;
    const base = currentIndex === -1 ? (delta > 0 ? -1 : 0) : currentIndex;
    const next = (base + delta + matches.length) % matches.length;
    selectMatch(matches[next]);
  };

  const openSearch = () => {
    setSearchOpen(true);
    // The input may not be mounted yet on the first open.
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setCurrentKey(null);
  };

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

  // Ctrl/Cmd+F opens the log search while this tab is visible.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    if (jumpSeq === 0) return;
    containerRef.current
      ?.querySelector("[data-current-match]")
      ?.scrollIntoView({ block: "nearest" });
  }, [jumpSeq]);

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
        <button
          onClick={() => (searchOpen ? closeSearch() : openSearch())}
          title="Search logs (Ctrl+F)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
            searchOpen
              ? "bg-docker-blue/20 text-docker-blue"
              : "bg-surface-overlay text-text-secondary hover:text-text-primary"
          }`}
        >
          <Search className="w-3.5 h-3.5" /> Search
        </button>
        <span className="ml-auto text-xs text-text-muted">
          {lines.length.toLocaleString()} lines
        </span>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-1 mb-2 px-2 py-1 bg-surface-raised border border-border rounded-lg">
          <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => updateSearch(e.target.value, caseSensitive)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeSearch();
              }
            }}
            placeholder="Search logs"
            aria-label="Search logs"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent px-1 py-0.5 text-xs text-text-primary placeholder:text-text-muted outline-none"
          />
          <span className="text-xs text-text-muted tabular-nums px-1" aria-live="polite">
            {query
              ? matches.length === 0
                ? "No matches"
                : `${currentIndex === -1 ? "–" : currentIndex + 1} / ${matches.length.toLocaleString()}`
              : ""}
          </span>
          <button
            onClick={() => updateSearch(query, !caseSensitive)}
            title="Match case"
            aria-pressed={caseSensitive}
            className={`p-1 rounded transition-colors ${
              caseSensitive
                ? "bg-docker-blue/20 text-docker-blue"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <CaseSensitive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => stepMatch(-1)}
            disabled={matches.length === 0}
            title="Previous match (Shift+Enter)"
            className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => stepMatch(1)}
            disabled={matches.length === 0}
            title="Next match (Enter)"
            className="p-1 rounded text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={closeSearch}
            title="Close (Esc)"
            className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            {highlight(line.text, matchesByLine.get(line.id), currentKey)}
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

/** Wrap each match in a <mark>, flagging the current one for scrolling. */
function highlight(text: string, lineMatches: LogMatch[] | undefined, currentKey: string | null) {
  if (!lineMatches) return text;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const m of lineMatches) {
    if (m.start > pos) parts.push(text.slice(pos, m.start));
    const isCurrent = matchKey(m) === currentKey;
    parts.push(
      <mark
        key={m.start}
        data-current-match={isCurrent || undefined}
        className={`rounded-sm text-inherit ${isCurrent ? "bg-warning/70" : "bg-warning/30"}`}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    );
    pos = m.end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}
