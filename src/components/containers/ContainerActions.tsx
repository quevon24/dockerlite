import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MoreVertical,
  Play,
  Square,
  RotateCw,
  Pause,
  PlayCircle,
  Trash2,
} from "lucide-react";
import type { ContainerInfo } from "../../lib/types";
import {
  startContainer,
  stopContainer,
  restartContainer,
  pauseContainer,
  unpauseContainer,
  removeContainer,
} from "../../lib/tauri";
import ConfirmDialog from "../ui/ConfirmDialog";

interface ContainerActionsProps {
  container: ContainerInfo;
  onAction: () => void;
}

const ITEM_CLASS =
  "flex items-center gap-2 px-3 py-1.5 text-sm rounded cursor-pointer outline-none data-[highlighted]:bg-surface-overlay";

export default function ContainerActions({
  container,
  onAction,
}: ContainerActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isRunning = container.state === "running";
  const isPaused = container.state === "paused";
  const isStopped =
    container.state === "exited" ||
    container.state === "created" ||
    container.state === "dead";

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      console.error("Container action failed:", e);
    } finally {
      onAction();
    }
  };

  const confirmDelete = async () => {
    await run(() => removeContainer(container.id, !isStopped));
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="p-1.5 rounded hover:bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors outline-none"
            aria-label="Container actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="bg-surface-raised border border-border rounded-lg p-1 min-w-[160px] shadow-xl z-30"
          >
            {isStopped && (
              <DropdownMenu.Item
                className={ITEM_CLASS}
                onSelect={() => run(() => startContainer(container.id))}
              >
                <Play className="w-4 h-4 text-success" /> Start
              </DropdownMenu.Item>
            )}
            {isRunning && (
              <>
                <DropdownMenu.Item
                  className={ITEM_CLASS}
                  onSelect={() => run(() => stopContainer(container.id))}
                >
                  <Square className="w-4 h-4 text-warning" /> Stop
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={ITEM_CLASS}
                  onSelect={() => run(() => restartContainer(container.id))}
                >
                  <RotateCw className="w-4 h-4 text-accent" /> Restart
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={ITEM_CLASS}
                  onSelect={() => run(() => pauseContainer(container.id))}
                >
                  <Pause className="w-4 h-4 text-warning" /> Pause
                </DropdownMenu.Item>
              </>
            )}
            {isPaused && (
              <DropdownMenu.Item
                className={ITEM_CLASS}
                onSelect={() => run(() => unpauseContainer(container.id))}
              >
                <PlayCircle className="w-4 h-4 text-success" /> Unpause
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="h-px bg-border my-1" />
            <DropdownMenu.Item
              className={`${ITEM_CLASS} text-danger`}
              onSelect={() => setConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" /> Remove
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={confirmOpen}
        title={`Remove container "${container.name}"?`}
        description={
          isStopped
            ? "This container will be permanently removed along with its anonymous volumes."
            : "The container is running. It will be force-removed along with its anonymous volumes."
        }
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
        onOpenChange={setConfirmOpen}
      />
    </>
  );
}
