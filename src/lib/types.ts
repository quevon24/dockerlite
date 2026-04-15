export interface SystemInfo {
  dockerVersion: string;
  apiVersion: string;
  os: string;
  arch: string;
  kernelVersion: string;
  totalMemory: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  containersTotal: number;
  images: number;
}

export interface DiskUsage {
  imagesCount: number;
  imagesSize: number;
  containersCount: number;
  containersSize: number;
  volumesCount: number;
  volumesSize: number;
  buildCacheSize: number;
  totalSize: number;
}
