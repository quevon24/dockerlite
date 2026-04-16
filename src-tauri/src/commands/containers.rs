use tauri::State;

use crate::docker::containers::ContainerInfo;
use crate::error::DockerLiteError;
use crate::state::DockerState;

#[tauri::command]
pub async fn list_containers(
    docker: State<'_, DockerState>,
) -> Result<Vec<ContainerInfo>, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::list_all(&client).await
}

#[tauri::command]
pub async fn inspect_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<serde_json::Value, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::inspect(&client, &id).await
}

#[tauri::command]
pub async fn start_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::start(&client, &id).await
}

#[tauri::command]
pub async fn stop_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::stop(&client, &id).await
}

#[tauri::command]
pub async fn restart_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::restart(&client, &id).await
}

#[tauri::command]
pub async fn pause_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::pause(&client, &id).await
}

#[tauri::command]
pub async fn unpause_container(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::unpause(&client, &id).await
}

#[tauri::command]
pub async fn remove_container(
    id: String,
    force: bool,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::containers::remove(&client, &id, force).await
}
