use bollard::Docker;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError, RwLock};
use std::time::Duration;
use tokio::task::JoinHandle;

use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tokio::io::AsyncWrite;

use crate::error::{validate_socket, DockerLiteError};

// Lock poisoning recovery: every critical section in this module is a plain
// map or pointer operation that cannot leave the data in an invalid state,
// so a poisoned lock is recovered with PoisonError::into_inner instead of
// permanently failing every Docker command after an unrelated panic.

/// HTTP timeout for bollard clients, in seconds. Applies up to response
/// headers, so it does not limit long-lived log/stats/exec streams.
const DOCKER_TIMEOUT_SECS: u64 = 120;

/// How long a single exec stdin write may take before the session is
/// considered wedged.
const EXEC_WRITE_TIMEOUT: Duration = Duration::from_secs(5);

struct Connection {
    client: Option<Docker>,
    socket_path: String,
}

/// Holds the Docker client and connection metadata. Client and path live
/// under a single lock so they can only ever be swapped together.
pub struct DockerState {
    conn: RwLock<Connection>,
}

impl DockerState {
    /// Create a new DockerState, attempting to connect to the given socket.
    /// If the socket is invalid the app still starts (client will be None
    /// and `client()` reports the specific problem).
    pub fn new(socket_path: &str) -> Self {
        Self {
            conn: RwLock::new(Connection {
                client: Self::try_connect(socket_path),
                socket_path: socket_path.to_string(),
            }),
        }
    }

    /// Build a client only when the socket passes validation: bollard
    /// connects lazily, so an unconditional connect would "succeed" against
    /// a missing socket and surface raw transport errors later instead of
    /// the actionable SocketNotFound/SocketPermission messages.
    fn try_connect(socket_path: &str) -> Option<Docker> {
        validate_socket(socket_path).ok()?;
        Docker::connect_with_socket(
            socket_path,
            DOCKER_TIMEOUT_SECS,
            bollard::API_DEFAULT_VERSION,
        )
        .ok()
    }

    /// Get a clone of the Docker client. When not connected, retry the
    /// connection (Docker may have started since app launch); if the socket
    /// is still invalid, return the specific validation error.
    pub fn client(&self) -> crate::error::Result<Docker> {
        let path = {
            let conn = self.conn.read().unwrap_or_else(PoisonError::into_inner);
            match &conn.client {
                Some(client) => return Ok(client.clone()),
                None => conn.socket_path.clone(),
            }
        };

        validate_socket(&path)?;
        let client =
            Docker::connect_with_socket(&path, DOCKER_TIMEOUT_SECS, bollard::API_DEFAULT_VERSION)
                .map_err(|e| DockerLiteError::Connection(e.to_string()))?;
        let mut conn = self.conn.write().unwrap_or_else(PoisonError::into_inner);
        conn.client = Some(client.clone());
        Ok(client)
    }

    /// Get the current socket path.
    pub fn socket_path(&self) -> String {
        self.conn
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .socket_path
            .clone()
    }

    /// Reconnect to a different Docker socket. Pings the daemon before
    /// committing the swap: bollard connects lazily, so without the ping
    /// any existing socket path would "succeed" and every later command
    /// would fail instead. Client and path are swapped under one write
    /// guard so concurrent reconnects cannot leave them crossed.
    pub async fn reconnect(&self, new_path: &str) -> crate::error::Result<()> {
        validate_socket(new_path)?;
        let new_client = Docker::connect_with_socket(
            new_path,
            DOCKER_TIMEOUT_SECS,
            bollard::API_DEFAULT_VERSION,
        )
        .map_err(|e| DockerLiteError::Connection(e.to_string()))?;
        new_client
            .ping()
            .await
            .map_err(|e| DockerLiteError::Connection(format!("Docker did not respond: {e}")))?;
        let mut conn = self.conn.write().unwrap_or_else(PoisonError::into_inner);
        conn.client = Some(new_client);
        conn.socket_path = new_path.to_string();
        Ok(())
    }
}

