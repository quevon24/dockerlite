use futures_util::StreamExt;
use tauri::ipc::Channel;
use tauri::State;

use crate::error::DockerLiteError;
use crate::state::{DockerState, ExecRegistry, StreamRegistry};

/// Create and start an interactive exec session (/bin/sh) inside a container.
/// Output bytes are sent through the Tauri Channel. Returns the exec ID so the
/// frontend can address write_exec_input and resize_exec_terminal to it.
#[tauri::command]
pub async fn start_exec(
    container_id: String,
    docker: State<'_, DockerState>,
    execs: State<'_, ExecRegistry>,
    streams: State<'_, StreamRegistry>,
    on_output: Channel<Vec<u8>>,
) -> Result<String, DockerLiteError> {
    let client = docker.client()?;

    // Create exec
    let config = bollard::models::ExecConfig {
        attach_stdin: Some(true),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        tty: Some(true),
        cmd: Some(vec!["/bin/sh".to_string()]),
        ..Default::default()
    };
    let exec = client.create_exec(&container_id, config).await?;
    let exec_id = exec.id;

    // Start exec (attached mode)
    let start_config = bollard::exec::StartExecOptions {
        detach: false,
        ..Default::default()
    };
    let result = client.start_exec(&exec_id, Some(start_config)).await?;

    match result {
        bollard::exec::StartExecResults::Attached { output, input } => {
            // Store the stdin writer
            execs.insert(exec_id.clone(), input);

            // Spawn output reader
            let eid = exec_id.clone();
            let handle = tokio::spawn(async move {
                futures_util::pin_mut!(output);
                while let Some(chunk) = output.next().await {
                    match chunk {
                        Ok(log_output) => {
                            let bytes = log_output.into_bytes().to_vec();
                            if !bytes.is_empty() && on_output.send(bytes).is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            });

            streams.register(format!("exec:{eid}"), handle);
        }
        bollard::exec::StartExecResults::Detached => {
            return Err(DockerLiteError::Connection(
                "Exec session started in detached mode unexpectedly".to_string(),
            ));
        }
    }

    Ok(exec_id)
}

/// Write bytes (keystrokes) to an active exec session's stdin.
#[tauri::command]
pub async fn write_exec_input(
    exec_id: String,
    data: Vec<u8>,
    execs: State<'_, ExecRegistry>,
) -> Result<(), DockerLiteError> {
    execs.write(&exec_id, &data).await
}

/// Resize the exec session's TTY to match the xterm.js terminal dimensions.
#[tauri::command]
pub async fn resize_exec_terminal(
    exec_id: String,
    cols: u16,
    rows: u16,
    docker: State<'_, DockerState>,
) -> Result<(), DockerLiteError> {
    let client = docker.client()?;
    let options = bollard::query_parameters::ResizeExecOptions {
        h: rows as i32,
        w: cols as i32,
    };
    client.resize_exec(&exec_id, options).await?;
    Ok(())
}

/// Stop an exec session: cancel its output stream and remove its input handle.
#[tauri::command]
pub async fn stop_exec(
    exec_id: String,
    streams: State<'_, StreamRegistry>,
    execs: State<'_, ExecRegistry>,
) -> Result<(), DockerLiteError> {
    streams.cancel(&format!("exec:{exec_id}"));
    execs.remove(&exec_id);
    Ok(())
}
