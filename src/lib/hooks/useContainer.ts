import { useState, useEffect, useCallback, useRef } from "react";
import type { ContainerInfo } from "../types";
import { listContainers } from "../tauri";

interface UseContainerResult {
  data: ContainerInfo | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Fetch a single container by ID by filtering the full container list.
 * Polls every 3 seconds for status updates.
 */
export function useContainer(containerId: string, intervalMs: number = 3000): UseContainerResult {
  const [data, setData] = useState<ContainerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const genRef = useRef(0);

  const refresh = useCallback(async () => {
    // Overlapping polls can resolve out of order; only the latest applies.
    const gen = ++genRef.current;
    try {
      const all = await listContainers();
      if (!mountedRef.current || gen !== genRef.current) return;
      const found = all.find((c) => c.id === containerId) ?? null;
      setData(found);
      setError(null);
    } catch (e) {
      if (!mountedRef.current || gen !== genRef.current) return;
      setError(String(e));
    } finally {
      if (mountedRef.current && gen === genRef.current) setLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const id = window.setInterval(refresh, intervalMs);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}
