use bollard::container::LogOutput;
use bollard::query_parameters::{
    ListContainersOptionsBuilder, LogsOptionsBuilder, RemoveContainerOptionsBuilder,
    StopContainerOptions,
};
use bollard::Docker;
use futures_util::Stream;
use serde::Serialize;
use std::collections::HashMap;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortMapping {
    pub ip: Option<String>,
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub protocol: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub image_id: String,
    pub command: String,
    pub created: i64,
    pub state: String,
    pub status: String,
    pub ports: Vec<PortMapping>,
    pub labels: HashMap<String, String>,
    pub compose_project: Option<String>,
    pub compose_service: Option<String>,
}

const COMPOSE_PROJECT_LABEL: &str = "com.docker.compose.project";
const COMPOSE_SERVICE_LABEL: &str = "com.docker.compose.service";

fn strip_name_prefix(name: &str) -> String {
    name.strip_prefix('/').unwrap_or(name).to_string()
}

/// List all containers (running + stopped).
pub async fn list_all(client: &Docker) -> Result<Vec<ContainerInfo>> {
    let options = ListContainersOptionsBuilder::new().all(true).build();
    let containers = client.list_containers(Some(options)).await?;

    let mut result = Vec::with_capacity(containers.len());
    for c in containers {
        let labels = c.labels.unwrap_or_default();
        let compose_project = labels.get(COMPOSE_PROJECT_LABEL).cloned();
        let compose_service = labels.get(COMPOSE_SERVICE_LABEL).cloned();

        let name = c
            .names
            .and_then(|names| names.into_iter().next())
            .map(|n| strip_name_prefix(&n))
            .unwrap_or_default();

        let ports = c
            .ports
            .unwrap_or_default()
            .into_iter()
            .map(|p| PortMapping {
                ip: p.ip,
                private_port: p.private_port,
                public_port: p.public_port,
                protocol: p
                    .typ
                    .map(|t| t.to_string())
                    .unwrap_or_else(|| "tcp".to_string()),
            })
            .collect();

        result.push(ContainerInfo {
            id: c.id.unwrap_or_default(),
            name,
            image: c.image.unwrap_or_default(),
            image_id: c.image_id.unwrap_or_default(),
            command: c.command.unwrap_or_default(),
            created: c.created.unwrap_or(0),
            state: c.state.map(|s| s.to_string()).unwrap_or_default(),
            status: c.status.unwrap_or_default(),
            ports,
            labels,
            compose_project,
            compose_service,
        });
    }

    Ok(result)
}

/// Inspect a container and return the raw JSON value.
pub async fn inspect(client: &Docker, id: &str) -> Result<serde_json::Value> {
    let inspect = client.inspect_container(id, None).await?;
    Ok(serde_json::to_value(inspect)?)
}

pub async fn start(client: &Docker, id: &str) -> Result<()> {
    client.start_container(id, None).await?;
    Ok(())
}

pub async fn stop(client: &Docker, id: &str) -> Result<()> {
    client
        .stop_container(id, None::<StopContainerOptions>)
        .await?;
    Ok(())
}

pub async fn restart(client: &Docker, id: &str) -> Result<()> {
    client.restart_container(id, None).await?;
    Ok(())
}

pub async fn pause(client: &Docker, id: &str) -> Result<()> {
    client.pause_container(id).await?;
    Ok(())
}

pub async fn unpause(client: &Docker, id: &str) -> Result<()> {
    client.unpause_container(id).await?;
    Ok(())
}

pub async fn remove(client: &Docker, id: &str, force: bool) -> Result<()> {
    let options = RemoveContainerOptionsBuilder::new()
        .force(force)
        .v(true)
        .build();
    client.remove_container(id, Some(options)).await?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub stream: String,
    pub timestamp: Option<String>,
    pub text: String,
}

