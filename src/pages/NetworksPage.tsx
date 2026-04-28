import { useState } from "react";
import { Network, Trash2, RefreshCw } from "lucide-react";
import { useNetworks } from "../lib/hooks/useNetworks";
import type { NetworkInfo } from "../lib/types";
import { removeNetwork } from "../lib/tauri";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import NetworkDetailPanel from "../components/networks/NetworkDetailPanel";

const BUILTIN_NETWORKS = ["bridge", "host", "none"];

export default function NetworksPage() {
  const { data: rawData, error, loading, refresh } = useNetworks();
  const data = [...rawData].sort((a, b) => a.name.localeCompare(b.name));
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [detailNetwork, setDetailNetwork] = useState<NetworkInfo | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeNetwork(deleteTarget.id);
      toast("Network removed", deleteTarget.name, "success");
    } catch (e) {
      toast("Failed to remove network", String(e), "error");
    }
    refresh();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Networks</h1>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-raised text-text-secondary hover:text-text-primary border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <span className="ml-auto text-sm text-text-muted">
          {data.length} network{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading && data.length === 0 && (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-secondary">
          Loading networks...
        </div>
      )}

      {error && data.length === 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center">
          <p className="text-danger font-medium mb-2">Failed to load networks</p>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="bg-surface-raised border border-border rounded-lg p-12 text-center">
          <Network className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-primary font-medium">No networks found</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="space-y-3">
          {data.map((net) => {
            const isBuiltin = BUILTIN_NETWORKS.includes(net.name);
            return (
              <div
                key={net.id}
                onClick={() => setDetailNetwork(net)}
                className={`bg-surface-raised border rounded-lg p-4 cursor-pointer transition-colors ${
                  detailNetwork?.id === net.id
                    ? "border-docker-blue/50 bg-surface-overlay/40"
                    : "border-border hover:border-border hover:bg-surface-overlay/20"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-text-primary font-medium">{net.name}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-surface-overlay text-text-secondary">
                    {net.driver}
                  </span>
                  <span className="text-xs text-text-muted">{net.scope}</span>
                  {net.internal && (
                    <span className="px-2 py-0.5 rounded text-xs bg-warning/20 text-warning">
                      internal
                    </span>
                  )}
                  {!isBuiltin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: net.id, name: net.name });
                      }}
                      className="ml-auto p-1.5 rounded hover:bg-surface-overlay text-text-muted hover:text-danger transition-colors"
                      aria-label="Delete network"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {isBuiltin && (
                    <span className="ml-auto text-xs text-text-muted italic">built-in</span>
                  )}
                </div>
                <div className="text-xs text-text-muted font-mono mb-2">{net.id.slice(0, 12)}</div>
                {net.containers.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="text-xs text-text-secondary font-medium mb-2">
                      Connected containers ({net.containers.length})
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {net.containers.map((c) => (
                        <div key={c.containerId} className="flex items-center gap-3 text-xs">
                          <span className="text-text-primary font-medium">
                            {c.name || c.containerId.slice(0, 12)}
                          </span>
                          {c.ipv4Address && (
                            <span className="text-text-muted font-mono">{c.ipv4Address}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {net.containers.length === 0 && (
                  <div className="text-xs text-text-muted italic mt-1">No containers connected</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Remove network "${deleteTarget?.name}"?`}
        description="Containers connected to this network will lose connectivity. This cannot be undone."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />

      <NetworkDetailPanel network={detailNetwork} onClose={() => setDetailNetwork(null)} />
    </div>
  );
}
