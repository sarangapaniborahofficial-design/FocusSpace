use regex::Regex;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::Manager;

pub const SNAPSHOT_REGEX: &str = r"^focusspace-\d{4}-\d{2}-\d{2}(-\d{6})?\.json$";

/// Validates that a filename matches the strict FocusSpace snapshot format.
/// Disallows path traversal, directory separators, and arbitrary extensions.
pub fn validate_snapshot_filename(filename: &str) -> bool {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return false;
    }
    match Regex::new(SNAPSHOT_REGEX) {
        Ok(re) => re.is_match(filename),
        Err(_) => false,
    }
}

/// Prunes snapshots older than 14 days, never deleting if <= 3 snapshots remain.
pub fn prune_vault_snapshots(backup_dir: &Path) -> Result<usize, String> {
    if !backup_dir.exists() {
        return Ok(0);
    }

    let re = Regex::new(SNAPSHOT_REGEX).map_err(|e| e.to_string())?;
    let mut snapshots: Vec<(PathBuf, SystemTime)> = Vec::new();

    for entry in std::fs::read_dir(backup_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if re.is_match(file_name) {
                    let metadata = entry.metadata().map_err(|e| e.to_string())?;
                    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                    snapshots.push((path, modified));
                }
            }
        }
    }

    // Safety rule: never prune if 3 or fewer snapshots exist
    if snapshots.len() <= 3 {
        return Ok(0);
    }

    // Sort descending by modified time (newest first)
    snapshots.sort_by(|a, b| b.1.cmp(&a.1));

    let now = SystemTime::now();
    let fourteen_days = Duration::from_secs(14 * 24 * 3600);
    let mut pruned_count = 0;

    // Keep the top 3 unconditionally. For the rest, prune if older than 14 days.
    for (path, modified) in snapshots.into_iter().skip(3) {
        if let Ok(age) = now.duration_since(modified) {
            if age > fourteen_days {
                if std::fs::remove_file(&path).is_ok() {
                    pruned_count += 1;
                }
            }
        }
    }

    Ok(pruned_count)
}

/// Atomically writes a snapshot to `<backup_dir>/<filename>.tmp` then renames to `<filename>`.
pub fn write_vault_snapshot_to_dir(
    backup_dir: &Path,
    filename: &str,
    payload: &str,
) -> Result<String, String> {
    if !validate_snapshot_filename(filename) {
        return Err(format!(
            "Invalid snapshot filename '{}'. Must match pattern {}",
            filename, SNAPSHOT_REGEX
        ));
    }

    std::fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;

    let target_path = backup_dir.join(filename);
    let temp_filename = format!("{}.tmp", filename);
    let temp_path = backup_dir.join(temp_filename);

    // 1. Write and sync to temp file
    {
        use std::io::Write;
        let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        file.write_all(payload.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }

    // 2. Atomic rename
    std::fs::rename(&temp_path, &target_path).map_err(|e| e.to_string())?;

    // 3. Prune old retention
    let _ = prune_vault_snapshots(backup_dir);

    Ok(target_path.to_string_lossy().to_string())
}

/// Lists all valid snapshot filenames in the backup directory, sorted newest first.
pub fn list_vault_snapshots_from_dir(backup_dir: &Path) -> Result<Vec<String>, String> {
    if !backup_dir.exists() {
        return Ok(Vec::new());
    }

    let re = Regex::new(SNAPSHOT_REGEX).map_err(|e| e.to_string())?;
    let mut filenames = Vec::new();

    for entry in std::fs::read_dir(backup_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if re.is_match(file_name) {
                    filenames.push(file_name.to_string());
                }
            }
        }
    }

    filenames.sort_by(|a, b| b.cmp(a));
    Ok(filenames)
}

/// Reads a snapshot payload from disk after filename validation.
pub fn read_vault_snapshot_from_dir(backup_dir: &Path, filename: &str) -> Result<String, String> {
    if !validate_snapshot_filename(filename) {
        return Err(format!(
            "Invalid snapshot filename '{}'. Must match pattern {}",
            filename, SNAPSHOT_REGEX
        ));
    }

    let target_path = backup_dir.join(filename);
    if !target_path.exists() {
        return Err(format!("Snapshot file '{}' does not exist", filename));
    }

    std::fs::read_to_string(target_path).map_err(|e| e.to_string())
}

fn get_backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;
    Ok(app_data.join("Backups"))
}

