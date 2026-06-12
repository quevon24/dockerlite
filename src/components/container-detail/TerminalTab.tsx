import { useEffect, useRef, useState } from "react";
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
        term.write(new Uint8Array(data));
      },
      () => {
        // Shell exited (e.g. user typed `exit`); backend already cleaned up.
        if (cancelled) return;
        exited = true;
        execId = null;
        execStop = null;
        term.write("\r\n\x1b[2m[session ended]\x1b[0m\r\n");
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
    const dataDisposable = term.onData((data) => {
      if (!execId) return;
      writeExecInput(execId, new TextEncoder().encode(data)).catch(() => {});
    });

    // Forward resize events
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (!execId) return;
      resizeExecTerminal(execId, cols, rows).catch(() => {});
    });

    // Auto-fit when the container resizes
    const observer = new ResizeObserver(() => {
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
  }, [containerId]);

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded px-3 py-2 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[300px] rounded-lg overflow-hidden bg-[#0d1117]"
    />
  );
}
