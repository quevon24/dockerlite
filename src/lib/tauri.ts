import { invoke } from "@tauri-apps/api/core";
import type { SystemInfo, DiskUsage } from "./types";

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke("get_system_info");
}

export async function getDiskUsage(): Promise<DiskUsage> {
  return invoke("get_disk_usage");
}
