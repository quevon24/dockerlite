import { useEffect, useRef, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Trash2, Check, RefreshCw } from "lucide-react";
import {
  getDiskUsage,
  pruneContainers,
  pruneImages,
  pruneVolumes,
  pruneNetworks,
  pruneBuildCache,
} from "../lib/tauri";
import type { DiskUsage, PruneResult } from "../lib/types";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

interface PruneOption {
  id: string;
  label: string;
  description: string;
  sizeKey: keyof DiskUsage;
  countKey: keyof DiskUsage;
}

const PRUNE_OPTIONS: PruneOption[] = [
  {
    id: "containers",
    label: "Stopped containers",
    description: "Remove all stopped containers",
    sizeKey: "containersSize",
    countKey: "containersCount",
  },
  {
    id: "images",
    label: "Unused images",
    description: "Remove dangling and unreferenced images",
    sizeKey: "imagesSize",
    countKey: "imagesCount",
  },
  {
    id: "volumes",
    label: "Unused volumes",
    description: "Remove all volumes not used by at least one container",
    sizeKey: "volumesSize",
    countKey: "volumesCount",
  },
  {
    id: "networks",
    label: "Unused networks",
    description: "Remove all custom networks not used by at least one container",
    sizeKey: "totalSize",
    countKey: "totalSize",
  },
  {
    id: "buildcache",
    label: "Build cache",
    description: "Remove all build cache entries",
    sizeKey: "buildCacheSize",
    countKey: "buildCacheSize",
  },
];

export default function SystemPage() {
  const { toast } = useToast();
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pruning, setPruning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["containers", "images", "networks", "buildcache"]),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mountedRef = useRef(true);

  const fetchDiskUsage = (showToast = false) => {
    setLoading(true);
    getDiskUsage()
      .then((data) => {
        if (!mountedRef.current) return;
        setDiskUsage(data);
        setError(null);
        if (showToast) toast("Disk usage refreshed", undefined, "info");
      })
      .catch((e) => {
        if (!mountedRef.current) return;
        setError(String(e));
        if (showToast) toast("Failed to fetch disk usage", String(e), "error");
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchDiskUsage();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const executePrune = async () => {
    setPruning(true);
    let totalDeleted = 0;
    let totalReclaimed = 0;

    const runPrune = async (label: string, fn: () => Promise<PruneResult>) => {
      try {
        const result = await fn();
        totalDeleted += result.itemsDeleted;
        totalReclaimed += result.spaceReclaimed;
      } catch (e) {
        toast(`Failed to prune ${label}`, String(e), "error");
      }
    };

    if (selected.has("containers")) {
      await runPrune("containers", pruneContainers);
    }
    if (selected.has("images")) {
      await runPrune("images", () => pruneImages(true));
    }
    if (selected.has("volumes")) {
      await runPrune("volumes", pruneVolumes);
    }
    if (selected.has("networks")) {
      await runPrune("networks", pruneNetworks);
    }
    if (selected.has("buildcache")) {
      await runPrune("build cache", pruneBuildCache);
    }

    if (totalDeleted > 0 || totalReclaimed > 0) {
      toast(
        "Cleanup complete",
        `${totalDeleted} item${totalDeleted !== 1 ? "s" : ""} removed, ${formatBytes(totalReclaimed)} reclaimed`,
        "success",
      );
    } else {
      toast("Nothing to clean", "No unused resources found", "info");
    }

    setPruning(false);
    fetchDiskUsage(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">System Cleanup</h1>

      {diskUsage && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            {
              label: "Containers",
              size: diskUsage.containersSize,
              count: diskUsage.containersCount,
            },
            { label: "Images", size: diskUsage.imagesSize, count: diskUsage.imagesCount },
            { label: "Volumes", size: diskUsage.volumesSize, count: diskUsage.volumesCount },
            { label: "Build Cache", size: diskUsage.buildCacheSize, count: null },
            { label: "Total", size: diskUsage.totalSize, count: null },
          ].map((item) => (
            <div key={item.label} className="bg-surface-raised border border-border rounded-lg p-3">
              <div className="text-xs text-text-secondary mb-1">{item.label}</div>
              <div className="text-lg font-semibold">{formatBytes(item.size)}</div>
              {item.count !== null && (
                <div className="text-xs text-text-muted">{item.count} items</div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && !diskUsage && (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary mb-6">
          Loading disk usage...
        </div>
      )}

      {error && !loading && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center mb-6">
          <p className="text-danger font-medium mb-2">Failed to load disk usage</p>
          <p className="text-text-secondary text-sm mb-3">{error}</p>
          <button
            onClick={() => fetchDiskUsage(false)}
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-docker-blue transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      <div className="bg-surface-raised border border-border rounded-lg p-5 mb-4">
        <h2 className="text-base font-medium mb-4">Select resources to clean</h2>
        <div className="space-y-3">
          {PRUNE_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
              <Checkbox.Root
                checked={selected.has(opt.id)}
                onCheckedChange={() => toggleOption(opt.id)}
                className="mt-0.5 w-4 h-4 rounded border border-border bg-surface flex items-center justify-center data-[state=checked]:bg-docker-blue data-[state=checked]:border-docker-blue shrink-0"
              >
                <Checkbox.Indicator>
                  <Check className="w-3 h-3 text-surface" strokeWidth={3} />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <div className="flex-1">
                <div className="text-sm text-text-primary group-hover:text-docker-blue transition-colors">
                  {opt.label}
                </div>
                <div className="text-xs text-text-muted">{opt.description}</div>
              </div>
              {diskUsage && opt.id !== "networks" && (
                <span className="text-xs text-text-muted mt-0.5">
                  {formatBytes(diskUsage[opt.sizeKey])}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={selected.size === 0 || pruning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-danger text-white hover:bg-danger/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {pruning ? "Cleaning..." : "Clean up"}
        </button>
        <button
          onClick={() => fetchDiskUsage(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-surface-raised text-text-secondary hover:text-text-primary border border-border transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Clean up Docker resources?"
        description={`This will remove ${selected.size} selected resource type${selected.size !== 1 ? "s" : ""}. Stopped containers, unused images, volumes, networks, and build cache entries matching your selection will be permanently deleted.`}
        confirmLabel="Clean up"
        destructive
        onConfirm={executePrune}
        onOpenChange={setConfirmOpen}
      />
    </div>
  );
}
