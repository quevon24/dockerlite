use bollard::Docker;
use serde::Serialize;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfoResponse {
    pub docker_version: String,
    pub api_version: String,
    pub os: String,
    pub arch: String,
    pub kernel_version: String,
    pub total_memory: i64,
    pub containers_running: i64,
    pub containers_paused: i64,
    pub containers_stopped: i64,
    pub containers_total: i64,
    pub images: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsageResponse {
    pub images_count: i64,
    pub images_size: i64,
    pub containers_count: i64,
    pub containers_size: i64,
    pub volumes_count: i64,
    pub volumes_size: i64,
    pub build_cache_size: i64,
    pub total_size: i64,
}

/// Fetch Docker daemon system info and version.
pub async fn get_info(client: &Docker) -> Result<SystemInfoResponse> {
    let info = client.info().await?;
    let version = client.version().await?;

    let containers_running = info.containers_running.unwrap_or(0);
    let containers_paused = info.containers_paused.unwrap_or(0);
    let containers_stopped = info.containers_stopped.unwrap_or(0);

    Ok(SystemInfoResponse {
        docker_version: version.version.unwrap_or_default(),
        api_version: version.api_version.unwrap_or_default(),
        os: info.operating_system.unwrap_or_default(),
        arch: info.architecture.unwrap_or_default(),
        kernel_version: info.kernel_version.unwrap_or_default(),
        total_memory: info.mem_total.unwrap_or(0),
        containers_running,
        containers_paused,
        containers_stopped,
        containers_total: containers_running + containers_paused + containers_stopped,
        images: info.images.unwrap_or(0),
    })
}

/// Fetch Docker disk usage (equivalent to `docker system df`).
pub async fn get_disk_usage(client: &Docker) -> Result<DiskUsageResponse> {
    let df = client.df(None).await?;

    let images_count = df
        .images_disk_usage
        .as_ref()
        .and_then(|d| d.total_count)
        .unwrap_or(0);
    let images_size = df
        .images_disk_usage
        .as_ref()
        .and_then(|d| d.total_size)
        .unwrap_or(0);

    let containers_count = df
        .containers_disk_usage
        .as_ref()
        .and_then(|d| d.total_count)
        .unwrap_or(0);
    let containers_size = df
        .containers_disk_usage
        .as_ref()
        .and_then(|d| d.total_size)
        .unwrap_or(0);

    let volumes_count = df
        .volumes_disk_usage
        .as_ref()
        .and_then(|d| d.total_count)
        .unwrap_or(0);
    let volumes_size = df
        .volumes_disk_usage
        .as_ref()
        .and_then(|d| d.total_size)
        .unwrap_or(0);

    let build_cache_size = df
        .build_cache_disk_usage
        .as_ref()
        .and_then(|d| d.total_size)
        .unwrap_or(0);

    Ok(DiskUsageResponse {
        images_count,
        images_size,
        containers_count,
        containers_size,
        volumes_count,
        volumes_size,
        build_cache_size,
        total_size: images_size + containers_size + volumes_size + build_cache_size,
    })
}
