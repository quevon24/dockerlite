use tauri::State;

use crate::docker::networks::NetworkInfo;
use crate::error::DockerLiteError;
use crate::state::DockerState;

#[tauri::command]
pub async fn list_networks(
    docker: State<'_, DockerState>,
) -> Result<Vec<NetworkInfo>, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::networks::list_all(&client).await
}

#[tauri::command]
pub async fn remove_network(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::networks::remove(&client, &id).await
}
