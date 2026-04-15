import { useState, useEffect, useCallback } from "react";
import type { SystemInfo } from "../types";
import { getSystemInfo } from "../tauri";

interface UseSystemInfoResult {
  data: SystemInfo | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSystemInfo(): UseSystemInfoResult {
  const [data, setData] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const info = await getSystemInfo();
      setData(info);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
