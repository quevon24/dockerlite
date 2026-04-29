use bollard::Docker;
use std::collections::HashMap;
use std::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;

use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::AsyncWrite;

use crate::error::{validate_socket, DockerLiteError};

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

    /// Get the current socket path.
    pub fn socket_path(&self) -> String {
        self.socket_path
            .read()
            .expect("socket_path lock poisoned")
            .clone()
    }

    /// Reconnect to a different Docker socket.
    pub fn reconnect(&self, new_path: &str) -> crate::error::Result<()> {
        validate_socket(new_path)?;
        let new_client = Docker::connect_with_socket(new_path, 120, bollard::API_DEFAULT_VERSION)
            .map_err(|e| DockerLiteError::Connection(e.to_string()))?;
        *self.client.write().expect("DockerState lock poisoned") = Some(new_client);
        *self.socket_path.write().expect("socket_path lock poisoned") = new_path.to_string();
        Ok(())
    }
}

/// Tracks active streaming tasks so they can be cancelled when the user
/// navigates away or starts a new stream for the same resource.
pub struct StreamRegistry {
    tasks: Mutex<HashMap<String, JoinHandle<()>>>,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
        }
    }

    /// Register a task under the given key, cancelling any prior task with
    /// the same key.
    pub fn register(&self, key: String, handle: JoinHandle<()>) {
        let mut tasks = self.tasks.lock().expect("StreamRegistry poisoned");
        if let Some(old) = tasks.insert(key, handle) {
            old.abort();
        }
    }

    /// Cancel and remove the task with the given key, if any.
    pub fn cancel(&self, key: &str) {
        if let Some(handle) = self
            .tasks
            .lock()
            .expect("StreamRegistry poisoned")
            .remove(key)
        {
            handle.abort();
        }
    }
}

impl Default for StreamRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Stores the stdin write handles for active exec sessions so the
/// `write_exec_input` command can push keystrokes into the container.
pub struct ExecRegistry {
    inputs: Mutex<HashMap<String, Pin<Box<dyn AsyncWrite + Send>>>>,
}

impl ExecRegistry {
    pub fn new() -> Self {
        Self {
            inputs: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert(&self, id: String, writer: Pin<Box<dyn AsyncWrite + Send>>) {
        self.inputs
            .lock()
            .expect("ExecRegistry poisoned")
            .insert(id, writer);
    }

    pub fn remove(&self, id: &str) -> Option<Pin<Box<dyn AsyncWrite + Send>>> {
        self.inputs
            .lock()
            .expect("ExecRegistry poisoned")
            .remove(id)
    }

    /// Write bytes to the exec session's stdin.
    pub async fn write(&self, id: &str, data: &[u8]) -> crate::error::Result<()> {
        use tokio::io::AsyncWriteExt;

        // Take the writer out, write, put it back (avoids holding Mutex across await).
        let mut writer = self
            .remove(id)
            .ok_or_else(|| DockerLiteError::Connection(format!("Exec session {id} not found")))?;
        let result = writer.write_all(data).await;
        self.insert(id.to_string(), writer);
        result.map_err(DockerLiteError::Io)
    }
}

impl Default for ExecRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Global flag checked by the close_requested handler to decide
/// whether to hide the window or quit the app.
pub struct MinimizeToTrayFlag(AtomicBool);

impl MinimizeToTrayFlag {
    pub fn new() -> Self {
        Self(AtomicBool::new(false))
    }

    pub fn get(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }

    pub fn set(&self, value: bool) {
        self.0.store(value, Ordering::Relaxed);
    }
}

impl Default for MinimizeToTrayFlag {
    fn default() -> Self {
        Self::new()
    }
}
