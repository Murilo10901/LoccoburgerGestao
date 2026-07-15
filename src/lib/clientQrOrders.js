import { supabase } from './supabaseClient.js'

export const clientQrOrdersStorageKey = 'loccoburger_client_qr_orders_v1'
export const clientQrSessionStoragePrefix = 'loccoburger_client_qr_session_v1'
export const clientQrDraftStoragePrefix = 'loccoburger_client_qr_draft_v1'
export const clientQrBroadcastChannelName = 'loccoburger-client-qr-orders-v1'

const clientQrOrderItemStoragePrefix = `${clientQrOrdersStorageKey}:order:`
const clientQrActiveSessionStoragePrefix = `${clientQrSessionStoragePrefix}:active`

const clientQrBroadcastEvents = {
  order: 'client-qr-order',
  orders: 'client-qr-orders',
  syncRequest: 'client-qr-orders-sync-request',
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function loadClientQrOrders() {
  if (!canUseStorage()) return []

  try {
    const parsedOrders = JSON.parse(window.localStorage.getItem(clientQrOrdersStorageKey) ?? '[]')
    const aggregateOrders = Array.isArray(parsedOrders) ? parsedOrders : []
    const individualOrders = Object.keys(window.localStorage)
      .filter((key) => key.startsWith(clientQrOrderItemStoragePrefix))
      .map((key) => {
        try {
          return JSON.parse(window.localStorage.getItem(key) ?? 'null')
        } catch {
          return null
        }
      })
      .filter(Boolean)

    return normalizeClientQrOrders([...aggregateOrders, ...individualOrders])
  } catch {
    return []
  }
}

function getClientQrOrderTime(order = {}) {
  const timestamp = order.updatedAt ?? order.processedAt ?? order.paidAt ?? order.createdAt
  const parsedTime = new Date(timestamp ?? 0).getTime()
  return Number.isFinite(parsedTime) ? parsedTime : 0
}

function getClientQrOrderCreatedTime(order = {}) {
  const createdTimestamp = order.createdAt ?? order.submittedAt
  const parsedCreatedTime = new Date(createdTimestamp ?? 0).getTime()
  if (Number.isFinite(parsedCreatedTime) && parsedCreatedTime > 0) return parsedCreatedTime

  const numericId = Number(String(order.id ?? '').match(/\d{10,}/)?.[0])
  return Number.isFinite(numericId) ? numericId : 0
}

export function getClientQrOperationWindowStartTime(now = new Date()) {
  const start = new Date(now)
  start.setHours(4, 0, 0, 0)

  if (now.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1)
  }

  return start.getTime()
}

export function isClientQrOrderInCurrentOperation(order = {}, now = new Date()) {
  if (!order?.id) return false

  const timestamp = getClientQrOrderCreatedTime(order)
  return timestamp >= getClientQrOperationWindowStartTime(now)
}

export function filterCurrentOperationClientQrOrders(orders = [], now = new Date()) {
  return normalizeClientQrOrders(orders).filter((order) => isClientQrOrderInCurrentOperation(order, now))
}

export function normalizeClientQrOrders(orders) {
  const ordersById = new Map()

  ;(Array.isArray(orders) ? orders : []).forEach((order) => {
    if (!order?.id) return

    const currentOrder = ordersById.get(order.id)
    if (!currentOrder || getClientQrOrderTime(order) >= getClientQrOrderTime(currentOrder)) {
      ordersById.set(order.id, order)
    }
  })

  return Array.from(ordersById.values()).sort((first, second) => getClientQrOrderTime(second) - getClientQrOrderTime(first))
}

export function saveClientQrOrders(orders) {
  if (!canUseStorage()) return []

  const safeOrders = normalizeClientQrOrders(orders)
  const safeOrderIds = new Set(safeOrders.map((order) => String(order.id)))

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(clientQrOrderItemStoragePrefix))
    .filter((key) => !safeOrderIds.has(key.slice(clientQrOrderItemStoragePrefix.length)))
    .forEach((key) => window.localStorage.removeItem(key))

  window.localStorage.setItem(clientQrOrdersStorageKey, JSON.stringify(safeOrders))
  safeOrders.forEach((order) => {
    if (order?.id) {
      window.localStorage.setItem(`${clientQrOrderItemStoragePrefix}${order.id}`, JSON.stringify(order))
    }
  })
  window.dispatchEvent(new CustomEvent('loccoburger:client-qr-orders-updated', { detail: safeOrders }))
  return safeOrders
}

export function mergeClientQrOrders(currentOrders = [], incomingOrders = []) {
  return normalizeClientQrOrders([
    ...(Array.isArray(currentOrders) ? currentOrders : []),
    ...(Array.isArray(incomingOrders) ? incomingOrders : []),
  ])
}

export function mergeAndSaveClientQrOrders(incomingOrders = []) {
  return saveClientQrOrders(mergeClientQrOrders(loadClientQrOrders(), incomingOrders))
}

