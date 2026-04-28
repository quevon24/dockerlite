import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ImageInfo, ImageLayer } from "../../lib/types";
import { getImageLayers } from "../../lib/tauri";

interface Props {
  image: ImageInfo | null;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanCommand(cmd: string): string {
  // Strip shell wrapper added by Docker for RUN instructions
  if (cmd.startsWith("|")) {
    const match = cmd.match(/\/bin\/sh -c (.+)$/);
    if (match) return match[1];
  }
  cmd = cmd.replace(/^\/bin\/sh -c #\(nop\) /, "");
  cmd = cmd.replace(/^\/bin\/sh -c /, "RUN ");
  return cmd.trim() || "<empty layer>";
}

function shortLayerId(id: string): string {
  if (id === "<missing>") return "<missing>";
  const hex = id.replace(/^sha256:/, "");
  return hex.slice(0, 12);
}

export default function ImageDetailPanel({ image, onClose }: Props) {
  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!image) {
      setLayers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getImageLayers(image.id)
      .then((l) => {
        if (!cancelled) setLayers(l);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [image?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const open = image !== null;
  const tags = image?.repoTags.filter((t) => t !== "<none>:<none>") ?? [];

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/30" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[520px] bg-surface border-l border-border shadow-2xl flex flex-col z-30 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {image && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-text-primary truncate">
                  {tags.length > 0 ? tags[0] : image.shortId}
                </h2>
                <p className="text-xs text-text-muted font-mono mt-0.5">{image.shortId}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded hover:bg-surface-overlay text-text-muted hover:text-text-primary transition-colors ml-3 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  Details
                </h3>
                <div className="bg-surface-raised border border-border rounded-lg divide-y divide-border">
                  <Row label="ID" value={image.id.replace(/^sha256:/, "")} mono />
                  <Row label="Created" value={formatDate(image.created)} />
                  <Row label="Size" value={formatBytes(image.size)} />
                  {image.sharedSize > 0 && (
                    <Row label="Shared size" value={formatBytes(image.sharedSize)} />
                  )}
                </div>
              </section>

              {tags.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-surface-overlay border border-border text-xs font-mono text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {image.repoDigests.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    Digests
                  </h3>
                  <div className="space-y-1">
                    {image.repoDigests.map((d) => (
                      <p key={d} className="text-xs font-mono text-text-muted break-all">
                        {d}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  Layers {!loading && `(${layers.length})`}
                </h3>
                {loading && <p className="text-xs text-text-muted">Loading layers...</p>}
                {error && <p className="text-xs text-danger">{error}</p>}
                {!loading && !error && layers.length > 0 && (
                  <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-overlay text-text-muted uppercase tracking-wide">
                          <th className="px-3 py-1.5 text-left font-medium w-[100px]">ID</th>
                          <th className="px-3 py-1.5 text-left font-medium">Command</th>
                          <th className="px-3 py-1.5 text-right font-medium w-[70px]">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {layers.map((layer, i) => (
                          <tr key={`${layer.id}-${i}`} className="border-t border-border">
                            <td className="px-3 py-2 font-mono text-text-muted align-top">
                              {shortLayerId(layer.id)}
                            </td>
                            <td className="px-3 py-2 text-text-secondary break-all align-top">
                              {cleanCommand(layer.createdBy)}
                            </td>
                            <td className="px-3 py-2 text-right text-text-muted align-top whitespace-nowrap">
                              {layer.size > 0 ? formatBytes(layer.size) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 px-3 py-2">
      <span className="text-xs text-text-muted w-[90px] shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-text-primary break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
