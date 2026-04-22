use bollard::Docker;
use bollard::query_parameters::{PruneBuildOptions, PruneImagesOptions, PruneVolumesOptions};
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;

use crate::error::{DockerLiteError, Result};

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

/// Make a raw HTTP GET to the Docker Unix socket and return parsed JSON.
/// Bypasses Bollard entirely to avoid field-name mismatches in the df
/// response (Bollard 0.20 expects names the Docker API doesn't use).
async fn raw_docker_get(socket_path: &str, path: &str) -> Result<serde_json::Value> {
    let mut stream = UnixStream::connect(socket_path)
        .await
        .map_err(DockerLiteError::Io)?;

    let req = format!("GET {path} HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\n\r\n");
    stream
        .write_all(req.as_bytes())
        .await
        .map_err(DockerLiteError::Io)?;

    let mut buf = Vec::new();
    stream
        .read_to_end(&mut buf)
        .await
        .map_err(DockerLiteError::Io)?;

    let text = String::from_utf8_lossy(&buf);
    let body_start = text.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    serde_json::from_str(&text[body_start..]).map_err(DockerLiteError::Serialization)
}

fn sum_i64(arr: Option<&Vec<serde_json::Value>>, key: &str) -> i64 {
    arr.map(|a| a.iter().filter_map(|v| v.get(key)?.as_i64()).sum())
        .unwrap_or(0)
}

fn sum_nested_i64(arr: Option<&Vec<serde_json::Value>>, outer: &str, inner: &str) -> i64 {
    arr.map(|a| {
        a.iter()
            .filter_map(|v| v.get(outer)?.get(inner)?.as_i64())
            .filter(|&s| s > 0)
            .sum()
    })
    .unwrap_or(0)
}

/// Fetch Docker disk usage via a raw `/system/df` request.
/// Parses the JSON directly because Bollard 0.20's typed response
/// uses field names that don't match the Docker API.
pub async fn get_disk_usage(socket_path: &str) -> Result<DiskUsageResponse> {
    let df = raw_docker_get(socket_path, "/system/df").await?;

    let images = df.get("Images").and_then(|v| v.as_array());
    let images_count = images.map(|a| a.len()).unwrap_or(0) as i64;
    let images_size = sum_i64(images, "Size");

    let containers = df.get("Containers").and_then(|v| v.as_array());
    let containers_count = containers.map(|a| a.len()).unwrap_or(0) as i64;
    let containers_size = sum_i64(containers, "SizeRw");

    let volumes = df.get("Volumes").and_then(|v| v.as_array());
    let volumes_count = volumes.map(|a| a.len()).unwrap_or(0) as i64;
    let volumes_size = sum_nested_i64(volumes, "UsageData", "Size");

    let build_cache = df.get("BuildCache").and_then(|v| v.as_array());
    let build_cache_size = sum_i64(build_cache, "Size");

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