/// Tracks active streaming tasks so they can be cancelled when the user
/// navigates away or the window closes. Keys are unique per stream
/// (see `next_key`), so a stop can never hit an unrelated stream.
pub struct StreamRegistry {
    tasks: Mutex<HashMap<String, JoinHandle<()>>>,
    next_id: AtomicU64,
    closed: AtomicBool,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(0),
            closed: AtomicBool::new(false),
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
    /// otherwise leave a finished handle behind forever). If the registry
    /// was closed (window destroyed while the command was mid-flight), the
    /// task is aborted immediately instead of tracked.
    pub fn register_with<F>(&self, key: String, spawn: F)
    where
        F: FnOnce() -> JoinHandle<()>,
    {
        let mut tasks = self.tasks.lock().unwrap_or_else(PoisonError::into_inner);
        let handle = spawn();
        if self.closed.load(Ordering::Relaxed) {
            handle.abort();
            return;
        }
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

    /// Cancel every tracked task and refuse new registrations until
    /// `reopen`. Called when the main window is destroyed so streams don't
    /// keep daemon connections open while the app sits in the tray.
    pub fn cancel_all(&self) {
        self.closed.store(true, Ordering::Relaxed);
        let mut tasks = self.tasks.lock().unwrap_or_else(PoisonError::into_inner);
        for (_, handle) in tasks.drain() {
            handle.abort();
        }
    }

    /// Accept registrations again. Called when the main window is recreated.
    pub fn reopen(&self) {
        self.closed.store(false, Ordering::Relaxed);
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
    closed: AtomicBool,
}

impl ExecRegistry {
    pub fn new() -> Self {
        Self {
            inputs: Mutex::new(HashMap::new()),
            closed: AtomicBool::new(false),
        }
    }

    pub fn insert(&self, id: String, writer: Pin<Box<dyn AsyncWrite + Send>>) {
        let mut inputs = self.inputs.lock().unwrap_or_else(PoisonError::into_inner);
        // Window destroyed while start_exec was mid-flight: drop the handle
        // instead of tracking a session nobody can use.
        if self.closed.load(Ordering::Relaxed) {
            return;
        }
        inputs.insert(id, Arc::new(tokio::sync::Mutex::new(writer)));
    }

    pub fn remove(&self, id: &str) {
        self.inputs
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(id);
    }

    /// Drop every stored stdin handle and refuse new ones until `reopen`.
    /// Called when the main window is destroyed so abandoned sessions don't
    /// pin daemon connections.
    pub fn clear(&self) {
        self.closed.store(true, Ordering::Relaxed);
        self.inputs
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clear();
    }

    /// Accept new sessions again. Called when the main window is recreated.
    pub fn reopen(&self) {
        self.closed.store(false, Ordering::Relaxed);
    }

    /// Write bytes to the exec session's stdin. The handle stays in the map;
    /// concurrent writes queue on the per-session async mutex, and removal is
    /// final (an in-flight write cannot resurrect a stopped session). The
    /// write is bounded so a wedged session cannot queue keystrokes forever.
    pub async fn write(&self, id: &str, data: &[u8]) -> crate::error::Result<()> {
        use tokio::io::AsyncWriteExt;

        let writer = {
            let inputs = self.inputs.lock().unwrap_or_else(PoisonError::into_inner);
            inputs.get(id).cloned()
        }
        .ok_or_else(|| DockerLiteError::Connection(format!("Exec session {id} not found")))?;
        let mut writer = writer.lock().await;
        tokio::time::timeout(EXEC_WRITE_TIMEOUT, async {
            writer.write_all(data).await?;
            writer.flush().await
        })
        .await
        .map_err(|_| {
            DockerLiteError::Connection(format!("Exec session {id} is not accepting input"))
        })?
        .map_err(DockerLiteError::Io)
    }
}

impl Default for ExecRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Global flag checked by the `RunEvent::ExitRequested` handler to decide
/// whether to keep the app alive in the tray after the last window closes.
pub struct MinimizeToTrayFlag(AtomicBool);

impl MinimizeToTrayFlag {
    pub fn new() -> Self {
        Self(AtomicBool::new(false))
    }

    pub fn get(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }

    pub fn set(&self, value: bool) {
        self.0.store(value, Ordering::Relaxed)
    }
}

impl Default for MinimizeToTrayFlag {
    fn default() -> Self {
        Self::new()
    }
}
