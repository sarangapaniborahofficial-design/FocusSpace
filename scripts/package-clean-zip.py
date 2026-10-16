#!/usr/bin/env python3
"""
FocusSpace — Clean Codebase Packaging Utility

Packages the full, clean codebase (excluding node_modules, .git, and dist)
into FocusSpace_Clean_Codebase.zip in both the project root and artifact directory.
"""

import os
import sys
import shutil
import zipfile

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
WORKSPACE_ROOT = os.path.abspath(os.path.join(SRC_DIR, '..'))
ARTIFACT_DIR = r"C:\Users\Saran\.gemini\antigravity\brain\76401ca6-b123-4950-81c5-c79e0e7a48d5"

DEST_ZIPS = [
    os.path.join(WORKSPACE_ROOT, 'FocusSpace_Clean_Codebase.zip'),
    os.path.join(ARTIFACT_DIR, 'FocusSpace_Clean_Codebase.zip'),
]

EXCLUDE_DIR_NAMES = {'node_modules', '.git', 'dist', 'dist-electron', '__pycache__'}

def is_excluded_dir(root: str, d: str) -> bool:
    if d in EXCLUDE_DIR_NAMES:
        return True
    if d == 'target':
        rel = os.path.relpath(os.path.join(root, d), SRC_DIR)
        # Only exclude rust cargo build artifacts (top-level target or src-tauri/target), NOT src/voice/target
        if rel in {'target', os.path.join('src-tauri', 'target')}:
            return True
    return False

def package_zip():
    print("[*] FocusSpace -- Packaging clean codebase...")
    temp_zip = os.path.join(WORKSPACE_ROOT, 'temp_clean_codebase.zip')

    file_count = 0
    with zipfile.ZipFile(temp_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(SRC_DIR):
            dirs[:] = [d for d in dirs if not is_excluded_dir(root, d)]
            for f in files:
                if f.endswith('.pyc') or f == '.DS_Store':
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, SRC_DIR)
                zf.write(full_path, rel_path)
                file_count += 1

    zip_size_mb = os.path.getsize(temp_zip) / (1024 * 1024)
    print(f"  + Bundled {file_count} files into zip ({zip_size_mb:.2f} MB)")

    for dest in DEST_ZIPS:
        try:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(temp_zip, dest)
            print(f"  + Exported to: {dest} ({os.path.getsize(dest) / (1024 * 1024):.2f} MB)")
        except Exception as e:
            print(f"  ! Warning: Failed to copy to {dest}: {e}")

    if os.path.exists(temp_zip):
        os.remove(temp_zip)

    print("[SUCCESS] Clean codebase zip archive successfully updated.\n")

if __name__ == '__main__':
    package_zip()