export function appendClientQrOrder(order) {
  const nextOrders = mergeClientQrOrders(loadClientQrOrders(), [order])
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

export function normalizeClientQrPhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeClientQrText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function getClientQrSessionIdentity(session = {}) {
  const phone = normalizeClientQrPhone(session.phone ?? session.customerPhone)
  if (phone.length >= 8) return `phone:${phone.slice(-11)}`

  const name = normalizeClientQrText(session.customerName ?? session.name)
  return name ? `name:${name}` : ''
}

function getTableStorageId(tableNumber) {
  return String(tableNumber || 'balcao').trim() || 'balcao'
}

export function getClientQrSessionKey(tableNumber, identity = '') {
  const tableStorageId = getTableStorageId(tableNumber)
  const identityKey = String(identity ?? '').trim()
  return `${clientQrSessionStoragePrefix}:${tableStorageId}${identityKey ? `:${identityKey}` : ''}`
}

export function getActiveClientQrSessionIdentityKey(tableNumber) {
  return `${clientQrActiveSessionStoragePrefix}:${getTableStorageId(tableNumber)}`
}

export function loadActiveClientQrSessionIdentity(tableNumber) {
  if (typeof window === 'undefined' || !window.sessionStorage) return ''

  try {
    return window.sessionStorage.getItem(getActiveClientQrSessionIdentityKey(tableNumber)) ?? ''
  } catch {
    return ''
  }
}

export function saveActiveClientQrSessionIdentity(tableNumber, identity) {
  if (typeof window === 'undefined' || !window.sessionStorage) return

  try {
    const identityKey = String(identity ?? '').trim()
    if (identityKey) {
      window.sessionStorage.setItem(getActiveClientQrSessionIdentityKey(tableNumber), identityKey)
    } else {
      window.sessionStorage.removeItem(getActiveClientQrSessionIdentityKey(tableNumber))
    }
  } catch {
    // Sessao do navegador pode estar bloqueada em modo privado restrito.
  }
}

export function clearActiveClientQrSessionIdentity(tableNumber) {
  saveActiveClientQrSessionIdentity(tableNumber, '')
}

export function getClientQrDraftKey(tableNumber, identity = '') {
  const tableStorageId = getTableStorageId(tableNumber)
  const identityKey = String(identity ?? '').trim()
  return `${clientQrDraftStoragePrefix}:${tableStorageId}${identityKey ? `:${identityKey}` : ''}`
}

function readClientQrSessionByKey(sessionKey) {
  try {
    const session = JSON.parse(window.localStorage.getItem(sessionKey) ?? 'null')
    if (!session?.expiresAt || Date.now() > Number(session.expiresAt)) return null
    return session
  } catch {
    return null
  }
}

export function loadClientQrSession(tableNumber, identity = '') {
  if (!canUseStorage()) return null

  const identityKey = String(identity ?? '').trim()
  if (identityKey) return readClientQrSessionByKey(getClientQrSessionKey(tableNumber, identityKey))

  return readClientQrSessionByKey(getClientQrSessionKey(tableNumber))
}

export function saveClientQrSession(tableNumber, session) {
  if (!canUseStorage()) return session

  const identity = getClientQrSessionIdentity(session)
  window.localStorage.setItem(getClientQrSessionKey(tableNumber), JSON.stringify(session))
  if (identity) window.localStorage.setItem(getClientQrSessionKey(tableNumber, identity), JSON.stringify(session))
  return session
}

export function clearClientQrSession(tableNumber, identityOrSession = '') {
  if (!canUseStorage()) return

  const identity = typeof identityOrSession === 'object' && identityOrSession !== null
    ? getClientQrSessionIdentity(identityOrSession)
    : String(identityOrSession ?? '').trim()
  const sessionKey = getClientQrSessionKey(tableNumber)
  const draftKey = getClientQrDraftKey(tableNumber)

  if (identity) {
    window.localStorage.removeItem(getClientQrSessionKey(tableNumber, identity))
    window.localStorage.removeItem(getClientQrDraftKey(tableNumber, identity))
    const activeSession = readClientQrSessionByKey(sessionKey)
    if (getClientQrSessionIdentity(activeSession ?? {}) === identity) {
      window.localStorage.removeItem(sessionKey)
    }
    if (loadActiveClientQrSessionIdentity(tableNumber) === identity) clearActiveClientQrSessionIdentity(tableNumber)
  } else {
    const tablePrefix = `${sessionKey}:`
    Object.keys(window.localStorage)
      .filter((key) => key === sessionKey || key.startsWith(tablePrefix))
      .forEach((key) => window.localStorage.removeItem(key))
    const draftPrefix = `${draftKey}:`
    Object.keys(window.localStorage)
      .filter((key) => key === draftKey || key.startsWith(draftPrefix))
      .forEach((key) => window.localStorage.removeItem(key))
    clearActiveClientQrSessionIdentity(tableNumber)
  }

  window.dispatchEvent(new CustomEvent('loccoburger:client-qr-session-cleared', {
    detail: { tableNumber: getTableStorageId(tableNumber), identity },
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

function canUseRealtime() {
  return typeof window !== 'undefined' && Boolean(supabase?.channel)
}

let clientQrPublishChannel = null
let clientQrPublishReadyPromise = null

function waitForClientQrChannel(channel, timeoutMs = 1800) {
  return new Promise((resolve) => {
    let finished = false
    const timeoutId = window.setTimeout(() => {
      if (finished) return
      finished = true
      resolve(false)
    }, timeoutMs)

    channel.subscribe((status) => {
      if (finished) return

      if (status === 'SUBSCRIBED') {
        finished = true
        window.clearTimeout(timeoutId)
        resolve(true)
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        finished = true
        window.clearTimeout(timeoutId)
        resolve(false)
      }
    })
  })
}

async function resetClientQrPublishChannel() {
  const channel = clientQrPublishChannel
  clientQrPublishChannel = null
  clientQrPublishReadyPromise = null
  if (channel && supabase?.removeChannel) {
    try {
      await supabase.removeChannel(channel)
    } catch {
      // canal realtime pode ja ter sido encerrado pelo navegador
    }
  }
}

async function getClientQrPublishChannel() {
  if (!canUseRealtime()) return null

  if (clientQrPublishChannel && clientQrPublishReadyPromise) {
    const ready = await clientQrPublishReadyPromise
    return ready ? clientQrPublishChannel : null
  }

  clientQrPublishChannel = supabase.channel(clientQrBroadcastChannelName, {
    config: { broadcast: { self: false } },
  })

  clientQrPublishReadyPromise = waitForClientQrChannel(clientQrPublishChannel, 3500)

  const subscribed = await clientQrPublishReadyPromise
  if (!subscribed) {
    await resetClientQrPublishChannel()
    return null
  }

  return clientQrPublishChannel
}

async function publishClientQrBroadcast(event, payload) {
  if (!canUseRealtime()) return { ok: false, reason: 'realtime-offline' }

  const channel = await getClientQrPublishChannel()
  if (!channel) return { ok: false, reason: 'realtime-unavailable' }

  try {
    const result = await channel.send({ type: 'broadcast', event, payload })
    if (result !== 'ok') await resetClientQrPublishChannel()
    return { ok: result === 'ok', result }
  } catch (error) {
    await resetClientQrPublishChannel()
    return { ok: false, error }
  }
}

export function createClientQrBroadcastChannel({ onOrder, onOrdersUpdated, onSyncRequest } = {}) {
  if (!canUseRealtime()) return null

  const channel = supabase.channel(clientQrBroadcastChannelName, {
    config: { broadcast: { self: false } },
  })

  if (typeof onOrder === 'function') {
    channel.on('broadcast', { event: clientQrBroadcastEvents.order }, ({ payload }) => {
      const incomingOrder = payload?.order ?? payload
      if (incomingOrder?.id) onOrder(incomingOrder)
    })
  }

  if (typeof onOrdersUpdated === 'function') {
    channel.on('broadcast', { event: clientQrBroadcastEvents.orders }, ({ payload }) => {
      const incomingOrders = payload?.orders ?? payload
      if (Array.isArray(incomingOrders)) onOrdersUpdated(incomingOrders)
    })
  }

  if (typeof onSyncRequest === 'function') {
    channel.on('broadcast', { event: clientQrBroadcastEvents.syncRequest }, ({ payload }) => {
      onSyncRequest(payload ?? {})
    })
  }

  channel.subscribe()
  return channel
}

export function closeClientQrBroadcastChannel(channel) {
  if (channel && supabase?.removeChannel) supabase.removeChannel(channel)
}

export async function publishClientQrOrder(order) {
  if (!order?.id) return { ok: false, reason: 'invalid-order' }
  return publishClientQrBroadcast(clientQrBroadcastEvents.order, { order })
}

export function publishClientQrOrderReliable(order, { attempts = 5, intervalMs = 850 } = {}) {
  if (!order?.id) return []

  const publishOnce = () => publishClientQrOrder(order).catch(() => {})
  publishOnce()

  if (typeof window === 'undefined') return []

  return Array.from({ length: Math.max(0, attempts - 1) }, (_, index) =>
    window.setTimeout(publishOnce, intervalMs * (index + 1)),
  )
}

export async function publishClientQrOrders(orders) {
  const safeOrders = normalizeClientQrOrders(orders)
  if (!safeOrders.length) return { ok: false, reason: 'empty-orders' }
  return publishClientQrBroadcast(clientQrBroadcastEvents.orders, { orders: safeOrders })
}

export async function publishClientQrOrdersRequest(criteria = {}) {
  return publishClientQrBroadcast(clientQrBroadcastEvents.syncRequest, { criteria })
}
