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

export interface PortMapping {
  ip: string | null;
  privatePort: number;
  publicPort: number | null;
  protocol: string;
}

export type ContainerState =
  | "running"
  | "paused"
  | "restarting"
  | "exited"
  | "created"
  | "removing"
  | "dead"
  | "";

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  imageId: string;
  command: string;
  created: number;
  state: ContainerState;
  status: string;
  ports: PortMapping[];
  labels: Record<string, string>;
  composeProject: string | null;
  composeService: string | null;
}

export interface LogLine {
  stream: "stdout" | "stderr" | string;
  timestamp: string | null;
  text: string;
}

export interface ImageInfo {
  id: string;
  shortId: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  sharedSize: number;
  dangling: boolean;
}

export interface ImageLayer {
  id: string;
  created: number;
  createdBy: string;
  tags: string[];
  size: number;
  comment: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string | null;
  size: number;
  refCount: number;
  labels: Record<string, string>;
}

export interface NetworkContainer {
  containerId: string;
  name: string;
  ipv4Address: string;
  ipv6Address: string;
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  enableIpv6: boolean;
  attachable: boolean;
  ingress: boolean;
  containers: NetworkContainer[];
  labels: Record<string, string>;
  options: Record<string, string>;
}

export interface PruneResult {
  itemsDeleted: number;
  spaceReclaimed: number;
}

export interface StatsSnapshot {
  cpuPercent: number;
  memoryUsed: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  timestamp: number;
}
