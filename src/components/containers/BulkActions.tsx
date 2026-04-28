import { useState } from "react";
import { Play, Square, RotateCw, Trash2, X } from "lucide-react";
import { startContainer, stopContainer, restartContainer, removeContainer } from "../../lib/tauri";
import { useToast } from "../ui/Toast";
import ConfirmDialog from "../ui/ConfirmDialog";

interface BulkActionsProps {
  selectedIds: string[];
  onAction: () => void;
  onClear: () => void;
}

export default function BulkActions({ selectedIds, onAction, onClear }: BulkActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const runAll = async (fn: (id: string) => Promise<void>, label: string) => {
    const count = selectedIds.length;
    toast(`${label} ${count} container${count > 1 ? "s" : ""}`, undefined, "info");

    const results = await Promise.allSettled(selectedIds.map((id) => fn(id)));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      toast(
        `${failed.length} container${failed.length > 1 ? "s" : ""} failed`,
        (failed[0] as PromiseRejectedResult).reason?.toString(),
        "error",
      );
    }

    onAction();
    onClear();
  };

  const deleteAll = async () => {
    await runAll((id) => removeContainer(id, true), "Removing");
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3 bg-surface-overlay border border-border rounded-lg px-3 py-2">
        <span className="text-sm text-text-primary font-medium">{selectedIds.length} selected</span>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          onClick={() => runAll(startContainer, "Starting")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-secondary hover:text-success hover:bg-surface-raised transition-colors"
        >
          <Play className="w-3.5 h-3.5" /> Start
        </button>
        <button
          onClick={() => runAll(stopContainer, "Stopping")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-secondary hover:text-warning hover:bg-surface-raised transition-colors"
        >
          <Square className="w-3.5 h-3.5" /> Stop
        </button>
        <button
          onClick={() => runAll(restartContainer, "Restarting")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-secondary hover:text-accent hover:bg-surface-raised transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" /> Restart
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-secondary hover:text-danger hover:bg-surface-raised transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={`Remove ${selectedIds.length} container${selectedIds.length === 1 ? "" : "s"}?`}
        description="All selected containers will be force-removed along with their anonymous volumes. This cannot be undone."
        confirmLabel="Remove all"
        destructive
        onConfirm={deleteAll}
        onOpenChange={setConfirmOpen}
      />
    </>
  );
}
