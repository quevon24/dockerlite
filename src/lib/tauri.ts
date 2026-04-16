import { invoke } from "@tauri-apps/api/core";
import type { SystemInfo, DiskUsage, ContainerInfo } from "./types";

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
