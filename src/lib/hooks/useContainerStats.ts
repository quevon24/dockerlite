import { useEffect, useState } from "react";
import type { StatsSnapshot } from "../types";
import { streamContainerStats } from "../tauri";

const MAX_POINTS = 60;

interface UseContainerStatsResult {
  history: StatsSnapshot[];
  latest: StatsSnapshot | null;
  error: string | null;
}

/**
 * Subscribe to a container's stats stream. Maintains a sliding window of the
 * last MAX_POINTS data points for charting.
 */
export function useContainerStats(containerId: string): UseContainerStatsResult {
  const [history, setHistory] = useState<StatsSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => Promise<void>) | null = null;

    setHistory([]);
    setError(null);

    streamContainerStats(containerId, (snapshot) => {
      if (cancelled) return;
      setHistory((prev) => {
        const next = [...prev, snapshot];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    })
      .then((stop) => {
        if (cancelled) {
          // Same pattern as logs: don't stop in cancelled path
          // to avoid killing a StrictMode replacement stream.
        } else {
          teardown = stop;
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
      if (teardown) teardown().catch(() => {});
    };
  }, [containerId]);

  return {
    history,
    latest: history.length > 0 ? history[history.length - 1] : null,
    error,
  };
}
