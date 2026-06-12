import { useEffect, useState } from "react";
import type { StatsSnapshot } from "../types";
import { streamContainerStats } from "../tauri";

const MAX_POINTS = 60;

interface UseContainerStatsResult {
  history: StatsSnapshot[];
  latest: StatsSnapshot | null;
  error: string | null;
  ended: boolean;
}

/**
 * Subscribe to a container's stats stream. Maintains a sliding window of the
 * last MAX_POINTS data points for charting. `ended` flips when the backend
 * reports the container is gone.
 */
export function useContainerStats(containerId: string): UseContainerStatsResult {
  const [history, setHistory] = useState<StatsSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => Promise<void>) | null = null;

    setHistory([]);
    setError(null);
    setEnded(false);

    streamContainerStats(containerId, (event) => {
      if (cancelled) return;
      if (event.type === "snapshot") {
        setError(null);
        setHistory((prev) => {
          const next = [...prev, event.snapshot];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
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
      if (teardown) teardown().catch(() => {});
    };
  }, [containerId]);

  return {
    history,
    latest: history.length > 0 ? history[history.length - 1] : null,
    error,
    ended,
  };
}
