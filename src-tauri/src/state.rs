use bollard::Docker;
use std::sync::RwLock;

use crate::error::{DockerLiteError, validate_socket};

/// Holds the Docker client and connection metadata.
/// Uses std::sync::RwLock so the lock is held only briefly (to clone the client).
pub struct DockerState {
    client: RwLock<Option<Docker>>,
    socket_path: RwLock<String>,
}

impl DockerState {
    /// Create a new DockerState, attempting to connect to the given socket.
    /// If connection fails, the app still starts (client will be None).
    pub fn new(socket_path: &str) -> Self {
        let client = Self::try_connect(socket_path);
        Self {
            client: RwLock::new(client),
            socket_path: RwLock::new(socket_path.to_string()),
        }
    }

    fn try_connect(socket_path: &str) -> Option<Docker> {
        Docker::connect_with_socket(socket_path, 120, bollard::API_DEFAULT_VERSION).ok()
    }

    /// Get a clone of the Docker client, or an error if not connected.
    pub fn client(&self) -> crate::error::Result<Docker> {
        let guard = self.client.read().expect("DockerState lock poisoned");
        guard.clone().ok_or_else(|| {
            let path = self
                .socket_path
                .read()
                .expect("socket_path lock poisoned")
                .clone();
            DockerLiteError::Connection(format!("Not connected to Docker at {path}"))
        })
    }

    /// Reconnect to a different Docker socket.
    pub fn reconnect(&self, new_path: &str) -> crate::error::Result<()> {
        validate_socket(new_path)?;
        let new_client =
            Docker::connect_with_socket(new_path, 120, bollard::API_DEFAULT_VERSION)
                .map_err(|e| DockerLiteError::Connection(e.to_string()))?;
        *self.client.write().expect("DockerState lock poisoned") = Some(new_client);
        *self.socket_path.write().expect("socket_path lock poisoned") = new_path.to_string();
        Ok(())
    }
}
