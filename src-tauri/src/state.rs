use bollard::Docker;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError, RwLock};
use tokio::task::JoinHandle;

use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tokio::io::AsyncWrite;

use crate::error::{validate_socket, DockerLiteError};

// Lock poisoning recovery: every critical section in this module is a plain
// map or pointer operation that cannot leave the data in an invalid state,
// so a poisoned lock is recovered with PoisonError::into_inner instead of
// permanently failing every Docker command after an unrelated panic.

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
        let guard = self.client.read().unwrap_or_else(PoisonError::into_inner);
        guard.clone().ok_or_else(|| {
            let path = self
                .socket_path
                .read()
                .unwrap_or_else(PoisonError::into_inner)
                .clone();
            DockerLiteError::Connection(format!("Not connected to Docker at {path}"))
        })
    }

    /// Get the current socket path.
    pub fn socket_path(&self) -> String {
        self.socket_path
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Reconnect to a different Docker socket. Pings the daemon before
    /// committing the swap: bollard connects lazily, so without the ping
    /// any existing socket path would "succeed" and every later command
    /// would fail instead.
    pub async fn reconnect(&self, new_path: &str) -> crate::error::Result<()> {
        validate_socket(new_path)?;
        let new_client = Docker::connect_with_socket(new_path, 120, bollard::API_DEFAULT_VERSION)
            .map_err(|e| DockerLiteError::Connection(e.to_string()))?;
        new_client
            .ping()
            .await
            .map_err(|e| DockerLiteError::Connection(format!("Docker did not respond: {e}")))?;
        *self.client.write().unwrap_or_else(PoisonError::into_inner) = Some(new_client);
        *self
            .socket_path
            .write()
            .unwrap_or_else(PoisonError::into_inner) = new_path.to_string();
        Ok(())
    }
}

/// Tracks active streaming tasks so they can be cancelled when the user
/// navigates away or the window closes. Keys are unique per stream
/// (see `next_key`), so a stop can never hit an unrelated stream.
pub struct StreamRegistry {
    tasks: Mutex<HashMap<String, JoinHandle<()>>>,
    next_id: AtomicU64,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(0),
        }
    }

    /// Produce a unique stream key with the given prefix, e.g. "logs:3".
    pub fn next_key(&self, prefix: &str) -> String {
        let n = self.next_id.fetch_add(1, Ordering::Relaxed);
        format!("{prefix}:{n}")
    }

    /// Spawn and register a task under the given key. The map lock is held
    /// across the spawn so the task's own `remove` on completion cannot run
    /// before the handle is inserted (a stream that ends instantly would
    /// otherwise leave a finished handle behind forever).
    pub fn register_with<F>(&self, key: String, spawn: F)
    where
        F: FnOnce() -> JoinHandle<()>,
    {
        let mut tasks = self.tasks.lock().unwrap_or_else(PoisonError::into_inner);
        let handle = spawn();
        if let Some(old) = tasks.insert(key, handle) {
            old.abort();
        }
    }

    /// Remove an entry without aborting. Used by stream tasks cleaning up
    /// after themselves once their stream ends naturally.
    pub fn remove(&self, key: &str) {
        self.tasks
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(key);
    }

    /// Cancel and remove the task with the given key, if any.
    pub fn cancel(&self, key: &str) {
        if let Some(handle) = self
            .tasks
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(key)
        {
            handle.abort();
        }
    }

    /// Cancel and remove every tracked task. Called when the main window is
    /// destroyed so streams don't keep daemon connections open while the app
    /// sits in the tray.
    pub fn cancel_all(&self) {
        let mut tasks = self.tasks.lock().unwrap_or_else(PoisonError::into_inner);
        for (_, handle) in tasks.drain() {
            handle.abort();
        }
    }
}

impl Default for StreamRegistry {
    fn default() -> Self {
        Self::new()
    }
}

type ExecWriter = Arc<tokio::sync::Mutex<Pin<Box<dyn AsyncWrite + Send>>>>;

/// Stores the stdin write handles for active exec sessions so the
/// `write_exec_input` command can push keystrokes into the container.
pub struct ExecRegistry {
    inputs: Mutex<HashMap<String, ExecWriter>>,
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
            .unwrap_or_else(PoisonError::into_inner)
            .insert(id, Arc::new(tokio::sync::Mutex::new(writer)));
    }

    pub fn remove(&self, id: &str) {
        self.inputs
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(id);
    }

    /// Drop every stored stdin handle. Called when the main window is
    /// destroyed so abandoned sessions don't pin daemon connections.
    pub fn clear(&self) {
        self.inputs
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clear();
    }

    /// Write bytes to the exec session's stdin. The handle stays in the map;
    /// concurrent writes queue on the per-session async mutex, and removal is
    /// final (an in-flight write cannot resurrect a stopped session).
    pub async fn write(&self, id: &str, data: &[u8]) -> crate::error::Result<()> {
        use tokio::io::AsyncWriteExt;

        let writer = {
            let inputs = self.inputs.lock().unwrap_or_else(PoisonError::into_inner);
            inputs.get(id).cloned()
        }
        .ok_or_else(|| DockerLiteError::Connection(format!("Exec session {id} not found")))?;
        let mut writer = writer.lock().await;
        writer.write_all(data).await.map_err(DockerLiteError::Io)
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
