export const clientDeliveryOrdersStorageKey = 'loccoburger_client_delivery_orders_v1'
export const clientDeliverySessionStorageKey = 'loccoburger_client_delivery_session_v1'
export const clientDeliveryAccountsStorageKey = 'loccoburger_client_delivery_accounts_v1'
const deliveryAutoCompleteMs = 30 * 60 * 1000

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeClientDeliveryOrder(order) {
  if (!order || typeof order !== 'object') return order

  if (order.status === 'despachado') {
    const autoCompleteAt = Number(order.deliveryAutoCompleteAt || 0)
    const dispatchedAt = order.dispatchedAt ? new Date(order.dispatchedAt).getTime() : 0
    const fallbackCompleteAt = dispatchedAt ? dispatchedAt + deliveryAutoCompleteMs : 0
    const shouldCompleteAt = autoCompleteAt || fallbackCompleteAt

    if (shouldCompleteAt && Date.now() >= shouldCompleteAt) {
      return {
        ...order,
        status: 'entregue',
        eta: 'Finalizado',
        deliveredAt: order.deliveredAt ?? new Date().toISOString(),
        adminMessage: order.adminMessage ?? 'Pedido finalizado automaticamente apos a rota de entrega.',
      }
    }
  }

  return order
}

export function loadClientDeliveryOrders() {
  if (!canUseStorage()) return []

  try {
    const parsedOrders = JSON.parse(window.localStorage.getItem(clientDeliveryOrdersStorageKey) ?? '[]')
    if (!Array.isArray(parsedOrders)) return []

    const normalizedOrders = parsedOrders.map(normalizeClientDeliveryOrder)
    if (JSON.stringify(normalizedOrders) !== JSON.stringify(parsedOrders)) {
      saveClientDeliveryOrders(normalizedOrders)
    }

    return normalizedOrders
  } catch {
    return []
  }
}

export function saveClientDeliveryOrders(orders) {
  if (!canUseStorage()) return []

  const safeOrders = Array.isArray(orders) ? orders : []
  window.localStorage.setItem(clientDeliveryOrdersStorageKey, JSON.stringify(safeOrders))
  window.dispatchEvent(new CustomEvent('loccoburger:client-delivery-orders-updated', { detail: safeOrders }))
  return safeOrders
}

export function appendClientDeliveryOrder(order) {
  const nextOrders = [normalizeClientDeliveryOrder(order), ...loadClientDeliveryOrders()]
  saveClientDeliveryOrders(nextOrders)
  return order
}

export function updateClientDeliveryOrder(orderId, patch) {
  let updatedOrder = null
  const nextOrders = loadClientDeliveryOrders().map((order) => {
    if (order.id !== orderId) return order

    const nextPatch = typeof patch === 'function' ? patch(order) : patch
    const nextStatus = nextPatch?.status ?? order.status
    const nowIso = new Date().toISOString()
    updatedOrder = {
      ...order,
      ...nextPatch,
      updatedAt: nextPatch?.updatedAt ?? nowIso,
      dispatchedAt: nextStatus === 'despachado' ? nextPatch?.dispatchedAt ?? order.dispatchedAt ?? nowIso : nextPatch?.dispatchedAt ?? order.dispatchedAt,
      deliveryAutoCompleteAt: nextStatus === 'despachado'
        ? nextPatch?.deliveryAutoCompleteAt ?? order.deliveryAutoCompleteAt ?? Date.now() + deliveryAutoCompleteMs
        : nextPatch?.deliveryAutoCompleteAt ?? order.deliveryAutoCompleteAt,
      deliveredAt: nextStatus === 'entregue' ? nextPatch?.deliveredAt ?? order.deliveredAt ?? nowIso : nextPatch?.deliveredAt ?? order.deliveredAt,
    }
    return normalizeClientDeliveryOrder(updatedOrder)
  })

  saveClientDeliveryOrders(nextOrders)
  return updatedOrder
}

export function loadClientDeliverySession() {
  if (!canUseStorage()) return null

  try {
    const session = JSON.parse(window.localStorage.getItem(clientDeliverySessionStorageKey) ?? 'null')
    if (!session || typeof session !== 'object') return null

    if (session.accountType === 'guest' && session.expiresAt && Date.now() > Number(session.expiresAt)) {
      window.localStorage.removeItem(clientDeliverySessionStorageKey)
      return null
    }

    return session
  } catch {
    return null
  }
}

export function saveClientDeliverySession(session) {
  if (!canUseStorage()) return session
  window.localStorage.setItem(clientDeliverySessionStorageKey, JSON.stringify(session))
  return session
}

export function clearClientDeliverySession() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(clientDeliverySessionStorageKey)
}

export function loadClientDeliveryAccounts() {
  if (!canUseStorage()) return []

  try {
    const parsedAccounts = JSON.parse(window.localStorage.getItem(clientDeliveryAccountsStorageKey) ?? '[]')
    return Array.isArray(parsedAccounts) ? parsedAccounts : []
  } catch {
    return []
  }
}

export function saveClientDeliveryAccounts(accounts) {
  if (!canUseStorage()) return []

  const safeAccounts = Array.isArray(accounts) ? accounts : []
  window.localStorage.setItem(clientDeliveryAccountsStorageKey, JSON.stringify(safeAccounts))
  return safeAccounts
}

export function getGuestDeliveryExpiration() {
  return Date.now() + 2 * 60 * 60 * 1000
}
