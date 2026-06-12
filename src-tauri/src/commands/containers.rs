use std::time::Duration;

use futures_util::StreamExt;
use tauri::ipc::Channel;
use tauri::{Manager, State};

use crate::docker::containers::{ContainerInfo, LogLine, StatsSnapshot};
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

/// Start streaming a container's logs. Returns a unique stream id that the
/// frontend passes to `stop_stream`; ids are never reused, so a stale stop
/// cannot cancel a newer stream for the same container.
#[tauri::command]
pub async fn stream_container_logs(
    id: String,
    tail: u32,
    app: tauri::AppHandle,
    docker: State<'_, DockerState>,
    streams: State<'_, StreamRegistry>,
    on_event: Channel<Vec<LogLine>>,
) -> Result<String, DockerLiteError> {
    let key = streams.next_key("logs");

    let client = docker.client()?;
    let container_id = id;
    let task_key = key.clone();
    streams.register_with(key.clone(), move || {
        tokio::spawn(async move {
            // Reconnect loop: when the bollard stream ends (e.g. container
            // restart), wait briefly and reconnect using since=now-equivalent
            // (tail=0) so we don't replay historical lines.
            let mut first_run = true;
            'outer: loop {
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
                                break 'outer;
                            }
                        }
                        Ok(_) => continue,
                        Err(_) => break,
                    }
                }

                // Stream ended. If the container is gone, exit cleanly;
                // otherwise wait briefly and try again.
                if client.inspect_container(&container_id, None).await.is_err() {
                    break 'outer;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            app.state::<StreamRegistry>().remove(&task_key);
        })
    });

    Ok(key)
}

/// Start streaming a container's stats. Returns a unique stream id that the
/// frontend passes to `stop_stream`.
#[tauri::command]
pub async fn stream_container_stats(
    id: String,
    app: tauri::AppHandle,
    docker: State<'_, DockerState>,
    streams: State<'_, StreamRegistry>,
    on_event: Channel<StatsSnapshot>,
) -> Result<String, DockerLiteError> {
    let key = streams.next_key("stats");

    let client = docker.client()?;
    let container_id = id;
    let task_key = key.clone();
    streams.register_with(key.clone(), move || {
        tokio::spawn(async move {
            use bollard::query_parameters::StatsOptionsBuilder;

            'outer: loop {
                let options = StatsOptionsBuilder::new().stream(true).build();
                let mut stream = Box::pin(client.stats(&container_id, Some(options)));

                while let Some(item) = stream.next().await {
                    match item {
                        Ok(stats) => {
                            if let Some(snapshot) = crate::docker::containers::compute_stats(&stats)
                            {
                                if on_event.send(snapshot).is_err() {
                                    break 'outer;
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }

                if client.inspect_container(&container_id, None).await.is_err() {
                    break 'outer;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            app.state::<StreamRegistry>().remove(&task_key);
        })
    });

    Ok(key)
}

/// Stop a log or stats stream by the id returned from the stream command.
#[tauri::command]
pub async fn stop_stream(
    stream_id: String,
    streams: State<'_, StreamRegistry>,
) -> Result<(), DockerLiteError> {
    streams.cancel(&stream_id);
    Ok(())
}