#[tauri::command]
pub fn write_vault_snapshot(
    app: tauri::AppHandle,
    filename: String,
    payload: String,
) -> Result<String, String> {
    let backup_dir = get_backup_dir(&app)?;
    write_vault_snapshot_to_dir(&backup_dir, &filename, &payload)
}

#[tauri::command]
pub fn list_vault_snapshots(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let backup_dir = get_backup_dir(&app)?;
    list_vault_snapshots_from_dir(&backup_dir)
}

#[tauri::command]
pub fn read_vault_snapshot(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let backup_dir = get_backup_dir(&app)?;
    read_vault_snapshot_from_dir(&backup_dir, &filename)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_validate_snapshot_filename() {
        assert!(validate_snapshot_filename("focusspace-2026-10-16.json"));
        assert!(validate_snapshot_filename("focusspace-2026-10-16-123456.json"));

        // Reject path traversal & invalid extensions
        assert!(!validate_snapshot_filename("../focusspace-2026-10-16.json"));
        assert!(!validate_snapshot_filename("..\\focusspace-2026-10-16.json"));
        assert!(!validate_snapshot_filename("focusspace-2026-10-16.json.exe"));
        assert!(!validate_snapshot_filename("backup.json"));
        assert!(!validate_snapshot_filename("focusspace-bad.json"));
        assert!(!validate_snapshot_filename("/etc/passwd"));
    }

    #[test]
    fn test_atomic_write_and_read() {
        let dir = tempdir().expect("create temp dir");
        let filename = "focusspace-2026-10-16.json";
        let payload = r#"{"app":"FocusSpace","schemaVersion":4,"data":{}}"#;

        let path = write_vault_snapshot_to_dir(dir.path(), filename, payload)
            .expect("write vault snapshot");
        assert!(std::path::Path::new(&path).exists());

        // Verify temp file does not remain
        let tmp_path = dir.path().join(format!("{}.tmp", filename));
        assert!(!tmp_path.exists());

        // Verify read
        let read_back =
            read_vault_snapshot_from_dir(dir.path(), filename).expect("read vault snapshot");
        assert_eq!(read_back, payload);

        // Verify list
        let list = list_vault_snapshots_from_dir(dir.path()).expect("list snapshots");
        assert_eq!(list, vec![filename.to_string()]);
    }

    #[test]
    fn test_retention_pruning() {
        let dir = tempdir().expect("create temp dir");
        let now = SystemTime::now();
        let old_time = now - Duration::from_secs(20 * 24 * 3600); // 20 days old

        // Case 1: 3 old files -> none should be pruned (never prune if <= 3)
        for i in 1..=3 {
            let name = format!("focusspace-2026-09-0{}.json", i);
            let file_path = dir.path().join(&name);
            std::fs::write(&file_path, "{}").expect("write test file");
            let file = std::fs::OpenOptions::new()
                .write(true)
                .open(&file_path)
                .expect("open file");
            file.set_modified(old_time).expect("set modified time");
        }

        let pruned = prune_vault_snapshots(dir.path()).expect("prune snapshots");
        assert_eq!(pruned, 0);
        assert_eq!(
            list_vault_snapshots_from_dir(dir.path()).unwrap().len(),
            3
        );

        // Case 2: Add 2 fresh snapshots and 2 additional old snapshots (total 7 snapshots: 2 fresh, 5 old)
        // Top 3 (2 fresh + 1 old) are kept. The remaining 4 old snapshots should be pruned!
        for i in 4..=5 {
            let name = format!("focusspace-2026-09-0{}.json", i);
            let file_path = dir.path().join(&name);
            std::fs::write(&file_path, "{}").expect("write test file");
            let file = std::fs::OpenOptions::new()
                .write(true)
                .open(&file_path)
                .expect("open file");
            file.set_modified(old_time).expect("set modified time");
        }
        for i in 1..=2 {
            let name = format!("focusspace-2026-10-1{}.json", i);
            let file_path = dir.path().join(&name);
            std::fs::write(&file_path, "{}").expect("write test file");
        }

        let pruned_more = prune_vault_snapshots(dir.path()).expect("prune snapshots");
        assert_eq!(pruned_more, 4); // 7 total - 3 kept = 4 pruned
        assert_eq!(
            list_vault_snapshots_from_dir(dir.path()).unwrap().len(),
            3
        );
    }
}
