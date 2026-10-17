# FocusSpace — Windows Foreground Application Tracker
param([int]$IntervalSec = 2)

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class Win32Active {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public static string GetForeground() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "Idle|Idle";
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        if (pid == 0) return "Idle|Idle";
        try {
            Process p = Process.GetProcessById((int)pid);
            string name = p.ProcessName;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, 256);
            string title = sb.ToString().Trim();
            return name + "|" + (string.IsNullOrEmpty(title) ? name : title);
        } catch {
            return "Unknown|Unknown";
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $code -ErrorAction Stop
} catch {
    # Type may already be loaded in runspace
}

while ($true) {
    try {
        $res = [Win32Active]::GetForeground()
        [Console]::WriteLine($res)
        [Console]::Out.Flush()
    } catch {}
    Start-Sleep -Seconds $IntervalSec
}
