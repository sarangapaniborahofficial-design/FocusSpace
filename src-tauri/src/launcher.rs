#[tauri::command]
pub fn launch_external(target: String) -> Result<(), String> {
    let clean = target.trim();
    if clean.is_empty() {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/C", "start", "", clean])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| format!("Failed to launch '{}': {}", clean, e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        #[cfg(target_os = "macos")]
        let cmd = "open";
        #[cfg(target_os = "linux")]
        let cmd = "xdg-open";

        std::process::Command::new(cmd)
            .arg(clean)
            .spawn()
            .map_err(|e| format!("Failed to launch '{}': {}", clean, e))?;
        Ok(())
    }
}
