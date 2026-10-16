pub mod hud;
pub mod launcher;
pub mod vault;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            vault::write_vault_snapshot,
            vault::list_vault_snapshots,
            vault::read_vault_snapshot,
            launcher::launch_external,
            hud::hud_start_dragging,
            hud::hud_set_expanded,
            hud::hud_hide,
            hud::hud_show,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Register global shortcuts: Ctrl+Alt+Space, Ctrl+Alt+H, Ctrl+Alt+D
            let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["Ctrl+Alt+Space", "Ctrl+Alt+H", "Ctrl+Alt+D"])?
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let text = shortcut.to_string().to_lowercase();
                        if text.contains("space") {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                                let _ = w.emit("quick-add-shortcut", ());
                            }
                        } else if text.contains('h') {
                            if let Some(hud) = app.get_webview_window("floating-hud") {
                                if let Ok(visible) = hud.is_visible() {
                                    if visible {
                                        let _ = hud.hide();
                                    } else {
                                        let _ = hud.show();
                                    }
                                }
                            }
                        } else if text.contains('d') {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                                let _ = w.emit("toggle-dictation-shortcut", ());
                            }
                        }
                    }
                })
                .build();
            app.handle().plugin(shortcut_plugin)?;

            // Setup System Tray Menu: Show FocusSpace, Toggle HUD, Quit
            let show_i = MenuItem::with_id(app, "show", "Show FocusSpace", true, None::<&str>)?;
            let hud_i = MenuItem::with_id(app, "toggle_hud", "Toggle HUD", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_i, &hud_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new().menu(&tray_menu);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "toggle_hud" => {
                        if let Some(hud) = app.get_webview_window("floating-hud") {
                            if let Ok(visible) = hud.is_visible() {
                                if visible {
                                    let _ = hud.hide();
                                } else {
                                    let _ = hud.show();
                                }
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Intercept CloseRequested on main window to hide to tray instead of quitting
            if let Some(main_win) = app.get_webview_window("main") {
                let main_clone = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

