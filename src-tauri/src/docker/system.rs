use bollard::Docker;
use bollard::query_parameters::{
    ListContainersOptionsBuilder, ListImagesOptionsBuilder, ListVolumesOptions,
    PruneBuildOptions, PruneImagesOptions, PruneVolumesOptions,
};
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

/// Fetch Docker disk usage by querying individual list endpoints.
/// Bollard 0.20's df() aggregate fields don't match the Docker API field
/// names, so we compute sizes from the list results instead.
pub async fn get_disk_usage(client: &Docker) -> Result<DiskUsageResponse> {
    let images = client
        .list_images(Some(ListImagesOptionsBuilder::new().all(true).build()))
        .await?;
    let images_count = images.len() as i64;
    let images_size: i64 = images.iter().map(|i| i.size).sum();

    let containers = client
        .list_containers(Some(ListContainersOptionsBuilder::new().all(true).build()))
        .await?;
    let containers_count = containers.len() as i64;
    let containers_size: i64 = containers.iter().filter_map(|c| c.size_rw).sum();

    let volumes_resp = client.list_volumes(None::<ListVolumesOptions>).await?;
    let volumes = volumes_resp.volumes.unwrap_or_default();
    let volumes_count = volumes.len() as i64;
    let volumes_size: i64 = volumes
        .iter()
        .filter_map(|v| v.usage_data.as_ref())
        .map(|u| u.size.max(0))
        .sum();

    // Build cache size: try df endpoint, fall back to 0 if the aggregate
    // fields aren't populated (Bollard/API version mismatch).
    let build_cache_size: i64 = client
        .df(None)
        .await
        .ok()
        .and_then(|df| df.build_cache_disk_usage)
        .and_then(|b| b.total_size)
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PruneResult {
    pub items_deleted: u32,
    pub space_reclaimed: i64,
}

/// Prune stopped containers.
pub async fn prune_containers(client: &Docker) -> Result<PruneResult> {
    let resp = client.prune_containers(None).await?;
    Ok(PruneResult {
        items_deleted: resp.containers_deleted.map(|v| v.len() as u32).unwrap_or(0),
        space_reclaimed: resp.space_reclaimed.unwrap_or(0),
    })
}

/// Prune unused images. If `all` is true, removes all unused images (not just dangling).
pub async fn prune_images(client: &Docker, all: bool) -> Result<PruneResult> {
    let mut opts = PruneImagesOptions::default();
    if all {
        let mut filters = std::collections::HashMap::new();
        filters.insert("dangling".to_string(), vec!["false".to_string()]);
        opts.filters = Some(filters);
    }
    let resp = client.prune_images(Some(opts)).await?;
    Ok(PruneResult {
        items_deleted: resp.images_deleted.map(|v| v.len() as u32).unwrap_or(0),
        space_reclaimed: resp.space_reclaimed.unwrap_or(0),
    })
}

/// Prune unused volumes.
pub async fn prune_volumes(client: &Docker) -> Result<PruneResult> {
    let resp = client.prune_volumes(None::<PruneVolumesOptions>).await?;
    Ok(PruneResult {
        items_deleted: resp.volumes_deleted.map(|v| v.len() as u32).unwrap_or(0),
        space_reclaimed: resp.space_reclaimed.unwrap_or(0),
    })
}

/// Prune unused networks.
pub async fn prune_networks(client: &Docker) -> Result<PruneResult> {
    let resp = client.prune_networks(None).await?;
    Ok(PruneResult {
        items_deleted: resp.networks_deleted.map(|v| v.len() as u32).unwrap_or(0),
        space_reclaimed: 0,
    })
}

/// Prune build cache.
pub async fn prune_build_cache(client: &Docker) -> Result<PruneResult> {
    let resp = client
        .prune_build(None::<PruneBuildOptions>)
        .await?;
    Ok(PruneResult {
        items_deleted: resp.caches_deleted.map(|v| v.len() as u32).unwrap_or(0),
        space_reclaimed: resp.space_reclaimed.unwrap_or(0),
    })
}
