mod commands;
mod docker;
mod error;
mod state;

use std::sync::Mutex;

use state::{DockerState, ExecRegistry, MinimizeToTrayFlag, StreamRegistry};
use tauri::{
    image::Image,
    Manager, PhysicalPosition, PhysicalSize,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

/// Saved window geometry so we can restore to the same monitor/position.
struct SavedGeometry {
    position: Option<PhysicalPosition<i32>>,
    size: Option<PhysicalSize<u32>>,
}

static SAVED_GEOMETRY: Mutex<SavedGeometry> = Mutex::new(SavedGeometry {
    position: None,
    size: None,
});

fn save_window_geometry(win: &tauri::WebviewWindow) {
    let mut geo = SAVED_GEOMETRY.lock().unwrap();
    geo.position = win.outer_position().ok();
    geo.size = win.outer_size().ok();
}

/// Register the close handler on a window. When minimize-to-tray is
/// enabled, saves geometry before the window is destroyed.
fn register_close_handler(win: &tauri::WebviewWindow, handle: tauri::AppHandle) {
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let flag = handle.state::<MinimizeToTrayFlag>();
            if flag.get() {
                if let Some(w) = handle.get_webview_window("main") {
                    save_window_geometry(&w);
                }
            }
        }
    });
}

/// Restore or recreate the main window. If it was destroyed (minimize-to-tray),
/// a fresh window is built. Works on both Wayland and X11 without CSD bugs.
fn restore_window(handle: &tauri::AppHandle) {
    // If window still exists, just focus it
    if let Some(win) = handle.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    // Recreate the window from saved geometry
    let geo = SAVED_GEOMETRY.lock().unwrap();
    let (width, height) = geo
        .size
        .map(|s| (s.width as f64, s.height as f64))
        .unwrap_or((1280.0, 800.0));
    let position = geo.position;
    drop(geo);

    let mut builder = tauri::WebviewWindowBuilder::new(
        handle,
        "main",
        tauri::WebviewUrl::App(Default::default()),
    )
    .title("DockerLite")
    .inner_size(width, height)
    .min_inner_size(900.0, 600.0)
    .resizable(true)
    .decorations(true);

    if let Some(pos) = position {
        builder = builder.position(pos.x as f64, pos.y as f64);
    }

    if let Ok(win) = builder.build() {
        register_close_handler(&win, handle.clone());
    }
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

            // Tray icon: embedded at compile time, tight box without background
            let tray_icon =
                Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
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

            // Register close handler on the initial window
            if let Some(win) = app.get_webview_window("main") {
                register_close_handler(&win, app.app_handle().clone());
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // When minimize-to-tray is enabled, keep the app alive even
            // after the last window closes. The tray icon stays active.
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                let flag = app_handle.state::<MinimizeToTrayFlag>();
                if flag.get() {
                    api.prevent_exit();
                }
            }
        });
}
