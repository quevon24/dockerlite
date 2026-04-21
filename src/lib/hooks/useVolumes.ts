import { useState, useEffect, useCallback, useRef } from "react";
import type { VolumeInfo } from "../types";
import { listVolumes } from "../tauri";

interface UseVolumesResult {
  data: VolumeInfo[];
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useVolumes(intervalMs: number = 10000): UseVolumesResult {
  const [data, setData] = useState<VolumeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const volumes = await listVolumes();
      if (!mountedRef.current) return;
      setData(volumes);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

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
