mod commands;
mod docker;
mod error;
mod state;

use state::{DockerState, StreamRegistry};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let docker_state = DockerState::new("/var/run/docker.sock");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(docker_state)
        .manage(StreamRegistry::new())
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::system::get_disk_usage,
            commands::containers::list_containers,
            commands::containers::inspect_container,
            commands::containers::start_container,
            commands::containers::stop_container,
            commands::containers::restart_container,
            commands::containers::pause_container,
            commands::containers::unpause_container,
            commands::containers::remove_container,
            commands::containers::stream_container_logs,
            commands::containers::stop_log_stream,
            commands::containers::stream_container_stats,
            commands::containers::stop_stats_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
