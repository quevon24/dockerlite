use bollard::Docker;
use futures_util::StreamExt;
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
/// containers (the list endpoint does not include them); inspects run
/// concurrently with bounded parallelism so compose-heavy hosts don't pay
/// one round-trip per network.
pub async fn list_all(client: &Docker) -> Result<Vec<NetworkInfo>> {
    let networks = client.list_networks(None).await?;

    let result = futures_util::stream::iter(networks)
        .map(|n| async move {
            let id = n.id.unwrap_or_default();
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

            NetworkInfo {
                id,
                name: n.name.unwrap_or_default(),
                driver: n.driver.unwrap_or_default(),
                scope: n.scope.unwrap_or_default(),
                internal: n.internal.unwrap_or(false),
                enable_ipv6: n.enable_ipv6.unwrap_or(false),
                attachable: n.attachable.unwrap_or(false),
                ingress: n.ingress.unwrap_or(false),
                containers,
                labels: n.labels.unwrap_or_default(),
                options: n.options.unwrap_or_default(),
            }
        })
        .buffered(8)
        .collect::<Vec<_>>()
        .await;

    Ok(result)
}

/// Remove a network by ID.
pub async fn remove(client: &Docker, id: &str) -> Result<()> {
    client.remove_network(id).await?;
    Ok(())
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
    async fn default_networks_present() {
        let list = list_all(&client()).await.unwrap();
        let names: Vec<&str> = list.iter().map(|n| n.name.as_str()).collect();
        for expected in ["bridge", "host", "none"] {
            assert!(
                names.contains(&expected),
                "expected network '{}' not found",
                expected
            );
        }
    }
}
