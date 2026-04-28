import { useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Layers, Trash2, RefreshCw, Filter, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { useImages } from "../lib/hooks/useImages";
import type { ImageInfo } from "../lib/types";
import { removeImage } from "../lib/tauri";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ImageDetailPanel from "../components/images/ImageDetailPanel";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTag(tag: string): string {
  if (tag === "<none>:<none>") return "<none>";
  return tag;
}

function imageName(repoTags: string[], shortId: string): string {
  const tag = repoTags.find((t) => t !== "<none>:<none>");
  return tag ?? shortId;
}

type SortKey = "name" | "id" | "created" | "size";
type SortDir = "asc" | "desc";

function sortImages(images: ImageInfo[], key: SortKey, dir: SortDir): ImageInfo[] {
  const sorted = [...images].sort((a, b) => {
    let cmp = 0;
    if (key === "name") {
      const nameA = imageName(a.repoTags, a.shortId).toLowerCase();
      const nameB = imageName(b.repoTags, b.shortId).toLowerCase();
      cmp = nameA.localeCompare(nameB);
    } else if (key === "id") {
      cmp = a.shortId.localeCompare(b.shortId);
    } else if (key === "created") {
      cmp = a.created - b.created;
    } else if (key === "size") {
      cmp = a.size - b.size;
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export default function ImagesPage() {
  const { data, error, loading, refresh } = useImages();
  const { toast } = useToast();
  const [showDangling, setShowDangling] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailImage, setDetailImage] = useState<ImageInfo | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const base = showDangling ? data.filter((i) => i.dangling) : data;
  const filtered = sortImages(base, sortKey, sortDir);
  const danglingCount = data.filter((i) => i.dangling).length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = filtered.map((i) => i.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeImage(deleteTarget.id, false);
      toast("Image removed", deleteTarget.name, "success");
    } catch (e) {
      toast("Failed to remove image", String(e), "error");
    }
    refresh();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    let successCount = 0;

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        await removeImage(id, false);
        return id;
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        const img = data.find((i) => i.id === ids[results.indexOf(result)]);
        toast(
          "Failed to remove image",
          `${img ? imageName(img.repoTags, img.shortId) : "unknown"}: ${result.reason}`,
          "error",
        );
      }
    }

    if (successCount > 0) {
      toast(`${successCount} image${successCount > 1 ? "s" : ""} removed`, undefined, "success");
    }

    clearSelection();
    refresh();
  };

  const selectedIds = Array.from(selected);
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Images</h1>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowDangling((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showDangling
              ? "bg-warning/20 text-warning"
              : "bg-surface-raised text-text-secondary hover:text-text-primary border border-border"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Dangling ({danglingCount})
        </button>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-raised text-text-secondary hover:text-text-primary border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <span className="ml-auto text-sm text-text-muted">
          {data.length} image{data.length !== 1 ? "s" : ""} total
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 mb-3 bg-surface-overlay border border-border rounded-lg px-3 py-2">
          <span className="text-sm text-text-primary font-medium">
            {selectedIds.length} selected
          </span>
          <div className="h-4 w-px bg-border mx-1" />
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-secondary hover:text-danger hover:bg-surface-raised transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      )}

      {loading && data.length === 0 && (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary">
          Loading images...
        </div>
      )}

      {error && data.length === 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center">
          <p className="text-danger font-medium mb-2">Failed to load images</p>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-surface-raised border border-border rounded-lg p-12 text-center">
          <Layers className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-primary font-medium">
            {showDangling ? "No dangling images" : "No images found"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay text-text-secondary text-xs uppercase tracking-wide">
                <th className="px-3 py-2 w-8 text-left">
                  <Checkbox.Root
                    checked={allFilteredSelected}
                    onCheckedChange={selectAll}
                    className="w-4 h-4 rounded border border-border bg-surface flex items-center justify-center data-[state=checked]:bg-docker-blue data-[state=checked]:border-docker-blue"
                    aria-label="Select all"
                  >
                    <Checkbox.Indicator>
                      <Check className="w-3 h-3 text-surface" strokeWidth={3} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                </th>
                {(
                  [
                    { key: "name" as SortKey, label: "Repository:Tag" },
                    { key: "id" as SortKey, label: "ID" },
                    { key: "created" as SortKey, label: "Created" },
                    { key: "size" as SortKey, label: "Size" },
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
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((img) => (
                <tr
                  key={img.id}
                  onClick={() => setDetailImage(img)}
                  className={`border-b border-border transition-colors cursor-pointer ${
                    img.dangling
                      ? "bg-warning/5 hover:bg-warning/10"
                      : detailImage?.id === img.id
                        ? "bg-surface-overlay/60"
                        : selected.has(img.id)
                          ? "bg-surface-overlay/40 hover:bg-surface-overlay/50"
                          : "hover:bg-surface-overlay/30"
                  }`}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox.Root
                      checked={selected.has(img.id)}
                      onCheckedChange={() => toggleSelect(img.id)}
                      className="w-4 h-4 rounded border border-border bg-surface flex items-center justify-center data-[state=checked]:bg-docker-blue data-[state=checked]:border-docker-blue"
                      aria-label={`Select ${imageName(img.repoTags, img.shortId)}`}
                    >
                      <Checkbox.Indicator>
                        <Check className="w-3 h-3 text-surface" strokeWidth={3} />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-0.5">
                      {img.repoTags.length > 0 ? (
                        img.repoTags.map((tag) => (
                          <span
                            key={tag}
                            className={`font-mono text-xs ${
                              tag === "<none>:<none>"
                                ? "text-text-muted italic"
                                : "text-text-primary"
                            }`}
                          >
                            {formatTag(tag)}
                          </span>
                        ))
                      ) : (
                        <span className="text-text-muted italic text-xs">&lt;none&gt;</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-text-muted">{img.shortId}</td>
                  <td className="px-4 py-2 text-xs text-text-secondary">
                    {formatDate(img.created)}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-secondary">{formatBytes(img.size)}</td>
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          id: img.id,
                          name: imageName(img.repoTags, img.shortId),
                        })
                      }
                      className="p-1.5 rounded hover:bg-surface-overlay text-text-muted hover:text-danger transition-colors"
                      aria-label="Delete image"
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
        title={`Remove image "${deleteTarget?.name}"?`}
        description="This image will be removed from the local cache. Containers using it must be removed first."
        confirmLabel="Remove"
        destructive
        onConfirm={handleSingleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Remove ${selectedIds.length} image${selectedIds.length === 1 ? "" : "s"}?`}
        description="Selected images will be removed. Images in use by containers will fail and show an error."
        confirmLabel="Remove all"
        destructive
        onConfirm={handleBulkDelete}
        onOpenChange={setBulkDeleteOpen}
      />

      <ImageDetailPanel image={detailImage} onClose={() => setDetailImage(null)} />
    </div>
  );
}
