use bollard::Docker;
use serde::Serialize;
use std::collections::HashMap;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkContainer {
    pub container_id: String,
    pub name: String,
    pub ipv4_address: String,
    pub ipv6_address: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    pub internal: bool,
    pub enable_ipv6: bool,
    pub attachable: bool,
    pub ingress: bool,
    pub containers: Vec<NetworkContainer>,
    pub labels: HashMap<String, String>,
    pub options: HashMap<String, String>,
}

/// List all networks. Uses inspect_network per network to get connected
/// containers (the list endpoint does not include them).
pub async fn list_all(client: &Docker) -> Result<Vec<NetworkInfo>> {
    let networks = client.list_networks(None).await?;
    let mut result = Vec::with_capacity(networks.len());

    for n in networks {
        let id = n.id.unwrap_or_default();
        let name = n.name.unwrap_or_default();

        // Inspect each network to get attached containers
        let containers = match client.inspect_network(&id, None).await {
            Ok(inspect) => inspect
                .containers
                .unwrap_or_default()
                .into_iter()
                .map(|(cid, ep)| NetworkContainer {
                    container_id: cid,
                    name: ep.name.unwrap_or_default(),
                    ipv4_address: ep.ipv4_address.unwrap_or_default(),
                    ipv6_address: ep.ipv6_address.unwrap_or_default(),
                })
                .collect(),
            Err(_) => Vec::new(),
        };

        result.push(NetworkInfo {
            id,
            name,
            driver: n.driver.unwrap_or_default(),
            scope: n.scope.unwrap_or_default(),
            internal: n.internal.unwrap_or(false),
            enable_ipv6: n.enable_ipv6.unwrap_or(false),
            attachable: n.attachable.unwrap_or(false),
            ingress: n.ingress.unwrap_or(false),
            containers,
            labels: n.labels.unwrap_or_default(),
            options: n.options.unwrap_or_default(),
        });
    }

    Ok(result)
}

/// Remove a network by ID.
pub async fn remove(client: &Docker, id: &str) -> Result<()> {
    client.remove_network(id).await?;
    Ok(())
}
