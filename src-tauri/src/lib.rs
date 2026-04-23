mod commands;
mod docker;
mod error;
mod state;

use state::{DockerState, ExecRegistry, MinimizeToTrayFlag, StreamRegistry};
use tauri::{
    image::Image,
    Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

/// Restore a hidden window with a short delay so the window manager
/// processes the show before we attempt to set focus. Without this,
/// GNOME/Wayland leaves the title bar unresponsive after restore.
fn restore_window(handle: &tauri::AppHandle) {
    let handle = handle.clone();
    std::thread::spawn(move || {
        if let Some(win) = handle.get_webview_window("main") {
            let _ = win.show();
            let _ = win.unminimize();
            std::thread::sleep(std::time::Duration::from_millis(50));
            let _ = win.set_focus();
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let docker_state = DockerState::new("/var/run/docker.sock");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(docker_state)
        .manage(StreamRegistry::new())
        .manage(ExecRegistry::new())
        .manage(MinimizeToTrayFlag::new())
        .setup(|app| {
            // Build tray menu
            let open = MenuItem::with_id(app, "open", "Open DockerLite", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            // Use a dedicated tray icon sized for system trays
            let tray_icon = Image::from_path("icons/tray-icon.png")
                .or_else(|_| Image::from_path("src-tauri/icons/tray-icon.png"))
                .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

            TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("DockerLite")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => restore_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        restore_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Intercept close: hide to tray if the setting is enabled
            if let Some(win) = app.get_webview_window("main") {
                let handle = app.app_handle().clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let flag = handle.state::<MinimizeToTrayFlag>();
                        if flag.get() {
                            api.prevent_close();
                            if let Some(w) = handle.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::system::get_disk_usage,
            commands::system::set_minimize_to_tray,
            commands::system::reconnect_docker,
            commands::system::prune_containers,
            commands::system::prune_images,
            commands::system::prune_volumes,
            commands::system::prune_networks,
            commands::system::prune_build_cache,
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
            commands::images::list_images,
            commands::images::remove_image,
            commands::volumes::list_volumes,
            commands::volumes::remove_volume,
            commands::networks::list_networks,
            commands::networks::remove_network,
            commands::exec::start_exec,
            commands::exec::write_exec_input,
            commands::exec::resize_exec_terminal,
            commands::exec::stop_exec,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
