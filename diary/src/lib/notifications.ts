// Best-effort local reminders. While the app is open (or kept alive in the
// background by the OS) it fires a notification at the two session times.
// There is no push server and no scheduled-notification API that works
// everywhere, so this is deliberately modest — see the note in Settings.

let timers: number[] = []

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

function msUntil(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const next = new Date()
  next.setHours(h ?? 0, m ?? 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

function show(title: string, body: string) {
  try {
    new Notification(title, { body, icon: 'icons/icon-192.png', tag: title })
  } catch {
    // Some browsers only allow notifications via a service worker registration.
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: title }))
      .catch(() => {})
  }
}

/** Clears any pending reminders and, if allowed, schedules the next of each. */
export function scheduleReminders(enabled: boolean, amTime: string, pmTime: string) {
  clearReminders()
  if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return

  const plan: [string, string, string][] = [
    [amTime, 'Morning session', `Your ${amTime} session is due.`],
    [pmTime, 'Evening session', `Your ${pmTime} session is due.`],
  ]
  for (const [time, title, body] of plan) {
    const delay = msUntil(time)
    // setTimeout tops out around 24.8 days; a day's wait is well inside that.
    const id = window.setTimeout(() => {
      show(title, body)
      scheduleReminders(enabled, amTime, pmTime)
    }, delay)
    timers.push(id)
  }
}

export function clearReminders() {
  for (const id of timers) window.clearTimeout(id)
  timers = []
}
