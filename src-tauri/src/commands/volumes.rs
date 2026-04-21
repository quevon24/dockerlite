use tauri::State;

use crate::docker::volumes::VolumeInfo;
use crate::error::DockerLiteError;
use crate::state::DockerState;

#[tauri::command]
pub async fn list_volumes(
    docker: State<'_, DockerState>,
) -> Result<Vec<VolumeInfo>, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::volumes::list_all(&client).await
}

#[tauri::command]
pub async fn remove_volume(
    name: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::volumes::remove(&client, &name).await
}
