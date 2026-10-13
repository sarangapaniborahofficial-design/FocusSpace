/**
 * Native Browser Notifications system for FocusSpace.
 * Supports Pomodoro timer completions, break alerts, and overdue task reminders.
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.error('Failed to request notification permission:', e);
    return false;
  }
}

export function sendNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notif = new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options,
    });

    // Auto close after 6 seconds if not interacted with
    setTimeout(() => {
      try {
        notif.close();
      } catch (_) {}
    }, 6000);

    return notif;
  } catch (e) {
    console.warn('Native notification failed, gracefully skipped:', e);
    return null;
  }
}

/**
 * Checks for overdue tasks and sends a non-intrusive reminder (at most once per day).
 */
export async function checkAndNotifyOverdue(overdueCount: number, todayStr: string): Promise<void> {
  if (overdueCount <= 0) return;
  const lastAlert = localStorage.getItem('focusspace-last-overdue-alert');
  if (lastAlert === todayStr) return;

  const notif = sendNotification('Overdue Tasks Pending', {
    body: `You have ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}. Take a look to stay on track!`,
    tag: 'focusspace-overdue',
  });

  if (notif) {
    localStorage.setItem('focusspace-last-overdue-alert', todayStr);
  }
}

