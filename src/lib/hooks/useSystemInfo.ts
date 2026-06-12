import { useState, useEffect, useCallback, useRef } from "react";
import type { SystemInfo } from "../types";
import { getSystemInfo } from "../tauri";

interface UseSystemInfoResult {
  data: SystemInfo | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Fetch Docker system info. When pollMs is set, refetches on that interval
 * (silently, without toggling the loading flag) so consumers like the
 * sidebar connection indicator stay current.
 */
export function useSystemInfo(pollMs?: number): UseSystemInfoResult {
  const [data, setData] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchInfo = useCallback(async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const info = await getSystemInfo();
      if (!mountedRef.current) return;
      setData(info);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(String(e));
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => fetchInfo(false), [fetchInfo]);

  useEffect(() => {
    mountedRef.current = true;
    fetchInfo(false);
    const id = pollMs ? window.setInterval(() => fetchInfo(true), pollMs) : undefined;
    return () => {
      mountedRef.current = false;
      if (id !== undefined) window.clearInterval(id);
    };
  }, [fetchInfo, pollMs]);

  return { data, error, loading, refresh };
}
