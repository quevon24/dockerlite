use futures_util::StreamExt;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{Manager, State};

use crate::error::DockerLiteError;
use crate::state::{DockerState, ExecRegistry, StreamRegistry};

/// Create and start an interactive exec session (/bin/sh) inside a container.
/// Output is sent through the Tauri Channel as raw bytes (an ArrayBuffer on
/// the JS side, avoiding JSON number-array serialization); an empty payload
/// signals that the session ended. Returns the exec ID so the frontend can
/// address write_exec_input and resize_exec_terminal to it.
#[tauri::command]
pub async fn start_exec(
    container_id: String,
    app: tauri::AppHandle,
    docker: State<'_, DockerState>,
    execs: State<'_, ExecRegistry>,
    streams: State<'_, StreamRegistry>,
    on_output: Channel<InvokeResponseBody>,
) -> Result<String, DockerLiteError> {
    let client = docker.client()?;

    // Create exec
    let config = bollard::models::ExecConfig {
        attach_stdin: Some(true),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        tty: Some(true),
        env: Some(vec!["TERM=xterm-256color".to_string()]),
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
            let key = format!("exec:{eid}");
            let task_key = key.clone();
            streams.register_with(key, move || {
                tokio::spawn(async move {
                    futures_util::pin_mut!(output);
                    while let Some(chunk) = output.next().await {
                        match chunk {
                            Ok(log_output) => {
                                let bytes = log_output.into_bytes().to_vec();
                                if !bytes.is_empty()
                                    && on_output.send(InvokeResponseBody::Raw(bytes)).is_err()
                                {
                                    break;
                                }
                            }
                            Err(_) => break,
                        }
                    }
                    // The shell exited or the stream broke: release the stdin
                    // handle and registry entry, and tell the frontend the
                    // session is over (empty payload is the EOF sentinel).
                    let _ = on_output.send(InvokeResponseBody::Raw(Vec::new()));
                    app.state::<ExecRegistry>().remove(&eid);
                    app.state::<StreamRegistry>().remove(&task_key);
                })
            });
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
