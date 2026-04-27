use tauri::State;

use crate::docker::images::{ImageInfo, ImageLayer};
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

#[tauri::command]
pub async fn get_image_layers(
    id: String,
    docker: State<'_, DockerState>,
) -> Result<Vec<ImageLayer>, DockerLiteError> {
    let client = docker.client()?;
    crate::docker::images::get_layers(&client, &id).await
}
