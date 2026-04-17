use tauri::State;

use crate::docker::images::ImageInfo;
use crate::error::DockerLiteError;
use crate::state::DockerState;

#[tauri::command]
pub async fn list_images(
    docker: State<'_, DockerState>,
) -> Result<Vec<ImageInfo>, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::images::list_all(&client).await
}

#[tauri::command]
pub async fn remove_image(
    id: String,
    force: bool,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    crate::docker::images::remove(&client, &id, force).await
}
