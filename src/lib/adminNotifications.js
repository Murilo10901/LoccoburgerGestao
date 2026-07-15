export const adminNotificationsStorageKey = 'loccoburger_admin_notifications_v1'
export const adminNotificationSeenStorageKey = 'loccoburger_admin_notifications_seen_v1'

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function getNextNotificationReset(now = new Date()) {
  const reset = new Date(now)
  reset.setHours(4, 0, 0, 0)

  if (now.getTime() >= reset.getTime()) {
    reset.setDate(reset.getDate() + 1)
  }

  return reset.getTime()
}

export function getCurrentNotificationWindowStart(now = new Date()) {
  const start = new Date(now)
  start.setHours(4, 0, 0, 0)

  if (now.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1)
  }

  return start.getTime()
}

function getNotificationTime(notification) {
  const parsedTime = Date.parse(notification?.createdAt ?? notification?.updatedAt ?? '')
  return Number.isFinite(parsedTime) ? parsedTime : 0
}

function filterCurrentNotifications(items) {
  const windowStart = getCurrentNotificationWindowStart()
  return (Array.isArray(items) ? items : [])
    .filter((item) => getNotificationTime(item) >= windowStart)
    .slice(0, 120)
}

function normalizePayload(payload) {
  const nextResetAt = getNextNotificationReset()

  if (!payload || typeof payload !== 'object') {
    return { resetAt: nextResetAt, items: [] }
  }

  if (!payload.resetAt || Date.now() > Number(payload.resetAt)) {
    return { resetAt: nextResetAt, items: [] }
  }

  return {
    resetAt: Number(payload.resetAt),
    items: filterCurrentNotifications(payload.items),
  }
}

export function loadAdminNotifications() {
  if (!canUseStorage()) return { resetAt: getNextNotificationReset(), items: [] }

  try {
    const payload = normalizePayload(JSON.parse(window.localStorage.getItem(adminNotificationsStorageKey) ?? 'null'))
    window.localStorage.setItem(adminNotificationsStorageKey, JSON.stringify(payload))
    return payload
  } catch {
    return { resetAt: getNextNotificationReset(), items: [] }
  }
}

export function saveAdminNotifications(items) {
  const payload = {
    resetAt: getNextNotificationReset(),
    items: filterCurrentNotifications(items),
  }

  if (canUseStorage()) {
    window.localStorage.setItem(adminNotificationsStorageKey, JSON.stringify(payload))
  }

  return payload
}

export function clearAdminNotifications() {
  return saveAdminNotifications([])
}

export function loadSeenAdminNotificationKeys() {
  if (!canUseStorage()) return []

  try {
    const payload = normalizePayload(JSON.parse(window.localStorage.getItem(adminNotificationSeenStorageKey) ?? 'null'))
    window.localStorage.setItem(adminNotificationSeenStorageKey, JSON.stringify(payload))
    return payload.items
  } catch {
    return []
  }
}

export function saveSeenAdminNotificationKeys(keys) {
  const payload = {
    resetAt: getNextNotificationReset(),
    items: Array.from(new Set(Array.isArray(keys) ? keys : [])).slice(0, 600),
  }

  if (canUseStorage()) {
    window.localStorage.setItem(adminNotificationSeenStorageKey, JSON.stringify(payload))
  }

  return payload.items
}
