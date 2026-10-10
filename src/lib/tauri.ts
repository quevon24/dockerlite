import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  SystemInfo,
  DiskUsage,
  ContainerInfo,
  ImageInfo,
  ImageLayer,
  VolumeInfo,
  NetworkInfo,
  PruneResult,
  LogLine,
  StatsSnapshot,
} from "./types";

export async function setMinimizeToTray(enabled: boolean): Promise<void> {
  return invoke("set_minimize_to_tray", { enabled });
}

export async function reconnectDocker(socketPath: string): Promise<void> {
  return invoke("reconnect_docker", { socketPath });
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke("get_system_info");
}

export async function getDiskUsage(): Promise<DiskUsage> {
  return invoke("get_disk_usage");
}

export async function listContainers(): Promise<ContainerInfo[]> {
  return invoke("list_containers");
}

export async function listImages(): Promise<ImageInfo[]> {
  return invoke("list_images");
}

export async function removeImage(id: string, force: boolean): Promise<void> {
  return invoke("remove_image", { id, force });
}

export async function getImageLayers(id: string): Promise<ImageLayer[]> {
  return invoke("get_image_layers", { id });
}

export async function listVolumes(): Promise<VolumeInfo[]> {
  return invoke("list_volumes");
}

export async function removeVolume(name: string): Promise<void> {
  return invoke("remove_volume", { name });
}

export async function listNetworks(): Promise<NetworkInfo[]> {
  return invoke("list_networks");
}

export async function removeNetwork(id: string): Promise<void> {
  return invoke("remove_network", { id });
}

export async function pruneContainers(): Promise<PruneResult> {
  return invoke("prune_containers");
}

export async function pruneImages(all: boolean): Promise<PruneResult> {
  return invoke("prune_images", { all });
}

export async function pruneVolumes(): Promise<PruneResult> {
  return invoke("prune_volumes");
}

export async function pruneNetworks(): Promise<PruneResult> {
  return invoke("prune_networks");
}

export async function pruneBuildCache(): Promise<PruneResult> {
  return invoke("prune_build_cache");
}

export async function inspectContainer(id: string): Promise<unknown> {
  return invoke("inspect_container", { id });
}

export async function startContainer(id: string): Promise<void> {
  return invoke("start_container", { id });
}

export async function stopContainer(id: string): Promise<void> {
  return invoke("stop_container", { id });
}

export async function restartContainer(id: string): Promise<void> {
  return invoke("restart_container", { id });
}

export async function pauseContainer(id: string): Promise<void> {
  return invoke("pause_container", { id });
}

export async function unpauseContainer(id: string): Promise<void> {
  return invoke("unpause_container", { id });
}

export async function removeContainer(id: string, force: boolean): Promise<void> {
  return invoke("remove_container", { id, force });
}

/**
 * Start an interactive exec session (/bin/sh) in a container. Output bytes
 * arrive via onOutput (sent as raw bytes by the backend, so they reach JS as
 * an ArrayBuffer without JSON serialization); onExit fires once when the
 * backend signals that the session ended (empty payload sentinel), after
 * which the backend has already cleaned up and stop() is a no-op.
 */
export async function startExec(
  containerId: string,
  onOutput: (data: Uint8Array) => void,
  onExit?: () => void,
): Promise<{ execId: string; stop: () => Promise<void> }> {
  const channel = new Channel<ArrayBuffer | number[]>();
  channel.onmessage = (data) => {
    const bytes = new Uint8Array(data instanceof ArrayBuffer ? data : data);
    if (bytes.length === 0) {
      onExit?.();
    } else {
      onOutput(bytes);
    }
  };
  const execId = await invoke<string>("start_exec", {
    containerId,
    onOutput: channel,
  });
  return {
    execId,
    stop: () => invoke<void>("stop_exec", { execId }),
  };
}

export async function writeExecInput(execId: string, data: Uint8Array): Promise<void> {
  return invoke("write_exec_input", { execId, data: Array.from(data) });
}

export async function resizeExecTerminal(
  execId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("resize_exec_terminal", { execId, cols, rows });
}

/** Tagged events emitted by the backend log stream. */
export type LogStreamEvent =
  { type: "lines"; lines: LogLine[] } | { type: "error"; message: string } | { type: "ended" };

/** Tagged events emitted by the backend stats stream. */
export type StatsStreamEvent =
  | { type: "snapshot"; snapshot: StatsSnapshot }
  | { type: "error"; message: string }
  | { type: "ended" };

/**
 * Start streaming container stats. The backend returns a unique stream id,
 * so the returned stop function only ever cancels this stream, never a
 * newer one for the same container.
 */
export function streamContainerStats(
  id: string,
  onEvent: (event: StatsStreamEvent) => void,
): Promise<() => Promise<void>> {
  const channel = new Channel<StatsStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<string>("stream_container_stats", { id, onEvent: channel }).then(
    (streamId) => () => invoke<void>("stop_stream", { streamId }),
  );
}

/**
 * Start streaming container logs. The backend returns a unique stream id,
 * so the returned stop function only ever cancels this stream.
 */
export function streamContainerLogs(
  id: string,
  tail: number,
  onEvent: (event: LogStreamEvent) => void,
): Promise<() => Promise<void>> {
  const channel = new Channel<LogStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<string>("stream_container_logs", { id, tail, onEvent: channel }).then(
    (streamId) => () => invoke<void>("stop_stream", { streamId }),
  );
}
