use std::time::Duration;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{Manager, State};

use crate::docker::containers::{ContainerInfo, LogLine, StatsSnapshot};
use crate::error::DockerLiteError;
use crate::state::{DockerState, StreamRegistry};

/// Events emitted on the log stream channel. Tagged so the frontend can
/// distinguish data from stream errors and termination instead of watching
/// a silently frozen stream.
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LogEvent {
    Lines { lines: Vec<LogLine> },
    Error { message: String },
    Ended,
}

/// Events emitted on the stats stream channel.
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StatsEvent {
    Snapshot { snapshot: StatsSnapshot },
    Error { message: String },
    Ended,
}

/// Reconnect policy shared by the log and stats streams, evaluated after the
/// underlying stream ends: exit when the container is gone (signalling the
/// frontend), and while it exists but isn't running, poll with capped
/// backoff instead of re-opening a stream that ends instantly. Returns false
/// when the stream task should stop.
async fn wait_until_running(client: &bollard::Docker, container_id: &str) -> bool {
    let mut delay = Duration::from_millis(500);
    loop {
        match client.inspect_container(container_id, None).await {
            Err(_) => return false,
            Ok(info) => {
                let running = info.state.as_ref().and_then(|s| s.running).unwrap_or(false);
                if running {
                    return true;
                }
            }
        }
        tokio::time::sleep(delay).await;
        delay = (delay * 2).min(Duration::from_secs(5));
    }
}

/// Backoff for consecutive stream failures (e.g. a log driver that does not
/// support reading): 500ms doubling up to 8s.
fn failure_backoff(streak: u32) -> Duration {
    (Duration::from_millis(500) * 2u32.saturating_pow(streak.min(4))).min(Duration::from_secs(8))
}

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
    on_event: Channel<LogEvent>,
) -> Result<String, DockerLiteError> {
    let client = docker.client()?;
    // Fail fast on unknown containers instead of handing back a stream id
    // that will never produce anything.
    client.inspect_container(&id, None).await?;

    let key = streams.next_key("logs");
    let container_id = id;
    let task_key = key.clone();
    streams.register_with(key.clone(), move || {
        tokio::spawn(async move {
            // Reconnect loop: when the bollard stream ends (e.g. container
            // restart), reconnect using since=now-equivalent (tail=0) so we
            // don't replay historical lines. The first connect always runs,
            // even for stopped containers, so history is shown.
            let mut first_run = true;
            let mut failure_streak: u32 = 0;
            'outer: loop {
                let stream_tail = if first_run { tail } else { 0 };
                first_run = false;

                let mut stream = Box::pin(crate::docker::containers::logs_stream(
                    &client,
                    &container_id,
                    stream_tail,
                ));

                let mut stream_error: Option<String> = None;
                while let Some(item) = stream.next().await {
                    match item {
                        Ok(lines) if !lines.is_empty() => {
                            failure_streak = 0;
                            if on_event.send(LogEvent::Lines { lines }).is_err() {
                                break 'outer;
                            }
                        }
                        Ok(_) => continue,
                        Err(e) => {
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }

                // Surface the first error of a streak and back off while it
                // persists, so a persistently broken stream doesn't spin.
                if let Some(message) = stream_error {
                    if failure_streak == 0 {
                        let _ = on_event.send(LogEvent::Error { message });
                    }
                    failure_streak = failure_streak.saturating_add(1);
                    tokio::time::sleep(failure_backoff(failure_streak)).await;
                }

                if !wait_until_running(&client, &container_id).await {
                    let _ = on_event.send(LogEvent::Ended);
                    break 'outer;
                }
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
    on_event: Channel<StatsEvent>,
) -> Result<String, DockerLiteError> {
    let client = docker.client()?;
    client.inspect_container(&id, None).await?;

    let key = streams.next_key("stats");
    let container_id = id;
    let task_key = key.clone();
    streams.register_with(key.clone(), move || {
        tokio::spawn(async move {
            use bollard::query_parameters::StatsOptionsBuilder;

            let mut failure_streak: u32 = 0;
            'outer: loop {
                let options = StatsOptionsBuilder::new().stream(true).build();
                let mut stream = Box::pin(client.stats(&container_id, Some(options)));

                let mut stream_error: Option<String> = None;
                while let Some(item) = stream.next().await {
                    match item {
                        Ok(stats) => {
                            if let Some(snapshot) = crate::docker::containers::compute_stats(&stats)
                            {
                                failure_streak = 0;
                                if on_event.send(StatsEvent::Snapshot { snapshot }).is_err() {
                                    break 'outer;
                                }
                            }
                        }
                        Err(e) => {
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }

                if let Some(message) = stream_error {
                    if failure_streak == 0 {
                        let _ = on_event.send(StatsEvent::Error { message });
                    }
                    failure_streak = failure_streak.saturating_add(1);
                    tokio::time::sleep(failure_backoff(failure_streak)).await;
                }

                if !wait_until_running(&client, &container_id).await {
                    let _ = on_event.send(StatsEvent::Ended);
                    break 'outer;
                }
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
