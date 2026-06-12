import { useEffect, useRef, useState, useCallback } from "react";
import { streamContainerLogs } from "../tauri";

const DEFAULT_MAX_BUFFER = 10_000;
const FLUSH_INTERVAL_MS = 100;

/**
 * Strip ANSI/terminal control sequences from a log line for clean display:
 * CSI sequences, OSC sequences (BEL- or ST-terminated, or truncated at end
 * of line), charset selection, and remaining C0 control bytes except tab
 * and newline.
 */
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[()][0-9A-B]|[\x00-\x08\x0b-\x1f\x7f]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

/**
 * A display-ready log line: text stripped of ANSI sequences and timestamp
 * preformatted (both computed once at ingestion, not on every render), with
 * a monotonic id stable across ring-buffer rotation.
 */
export interface BufferedLogLine {
  id: number;
  stream: string;
  time: string | null;
  text: string;
}

interface UseContainerLogsResult {
  lines: BufferedLogLine[];
  error: string | null;
  ended: boolean;
  clear: () => void;
}

/**
 * Subscribe to a container's log stream. Maintains a ring buffer capped at
 * maxBuffer lines. State updates are batched on a short interval so high
 * throughput logs don't cause excessive re-renders, and pause entirely while
 * the view is inactive (lines keep accumulating in the pending buffer).
 */
export function useContainerLogs(
  containerId: string,
  tail: number = 200,
  resetKey: number = 0,
  maxBuffer: number = DEFAULT_MAX_BUFFER,
  active: boolean = true,
): UseContainerLogsResult {
  const [lines, setLines] = useState<BufferedLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const pendingRef = useRef<BufferedLogLine[]>([]);
  const nextIdRef = useRef(0);
  const maxBufferRef = useRef(maxBuffer);
  const activeRef = useRef(active);

  const clear = useCallback(() => {
    pendingRef.current = [];
    setLines([]);
  }, []);

  const flush = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    const incoming = pendingRef.current;
    pendingRef.current = [];
    setLines((prev) => {
      const max = maxBufferRef.current;
      const next = prev.concat(incoming);
      return next.length > max ? next.slice(-max) : next;
    });
    // Data flowing again means a previously reported stream error recovered.
    setError(null);
  }, []);

  // Apply buffer-size changes in place instead of restarting the stream.
  useEffect(() => {
    maxBufferRef.current = maxBuffer;
    setLines((prev) => (prev.length > maxBuffer ? prev.slice(-maxBuffer) : prev));
  }, [maxBuffer]);

  // While the log view is hidden no renders happen; flush what accumulated
  // as soon as it becomes visible again.
  useEffect(() => {
    activeRef.current = active;
    if (active) flush();
  }, [active, flush]);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => Promise<void>) | null = null;

    pendingRef.current = [];
    setLines([]);
    setError(null);
    setEnded(false);

    const flushTimer = window.setInterval(() => {
      if (!activeRef.current) return;
      flush();
    }, FLUSH_INTERVAL_MS);

    streamContainerLogs(containerId, tail, (event) => {
      if (cancelled) return;
      if (event.type === "lines") {
        for (const line of event.lines) {
          pendingRef.current.push({
            id: nextIdRef.current++,
            stream: line.stream,
            time: formatTimestamp(line.timestamp),
            text: stripAnsi(line.text),
          });
        }
        // Keep the pending buffer bounded while the view is inactive.
        const max = maxBufferRef.current;
        if (pendingRef.current.length > max) {
          pendingRef.current = pendingRef.current.slice(-max);
        }
      } else if (event.type === "error") {
        setError(event.message);
      } else {
        setEnded(true);
      }
    })
      .then((stop) => {
        if (cancelled) {
          // The stream id is unique per call, so stopping here cannot
          // affect a replacement stream (e.g. under StrictMode).
          stop().catch(() => {});
        } else {
          teardown = stop;
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
      window.clearInterval(flushTimer);
      if (teardown) teardown().catch(() => {});
    };
  }, [containerId, tail, resetKey, flush]);

  return { lines, error, ended, clear };
}
