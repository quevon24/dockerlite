import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const confirmClass = destructive
    ? "bg-danger text-white hover:bg-danger/80"
    : "bg-docker-blue text-surface hover:bg-docker-blue/80";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-raised border border-border rounded-lg p-6 w-[420px] shadow-xl z-50">
          <div className="flex items-start gap-3 mb-4">
            {destructive && (
              <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-secondary mt-2">
                {description}
              </Dialog.Description>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              className="px-4 py-2 rounded-md text-sm bg-surface-overlay text-text-primary hover:bg-surface-overlay/70 transition-colors"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${confirmClass}`}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
