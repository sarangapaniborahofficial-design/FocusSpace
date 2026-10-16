use tauri::{AppHandle, LogicalSize, Manager, Window};

#[tauri::command]
pub fn hud_start_dragging(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hud_set_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    if let Some(hud) = app.get_webview_window("floating-hud") {
        let height = if expanded { 290.0 } else { 76.0 };
        hud.set_size(LogicalSize::new(320.0, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn hud_hide(app: AppHandle) -> Result<(), String> {
    if let Some(hud) = app.get_webview_window("floating-hud") {
        hud.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn hud_show(app: AppHandle) -> Result<(), String> {
    if let Some(hud) = app.get_webview_window("floating-hud") {
        hud.show().map_err(|e| e.to_string())?;
        let _ = hud.set_focus();
    }
    Ok(())
}
