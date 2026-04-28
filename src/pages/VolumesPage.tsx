import { useState } from "react";
import { HardDrive, Trash2, RefreshCw, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { useVolumes } from "../lib/hooks/useVolumes";
import type { VolumeInfo } from "../lib/types";
import { removeVolume } from "../lib/tauri";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

type SortKey = "name" | "driver" | "size" | "containers";
type SortDir = "asc" | "desc";

function sortVolumes(volumes: VolumeInfo[], key: SortKey, dir: SortDir): VolumeInfo[] {
  return [...volumes].sort((a, b) => {
    let cmp = 0;
    if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "driver") cmp = a.driver.localeCompare(b.driver);
    else if (key === "size") cmp = a.size - b.size;
    else if (key === "containers") cmp = a.refCount - b.refCount;
    return dir === "asc" ? cmp : -cmp;
  });
}

export default function VolumesPage() {
  const { data, error, loading, refresh } = useVolumes();
  const { toast } = useToast();
  const [showOrphans, setShowOrphans] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const orphanCount = data.filter((v) => v.refCount === 0).length;
  const base = showOrphans ? data.filter((v) => v.refCount === 0) : data;
  const filtered = sortVolumes(base, sortKey, sortDir);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeVolume(deleteTarget);
      toast("Volume removed", deleteTarget, "success");
    } catch (e) {
      toast("Failed to remove volume", String(e), "error");
    }
    refresh();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Volumes</h1>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowOrphans((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showOrphans
              ? "bg-warning/20 text-warning"
              : "bg-surface-raised text-text-secondary hover:text-text-primary border border-border"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Orphan ({orphanCount})
        </button>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-raised text-text-secondary hover:text-text-primary border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <span className="ml-auto text-sm text-text-muted">
          {data.length} volume{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading && data.length === 0 && (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary">
          Loading volumes...
        </div>
      )}

      {error && data.length === 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center">
          <p className="text-danger font-medium mb-2">Failed to load volumes</p>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-surface-raised border border-border rounded-lg p-12 text-center">
          <HardDrive className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-primary font-medium">
            {showOrphans ? "No orphan volumes" : "No volumes found"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay text-text-secondary text-xs uppercase tracking-wide">
                {(
                  [
                    { key: "name" as SortKey, label: "Name" },
                    { key: "driver" as SortKey, label: "Driver" },
                    { key: "size" as SortKey, label: "Size" },
                    { key: "containers" as SortKey, label: "Containers" },
                  ] as const
                ).map(({ key, label }) => (
                  <th key={key} className="px-4 py-2 text-left font-medium">
                    <button
                      onClick={() => handleSort(key)}
                      className="flex items-center gap-1 hover:text-text-primary transition-colors"
                    >
                      {label}
                      {sortKey === key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      ) : (
                        <ChevronUp className="w-3 h-3 opacity-20" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2 text-left font-medium">Mount</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vol) => (
                <tr
                  key={vol.name}
                  className={`border-b border-border ${vol.refCount === 0 ? "bg-warning/5" : ""}`}
                >
                  <td className="px-4 py-2 font-mono text-xs text-text-primary truncate max-w-[220px]">
                    {vol.name}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{vol.driver}</td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{formatBytes(vol.size)}</td>
                  <td className="px-4 py-2 text-xs">
                    {vol.refCount < 0 ? (
                      <span className="text-text-muted">N/A</span>
                    ) : vol.refCount === 0 ? (
                      <span className="text-warning">0 (orphan)</span>
                    ) : (
                      <span className="text-text-secondary">{vol.refCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-text-muted truncate max-w-[250px]">
                    {vol.mountpoint}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setDeleteTarget(vol.name)}
                      className="p-1.5 rounded hover:bg-surface-overlay text-text-muted hover:text-danger transition-colors"
                      aria-label="Delete volume"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Remove volume "${deleteTarget}"?`}
        description="All data stored in this volume will be permanently deleted. This cannot be undone."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
