use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum DockerLiteError {
    #[error("Docker connection failed: {0}")]
    Connection(String),

    #[error(
        "Docker socket not found at {path}. Ensure Docker is running: sudo systemctl start docker"
    )]
    SocketNotFound { path: String },

    #[error(
        "Permission denied for Docker socket at {path}. Run: sudo usermod -aG docker $USER (then log out and back in)"
    )]
    SocketPermission { path: String },

    #[error("Docker API error: {0}")]
    DockerApi(#[from] bollard::errors::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for DockerLiteError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Validate that a Docker socket exists and is accessible.
pub fn validate_socket(path: &str) -> Result<()> {
    match std::fs::metadata(path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Err(DockerLiteError::SocketNotFound {
                path: path.to_string(),
            })
        }
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            Err(DockerLiteError::SocketPermission {
                path: path.to_string(),
            })
        }
        Err(e) => Err(DockerLiteError::Io(e)),
    }
}

pub type Result<T> = std::result::Result<T, DockerLiteError>;
