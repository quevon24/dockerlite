use std::time::Duration;

use futures_util::StreamExt;
use tauri::State;
use tauri::ipc::Channel;

use crate::docker::containers::{ContainerInfo, LogLine};
use crate::error::DockerLiteError;
use crate::state::{DockerState, StreamRegistry};

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

#[tauri::command]
pub async fn stream_container_logs(
    id: String,
    tail: u32,
    docker: State<'_, DockerState>,
    streams: State<'_, StreamRegistry>,
    on_event: Channel<Vec<LogLine>>,
) -> Result<(), DockerLiteError> {
    let key = format!("logs:{id}");
    streams.cancel(&key);

    let client = docker.client()?;
    let container_id = id.clone();
    let handle = tokio::spawn(async move {
        // Reconnect loop: when the bollard stream ends (e.g. container
        // restart), wait briefly and reconnect using since=now-equivalent
        // (tail=0) so we don't replay historical lines.
        let mut first_run = true;
        loop {
            let stream_tail = if first_run { tail } else { 0 };
            first_run = false;

            let mut stream = Box::pin(crate::docker::containers::logs_stream(
                &client,
                &container_id,
                stream_tail,
            ));

            while let Some(item) = stream.next().await {
                match item {
                    Ok(lines) if !lines.is_empty() => {
                        if on_event.send(lines).is_err() {
                            return;
                        }
                    }
                    Ok(_) => continue,
                    Err(_) => break,
                }
            }

            // Stream ended. If the container is gone, exit cleanly;
            // otherwise wait briefly and try again.
            if client.inspect_container(&container_id, None).await.is_err() {
                return;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    });

    streams.register(key, handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_log_stream(
    id: String,
    streams: State<'_, StreamRegistry>,
) -> Result<(), DockerLiteError> {
    streams.cancel(&format!("logs:{id}"));
    Ok(())
}
