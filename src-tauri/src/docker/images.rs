use bollard::query_parameters::{ListImagesOptionsBuilder, RemoveImageOptionsBuilder};
use bollard::Docker;
use serde::Serialize;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    pub id: String,
    pub short_id: String,
    pub repo_tags: Vec<String>,
    pub repo_digests: Vec<String>,
    pub created: i64,
    pub size: i64,
    pub shared_size: i64,
    pub dangling: bool,
}

/// List all local images.
pub async fn list_all(client: &Docker) -> Result<Vec<ImageInfo>> {
    let options = ListImagesOptionsBuilder::new().all(true).build();
    let images = client.list_images(Some(options)).await?;

    let result = images
        .into_iter()
        .map(|img| {
            let dangling =
                img.repo_tags.is_empty() || img.repo_tags.iter().all(|t| t == "<none>:<none>");
            let short_id = img
                .id
                .strip_prefix("sha256:")
                .unwrap_or(&img.id)
                .chars()
                .take(12)
                .collect();
            ImageInfo {
                id: img.id,
                short_id,
                repo_tags: img.repo_tags,
                repo_digests: img.repo_digests,
                created: img.created,
                size: img.size,
                shared_size: img.shared_size,
                dangling,
            }
        })
        .collect();

    Ok(result)
}

/// Remove an image by name or ID.
pub async fn remove(client: &Docker, id: &str, force: bool) -> Result<()> {
    let options = RemoveImageOptionsBuilder::new().force(force).build();
    client.remove_image(id, Some(options), None).await?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageLayer {
    pub id: String,
    pub created: i64,
    pub created_by: String,
    pub tags: Vec<String>,
    pub size: i64,
    pub comment: String,
}

/// Return the layer history of an image.
pub async fn get_layers(client: &Docker, id: &str) -> Result<Vec<ImageLayer>> {
    let history = client.image_history(id).await?;
    let layers = history
        .into_iter()
        .map(|h| ImageLayer {
            id: h.id,
            created: h.created,
            created_by: h.created_by,
            tags: h.tags,
            size: h.size,
            comment: h.comment,
        })
        .collect();
    Ok(layers)
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
    async fn get_layers_for_existing_image() {
        let client = client();
        let images = list_all(&client).await.unwrap();
        // Skip if no images are available locally
        let Some(img) = images.first() else { return };
        let result = get_layers(&client, &img.id).await;
        assert!(result.is_ok());
        assert!(!result.unwrap().is_empty());
    }
}
