import { useState, useEffect, useCallback, useRef } from "react";
import type { ImageInfo } from "../types";
import { listImages } from "../tauri";

interface UseImagesResult {
  data: ImageInfo[];
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useImages(intervalMs: number = 10000): UseImagesResult {
  const [data, setData] = useState<ImageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const genRef = useRef(0);

  const refresh = useCallback(async () => {
    // Overlapping polls can resolve out of order; only the latest applies.
    const gen = ++genRef.current;
    try {
      const images = await listImages();
      if (!mountedRef.current || gen !== genRef.current) return;
      setData(images);
      setError(null);
    } catch (e) {
      if (!mountedRef.current || gen !== genRef.current) return;
      setError(String(e));
    } finally {
      if (mountedRef.current && gen === genRef.current) setLoading(false);
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