/// Parse the leading Docker timestamp prefix that appears when timestamps:true.
/// Format: "2024-01-15T14:32:01.123456789Z actual log text"
fn parse_log_line(raw: &str) -> (Option<String>, String) {
    if let Some((maybe_ts, rest)) = raw.split_once(' ') {
        if maybe_ts.len() >= 20
            && maybe_ts.contains('T')
            && (maybe_ts.ends_with('Z') || maybe_ts.contains('.'))
        {
            return (Some(maybe_ts.to_string()), rest.to_string());
        }
    }
    (None, raw.to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsSnapshot {
    pub cpu_percent: f64,
    pub memory_used: u64,
    pub memory_limit: u64,
    pub memory_percent: f64,
    pub network_rx: u64,
    pub network_tx: u64,
    pub timestamp: i64,
}

/// Compute a StatsSnapshot from a single Docker stats response.
/// Returns None if the stats don't contain enough data for computation.
pub fn compute_stats(stats: &bollard::models::ContainerStatsResponse) -> Option<StatsSnapshot> {
    let cpu = stats.cpu_stats.as_ref()?;
    let precpu = stats.precpu_stats.as_ref()?;
    let cpu_usage = cpu.cpu_usage.as_ref()?;
    let precpu_usage = precpu.cpu_usage.as_ref()?;

    let cpu_delta = cpu_usage
        .total_usage?
        .saturating_sub(precpu_usage.total_usage?);
    let system_delta = cpu
        .system_cpu_usage?
        .saturating_sub(precpu.system_cpu_usage?);
    let num_cpus = cpu.online_cpus.unwrap_or(1) as f64;

    let cpu_percent = if system_delta > 0 {
        (cpu_delta as f64 / system_delta as f64) * num_cpus * 100.0
    } else {
        0.0
    };

    let mem = stats.memory_stats.as_ref()?;
    let memory_used = mem.usage.unwrap_or(0);
    let memory_limit = mem.limit.unwrap_or(0);
    let memory_percent = if memory_limit > 0 {
        (memory_used as f64 / memory_limit as f64) * 100.0
    } else {
        0.0
    };

    let (network_rx, network_tx) = stats
        .networks
        .as_ref()
        .map(|nets| {
            nets.values().fold((0u64, 0u64), |(rx, tx), n| {
                (rx + n.rx_bytes.unwrap_or(0), tx + n.tx_bytes.unwrap_or(0))
            })
        })
        .unwrap_or((0, 0));

    let timestamp = chrono::Utc::now().timestamp();

    Some(StatsSnapshot {
        cpu_percent,
        memory_used,
        memory_limit,
        memory_percent,
        network_rx,
        network_tx,
        timestamp,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use bollard::Docker;

    fn client() -> Docker {
        Docker::connect_with_unix_defaults().unwrap()
    }

    #[tokio::test]
    async fn list_all_returns_ok() {
        let result = list_all(&client()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn container_lifecycle() {
        let client = client();
        let name = "dockerlite-test-lifecycle";

        // Pre-cleanup from any previous failed run
        let _ = remove(&client, name, true).await;

        let config = bollard::models::ContainerCreateBody {
            image: Some("alpine:latest".to_string()),
            cmd: Some(vec!["sleep".to_string(), "30".to_string()]),
            ..Default::default()
        };
        let options = bollard::query_parameters::CreateContainerOptions {
            name: Some(name.to_string()),
            ..Default::default()
        };

        let created = client.create_container(Some(options), config).await;
        if created.is_err() {
            // Alpine not pulled locally — skip rather than fail
            return;
        }
        let id = created.unwrap().id;

        // Appears in list
        let list = list_all(&client).await.unwrap();
        assert!(
            list.iter().any(|c| c.id == id),
            "created container not found in list"
        );

        // Start
        start(&client, &id).await.unwrap();
        let list = list_all(&client).await.unwrap();
        assert_eq!(list.iter().find(|c| c.id == id).unwrap().state, "running");

        // Stop
        stop(&client, &id).await.unwrap();

        // Cleanup
        remove(&client, &id, false).await.unwrap();

        // No longer in list
        let list = list_all(&client).await.unwrap();
        assert!(!list.iter().any(|c| c.id == id));
    }
}

/// Build a stream of follow-mode container logs with timestamps enabled.
/// Each chunk is split on newlines and emitted as a LogLine.
pub fn logs_stream(
    client: &Docker,
    id: &str,
    tail: u32,
) -> impl Stream<Item = Result<Vec<LogLine>>> {
    let options = LogsOptionsBuilder::new()
        .follow(true)
        .stdout(true)
        .stderr(true)
        .timestamps(true)
        .tail(&tail.to_string())
        .build();

    let inner = client.logs(id, Some(options));
    futures_util::StreamExt::map(inner, |item| {
        item.map(|out| {
            let stream_name = match &out {
                LogOutput::StdErr { .. } => "stderr",
                _ => "stdout",
            };
            let text = String::from_utf8_lossy(out.as_ref()).to_string();
            text.split_inclusive('\n')
                .map(|line| {
                    let trimmed = line.trim_end_matches('\n').trim_end_matches('\r');
                    let (ts, body) = parse_log_line(trimmed);
                    LogLine {
                        stream: stream_name.to_string(),
                        timestamp: ts,
                        text: body,
                    }
                })
                .filter(|l| !l.text.is_empty() || l.timestamp.is_some())
                .collect()
        })
        .map_err(crate::error::DockerLiteError::from)
    })
}
