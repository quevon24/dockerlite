import { invoke, Channel } from "@tauri-apps/api/core";
import type { SystemInfo, DiskUsage, ContainerInfo, LogLine } from "./types";

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke("get_system_info");
}

export async function getDiskUsage(): Promise<DiskUsage> {
  return invoke("get_disk_usage");
}

export async function listContainers(): Promise<ContainerInfo[]> {
  return invoke("list_containers");
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
 * Start streaming container logs. The onBatch callback fires with each batch
 * of log lines emitted by the backend. Returns a teardown promise that stops
 * the stream when called.
 */
export function streamContainerLogs(
  id: string,
  tail: number,
  onBatch: (lines: LogLine[]) => void,
): Promise<() => Promise<void>> {
  const channel = new Channel<LogLine[]>();
  channel.onmessage = onBatch;
  return invoke<void>("stream_container_logs", { id, tail, onEvent: channel }).then(
    () => () => invoke<void>("stop_log_stream", { id }),
  );
}
