use tauri::State;

use crate::docker::system::{DiskUsageResponse, PruneResult, SystemInfoResponse};
use crate::error::DockerLiteError;
use crate::state::DockerState;

#[tauri::command]
pub async fn get_system_info(
    docker: State<'_, DockerState>,
) -> Result<SystemInfoResponse, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::system::get_info(&client).await
}

#[tauri::command]
pub async fn get_disk_usage(
    docker: State<'_, DockerState>,
) -> Result<DiskUsageResponse, DockerLiteError> {
    let path = docker.socket_path();
    crate::docker::system::get_disk_usage(&path).await
}

#[tauri::command]
pub async fn prune_containers(
    docker: State<'_, DockerState>,
) -> Result<PruneResult, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::system::prune_containers(&client).await
}

#[tauri::command]
pub async fn prune_images(
    all: bool,
    docker: State<'_, DockerState>,
) -> Result<PruneResult, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::system::prune_images(&client, all).await
}

#[tauri::command]
pub async fn prune_volumes(
    docker: State<'_, DockerState>,
) -> Result<PruneResult, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::system::prune_volumes(&client).await
}

#[tauri::command]
pub async fn prune_networks(
    docker: State<'_, DockerState>,
) -> Result<PruneResult, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::system::prune_networks(&client).await
}

#[tauri::command]
pub async fn prune_build_cache(
    docker: State<'_, DockerState>,
) -> Result<PruneResult, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::system::prune_build_cache(&client).await
}
