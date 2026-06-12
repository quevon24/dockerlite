import { useEffect, useRef, useState, useCallback } from "react";
import type { LogLine } from "../types";
import { streamContainerLogs } from "../tauri";

const DEFAULT_MAX_BUFFER = 10_000;
const FLUSH_INTERVAL_MS = 100;

/** A log line with a monotonic id, stable across ring-buffer rotation. */
export interface BufferedLogLine extends LogLine {
  id: number;
}

interface UseContainerLogsResult {
  lines: BufferedLogLine[];
  error: string | null;
  clear: () => void;
}

/**
 * Subscribe to a container's log stream. Maintains a ring buffer capped at
 * maxBuffer lines. State updates are batched on a short interval so high
 * throughput logs don't cause excessive re-renders.
 */
export function useContainerLogs(
  containerId: string,
  tail: number = 200,
  resetKey: number = 0,
  maxBuffer: number = DEFAULT_MAX_BUFFER,
): UseContainerLogsResult {
  const [lines, setLines] = useState<BufferedLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<BufferedLogLine[]>([]);
  const nextIdRef = useRef(0);

  const clear = useCallback(() => {
    pendingRef.current = [];
    setLines([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => Promise<void>) | null = null;

    pendingRef.current = [];
    setLines([]);
    setError(null);

    const flushTimer = window.setInterval(() => {
      if (pendingRef.current.length === 0) return;
      const incoming = pendingRef.current;
      pendingRef.current = [];
      setLines((prev) => {
        const next = prev.concat(incoming);
        return next.length > maxBuffer ? next.slice(-maxBuffer) : next;
      });
    }, FLUSH_INTERVAL_MS);

    streamContainerLogs(containerId, tail, (batch) => {
      if (cancelled) return;
      for (const line of batch) {
        pendingRef.current.push({ ...line, id: nextIdRef.current++ });
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
  }, [containerId, tail, resetKey, maxBuffer]);

  return { lines, error, clear };
}
