mod commands;
mod docker;
mod error;
mod state;

use state::{DockerState, ExecRegistry, MinimizeToTrayFlag, StreamRegistry};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

// Default window geometry. Keep in sync with the main window entry in
// tauri.conf.json, which controls the size at first launch.
const WINDOW_SIZE: (f64, f64) = (1280.0, 800.0);
const WINDOW_MIN_SIZE: (f64, f64) = (900.0, 600.0);

/// Restore or recreate the main window at the default size.
/// On Wayland, compositors ignore app-requested positions and their
/// CSD handling makes geometry save/restore unreliable, so we always
/// use the default dimensions and let the compositor place the window.
fn restore_window(handle: &tauri::AppHandle) {
    if let Some(win) = handle.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    let builder = tauri::WebviewWindowBuilder::new(
        handle,
        "main",
        tauri::WebviewUrl::App(Default::default()),
    )
    .title("DockerLite")
    .inner_size(WINDOW_SIZE.0, WINDOW_SIZE.1)
    .min_inner_size(WINDOW_MIN_SIZE.0, WINDOW_MIN_SIZE.1)
    .resizable(true)
    .decorations(true);

    if builder.build().is_ok() {
        // The destroy handler closed the registries; accept streams again
        // for the fresh webview.
        handle.state::<StreamRegistry>().reopen();
        handle.state::<ExecRegistry>().reopen();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let docker_state = DockerState::new("/var/run/docker.sock");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(docker_state)
        .manage(StreamRegistry::new())
        .manage(ExecRegistry::new())
        .manage(MinimizeToTrayFlag::new())
        .setup(|app| {
            // Create the settings store Rust-side. The webview is only
            // granted store:allow-get-store (a handle to an existing store),
            // not allow-load, so it cannot create stores at arbitrary paths.
            {
                use tauri_plugin_store::StoreExt;
                app.store("settings.json")?;
            }

            // Build tray menu
            let open = MenuItem::with_id(app, "open", "Open DockerLite", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("DockerLite")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => restore_window(app),
                    "quit" => {
                        // Clear the flag so ExitRequested handler lets us exit
                        app.state::<MinimizeToTrayFlag>().set(false);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        restore_window(tray.app_handle());
                    }
                });

            // Tray icon: embedded at compile time, tight box without
            // background. Fall back to the window icon, and build without
            // an icon rather than abort startup if both are unavailable.
            if let Some(icon) = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
                .ok()
                .or_else(|| app.default_window_icon().cloned())
            {
                tray = tray.icon(icon);
            }
            tray.build(app)?;

            // No close_requested handler needed. The window simply closes
            // and RunEvent::ExitRequested keeps the app alive when the
            // minimize-to-tray flag is set.

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
            commands::containers::stream_container_stats,
            commands::containers::stop_stream,
            commands::images::list_images,
            commands::images::remove_image,
            commands::images::get_image_layers,
            commands::volumes::list_volumes,
            commands::volumes::remove_volume,
            commands::networks::list_networks,
            commands::networks::remove_network,
            commands::exec::start_exec,
            commands::exec::write_exec_input,
            commands::exec::resize_exec_terminal,
            commands::exec::stop_exec,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match &event {
                // When minimize-to-tray is enabled, keep the app alive even
                // after the last window closes. The tray icon stays active.
                tauri::RunEvent::ExitRequested { api, .. } => {
                    let flag = app_handle.state::<MinimizeToTrayFlag>();
                    if flag.get() {
                        api.prevent_exit();
                    }
                }
                // The webview is gone, so nothing can consume or stop the
                // active log/stats/exec streams; cancel them all so they
                // don't hold daemon connections while the app sits in the
                // tray.
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::Destroyed,
                    ..
                } if label == "main" => {
                    app_handle.state::<StreamRegistry>().cancel_all();
                    app_handle.state::<ExecRegistry>().clear();
                }
                _ => {}
            }
        });
}
