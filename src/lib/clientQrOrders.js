export const clientQrOrdersStorageKey = 'loccoburger_client_qr_orders_v1'
export const clientQrSessionStoragePrefix = 'loccoburger_client_qr_session_v1'
export const clientQrDraftStoragePrefix = 'loccoburger_client_qr_draft_v1'

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function loadClientQrOrders() {
  if (!canUseStorage()) return []

  try {
    const parsedOrders = JSON.parse(window.localStorage.getItem(clientQrOrdersStorageKey) ?? '[]')
    return Array.isArray(parsedOrders) ? parsedOrders : []
  } catch {
    return []
  }
}

export function saveClientQrOrders(orders) {
  if (!canUseStorage()) return []

  const safeOrders = Array.isArray(orders) ? orders : []
  window.localStorage.setItem(clientQrOrdersStorageKey, JSON.stringify(safeOrders))
  window.dispatchEvent(new CustomEvent('loccoburger:client-qr-orders-updated', { detail: safeOrders }))
  return safeOrders
}

export function appendClientQrOrder(order) {
  const nextOrders = [order, ...loadClientQrOrders()]
  saveClientQrOrders(nextOrders)
  return order
}

export function updateClientQrOrder(orderId, patch) {
  const nextOrders = loadClientQrOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          ...(typeof patch === 'function' ? patch(order) : patch),
        }
      : order,
  )

  saveClientQrOrders(nextOrders)
  return nextOrders.find((order) => order.id === orderId)
}

export function getClientQrSessionKey(tableNumber) {
  return `${clientQrSessionStoragePrefix}:${String(tableNumber || 'balcao').trim() || 'balcao'}`
}

export function getClientQrDraftKey(tableNumber) {
  return `${clientQrDraftStoragePrefix}:${String(tableNumber || 'balcao').trim() || 'balcao'}`
}

export function loadClientQrSession(tableNumber) {
  if (!canUseStorage()) return null

  try {
    const session = JSON.parse(window.localStorage.getItem(getClientQrSessionKey(tableNumber)) ?? 'null')
    if (!session?.expiresAt || Date.now() > Number(session.expiresAt)) return null
    return session
  } catch {
    return null
  }
}

export function saveClientQrSession(tableNumber, session) {
  if (!canUseStorage()) return session

  window.localStorage.setItem(getClientQrSessionKey(tableNumber), JSON.stringify(session))
  return session
}

export function clearClientQrSession(tableNumber) {
  if (!canUseStorage()) return

  const sessionKey = getClientQrSessionKey(tableNumber)
  const draftKey = getClientQrDraftKey(tableNumber)
  window.localStorage.removeItem(sessionKey)
  window.localStorage.removeItem(draftKey)
  window.dispatchEvent(new CustomEvent('loccoburger:client-qr-session-cleared', {
    detail: { tableNumber: String(tableNumber || 'balcao').trim() || 'balcao' },
  }))
}

export function getNextClientQrSessionExpiration(now = new Date()) {
  const expiration = new Date(now)
  expiration.setHours(4, 0, 0, 0)

  if (now.getHours() >= 4) {
    expiration.setDate(expiration.getDate() + 1)
  }

  return expiration.getTime()
}
