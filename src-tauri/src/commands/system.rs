use tauri::State;

use crate::docker::system::{DiskUsageResponse, SystemInfoResponse};
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
    let client = docker.client()?;
    crate::docker::system::get_disk_usage(&client).await
}
