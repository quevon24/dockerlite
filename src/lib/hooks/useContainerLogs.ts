import { useEffect, useRef, useState, useCallback } from "react";
import type { LogLine } from "../types";
import { streamContainerLogs } from "../tauri";

const MAX_BUFFER = 10_000;
const FLUSH_INTERVAL_MS = 100;

interface UseContainerLogsResult {
  lines: LogLine[];
  error: string | null;
  clear: () => void;
}

/**
 * Subscribe to a container's log stream. Maintains a ring buffer capped at
 * MAX_BUFFER lines. State updates are batched on a short interval so high
 * throughput logs don't cause excessive re-renders.
 */
export function useContainerLogs(
  containerId: string,
  tail: number = 200,
  resetKey: number = 0,
): UseContainerLogsResult {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<LogLine[]>([]);

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
        return next.length > MAX_BUFFER ? next.slice(-MAX_BUFFER) : next;
      });
    }, FLUSH_INTERVAL_MS);

    streamContainerLogs(containerId, tail, (batch) => {
      if (cancelled) return;
      pendingRef.current.push(...batch);
    })
      .then((stop) => {
        if (cancelled) {
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
  }, [containerId, tail, resetKey]);

  return { lines, error, clear };
}
