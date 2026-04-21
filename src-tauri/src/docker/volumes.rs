use bollard::Docker;
use bollard::query_parameters::ListVolumesOptions;
use serde::Serialize;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub created_at: Option<String>,
    pub size: i64,
    pub ref_count: i64,
    pub labels: std::collections::HashMap<String, String>,
}

/// List all volumes.
pub async fn list_all(client: &Docker) -> Result<Vec<VolumeInfo>> {
    let response = client.list_volumes(None::<ListVolumesOptions>).await?;
    let volumes = response.volumes.unwrap_or_default();

    let result = volumes
        .into_iter()
        .map(|v| {
            let (size, ref_count) = v
                .usage_data
                .map(|u| (u.size, u.ref_count))
                .unwrap_or((-1, -1));
            VolumeInfo {
                name: v.name,
                driver: v.driver,
                mountpoint: v.mountpoint,
                created_at: v.created_at.map(|d| d.to_string()),
                size,
                ref_count,
                labels: v.labels,
            }
        })
        .collect();

    Ok(result)
}

/// Remove a volume by name.
pub async fn remove(client: &Docker, name: &str) -> Result<()> {
    client
        .remove_volume(name, None::<bollard::query_parameters::RemoveVolumeOptions>)
        .await?;
    Ok(())
}
