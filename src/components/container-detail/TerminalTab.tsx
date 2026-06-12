import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { startExec, writeExecInput, resizeExecTerminal } from "../../lib/tauri";

interface TerminalTabProps {
  containerId: string;
}

export default function TerminalTab({ containerId }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // Bumping the key tears down the terminal and starts a fresh exec session;
  // needed because the shell can exit on its own (user types `exit`) and the
  // tab stays mounted across tab switches.
  const [sessionKey, setSessionKey] = useState(0);

  const restart = () => {
    setError(null);
    setEnded(false);
    setSessionKey((k) => k + 1);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let exited = false;
    let execStop: (() => Promise<void>) | null = null;
    let execId: string | null = null;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selectionBackground: "#264f78",
        black: "#484f58",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
      },
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);

    // Small delay so the container has its final size before fitting
    const fitRaf = requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Start the exec session
    startExec(
      containerId,
      (data) => {
        if (cancelled) return;
        term.write(data);
      },
      () => {
        // Shell exited (e.g. user typed `exit`); backend already cleaned up.
        if (cancelled) return;
        exited = true;
        execId = null;
        execStop = null;
        term.write("\r\n\x1b[2m[session ended]\x1b[0m\r\n");
        setEnded(true);
      },
    )
      .then(({ execId: eid, stop }) => {
        if (cancelled) {
          stop().catch(() => {});
          return;
        }
        if (exited) return;
        execId = eid;
        execStop = stop;

        // Send initial resize
        resizeExecTerminal(eid, term.cols, term.rows).catch(() => {});
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    // Forward keystrokes to the backend
    const encoder = new TextEncoder();
    const dataDisposable = term.onData((data) => {
      if (!execId) return;
      writeExecInput(execId, encoder.encode(data)).catch(() => {});
    });

    // Forward resize events
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (!execId) return;
      resizeExecTerminal(execId, cols, rows).catch(() => {});
    });

    // Auto-fit when the container resizes. Skip while hidden: display:none
    // collapses the element to 0x0 and fitting then would shrink the live
    // PTY to FitAddon's minimum geometry, garbling running programs.
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === 0 || el.clientHeight === 0) return;
      fitAddon.fit();
    });
    observer.observe(el);

    return () => {
      cancelled = true;
      cancelAnimationFrame(fitRaf);
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
      termRef.current = null;
      if (execStop) execStop().catch(() => {});
    };
  }, [containerId, sessionKey]);

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-sm text-danger flex items-center justify-between gap-3">
        <span>{error}</span>
        <button
          onClick={restart}
          className="flex items-center gap-1.5 shrink-0 text-xs text-accent hover:text-docker-blue transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[300px] flex flex-col gap-2">
      <div ref={containerRef} className="flex-1 min-h-0 rounded-lg overflow-hidden bg-[#0d1117]" />
      {ended && (
        <div className="flex items-center justify-between bg-surface-raised border border-border rounded-lg px-3 py-2">
          <span className="text-sm text-text-secondary">Session ended</span>
          <button
            onClick={restart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-docker-blue text-surface font-medium hover:bg-docker-blue/80 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" /> Restart session
          </button>
        </div>
      )}
    </div>
  );
}
