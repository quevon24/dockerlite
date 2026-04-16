use bollard::Docker;
use bollard::query_parameters::{
    ListContainersOptionsBuilder, RemoveContainerOptionsBuilder, StopContainerOptions,
};
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
