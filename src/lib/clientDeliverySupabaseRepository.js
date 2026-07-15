import { isSupabaseConfigured, supabase } from './supabaseClient.js'

const clientDeliveryOrdersTable = 'public_client_delivery_orders'
const defaultStoreId = 'loccoburger'

let remoteUnavailableUntil = 0

function canUseClientDeliveryRemote() {
  return isSupabaseConfigured && Boolean(supabase) && Date.now() >= remoteUnavailableUntil
}

function markRemoteUnavailable(error) {
  const message = String(error?.message ?? '').toLowerCase()
  const code = String(error?.code ?? '').toLowerCase()
  if (
    code === '42p01' ||
    code === 'pgrst205' ||
    message.includes('does not exist') ||
    message.includes(clientDeliveryOrdersTable)
  ) {
    remoteUnavailableUntil = Date.now() + 15_000
  }
}

function toIsoDate(value, fallback = null) {
  if (!value) return fallback
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback
  return parsedDate.toISOString()
}

function mapOrderToRow(order = {}) {
  const createdAt = toIsoDate(order.createdAt, new Date().toISOString())

  return {
    store_id: defaultStoreId,
    app_id: String(order.id ?? '').trim(),
    status: order.status ?? 'novo',
    session_id: order.sessionId ?? null,
    account_type: order.accountType ?? 'guest',
    customer_name: order.customerName ?? '',
    phone: order.phone ?? '',
    customer_email: order.customerEmail ?? '',
    address: order.address ?? '',
    complement: order.complement ?? '',
    payment_method: order.paymentMethod ?? '',
    payment_status: order.paymentStatus ?? '',
    payment_label: order.paymentLabel ?? '',
    pay_on_delivery: Boolean(order.payOnDelivery),
    cash_change_for: Number(order.cashChangeFor || 0),
    notes: order.notes ?? '',
    items: Array.isArray(order.items) ? order.items : [],
    order_payload: order,
    subtotal: Number(order.subtotal || 0),
    delivery_fee: Number(order.deliveryFee || 0),
    total: Number(order.total || 0),
    admin_delivery_id: order.adminDeliveryId ?? null,
    admin_message: order.adminMessage ?? null,
    eta: order.eta ?? null,
    guest_visible_until_ms: order.guestVisibleUntil ? Number(order.guestVisibleUntil) : null,
    delivery_auto_complete_at_ms: order.deliveryAutoCompleteAt ? Number(order.deliveryAutoCompleteAt) : null,
    created_at: createdAt,
    updated_at: toIsoDate(order.updatedAt ?? order.processedAt ?? order.paidAt ?? order.deliveredAt, createdAt),
    processed_at: toIsoDate(order.processedAt),
    paid_at: toIsoDate(order.paidAt),
    dispatched_at: toIsoDate(order.dispatchedAt),
    delivered_at: toIsoDate(order.deliveredAt),
  }
}

function mapOrderFromRow(row = {}) {
  const payload = row.order_payload && typeof row.order_payload === 'object' ? row.order_payload : {}

  return {
    ...payload,
    id: row.app_id,
    type: payload.type ?? 'delivery',
    status: row.status ?? payload.status ?? 'novo',
    sessionId: row.session_id ?? payload.sessionId ?? '',
    accountType: row.account_type ?? payload.accountType ?? 'guest',
    customerName: row.customer_name ?? payload.customerName ?? '',
    phone: row.phone ?? payload.phone ?? '',
    customerEmail: row.customer_email ?? payload.customerEmail ?? '',
    address: row.address ?? payload.address ?? '',
    complement: row.complement ?? payload.complement ?? '',
    paymentMethod: row.payment_method ?? payload.paymentMethod ?? '',
    paymentStatus: row.payment_status ?? payload.paymentStatus ?? '',
    paymentLabel: row.payment_label ?? payload.paymentLabel ?? '',
    payOnDelivery: Boolean(row.pay_on_delivery ?? payload.payOnDelivery),
    cashChangeFor: Number(row.cash_change_for ?? payload.cashChangeFor ?? 0),
    createdAt: row.created_at ?? payload.createdAt,
    updatedAt: row.updated_at ?? payload.updatedAt,
    processedAt: row.processed_at ?? payload.processedAt,
    paidAt: row.paid_at ?? payload.paidAt,
    dispatchedAt: row.dispatched_at ?? payload.dispatchedAt,
    deliveredAt: row.delivered_at ?? payload.deliveredAt,
    notes: row.notes ?? payload.notes ?? '',
    items: Array.isArray(row.items) ? row.items : Array.isArray(payload.items) ? payload.items : [],
    subtotal: Number(row.subtotal ?? payload.subtotal ?? 0),
    deliveryFee: Number(row.delivery_fee ?? payload.deliveryFee ?? 0),
    total: Number(row.total ?? payload.total ?? 0),
    adminDeliveryId: row.admin_delivery_id ?? payload.adminDeliveryId ?? '',
    adminMessage: row.admin_message ?? payload.adminMessage ?? '',
    eta: row.eta ?? payload.eta ?? '',
    guestVisibleUntil: row.guest_visible_until_ms ? Number(row.guest_visible_until_ms) : payload.guestVisibleUntil ?? null,
    deliveryAutoCompleteAt: row.delivery_auto_complete_at_ms
      ? Number(row.delivery_auto_complete_at_ms)
      : payload.deliveryAutoCompleteAt ?? null,
  }
}

function isDuplicateInsert(error) {
  return String(error?.code ?? '') === '23505'
}

export async function insertClientDeliveryOrderToSupabase(order) {
  if (!order?.id || !canUseClientDeliveryRemote()) return { ok: false, source: 'disabled' }

  const { error } = await supabase
    .from(clientDeliveryOrdersTable)
    .insert(mapOrderToRow(order))

  if (error) {
    if (isDuplicateInsert(error)) return { ok: true, duplicate: true }
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message }
  }

  return { ok: true }
}

export async function saveClientDeliveryOrderToSupabase(order) {
  if (!order?.id || !canUseClientDeliveryRemote()) return { ok: false, source: 'disabled' }

  const { error } = await supabase
    .from(clientDeliveryOrdersTable)
    .upsert(mapOrderToRow(order), { onConflict: 'store_id,app_id' })

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message }
  }

  return { ok: true }
}

export async function updateClientDeliveryOrderInSupabase(order) {
  if (!order?.id || !canUseClientDeliveryRemote()) return { ok: false, source: 'disabled' }

  const row = mapOrderToRow(order)
  delete row.store_id
  delete row.app_id
  delete row.created_at

  const { error } = await supabase
    .from(clientDeliveryOrdersTable)
    .update(row)
    .eq('store_id', defaultStoreId)
    .eq('app_id', order.id)

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message }
  }

  return { ok: true }
}

export function persistClientDeliveryOrderToSupabaseReliable(order, { operation = 'insert', attempts = 4, intervalMs = 1200 } = {}) {
  if (!order?.id) return []

  const persistOnce = () => {
    const action = operation === 'update'
      ? updateClientDeliveryOrderInSupabase
      : operation === 'upsert'
        ? saveClientDeliveryOrderToSupabase
        : insertClientDeliveryOrderToSupabase

    action(order).catch(() => {})
  }

  persistOnce()

  if (typeof window === 'undefined') return []

  return Array.from({ length: Math.max(0, attempts - 1) }, (_, index) =>
    window.setTimeout(persistOnce, intervalMs * (index + 1)),
  )
}

export async function loadClientDeliveryOrdersFromSupabase({ limit = 300 } = {}) {
  if (!canUseClientDeliveryRemote()) return { ok: false, source: 'disabled', orders: [] }

  const { data, error } = await supabase
    .from(clientDeliveryOrdersTable)
    .select('*')
    .eq('store_id', defaultStoreId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message, orders: [] }
  }

  return {
    ok: true,
    orders: (data ?? []).map(mapOrderFromRow),
  }
}

export async function loadClientDeliveryOrdersForCustomerFromSupabase({ sessionId = '', phone = '', email = '', limit = 80 } = {}) {
  if (!canUseClientDeliveryRemote()) return { ok: false, source: 'disabled', orders: [] }

  const safeSessionId = String(sessionId ?? '').trim()
  const safePhone = String(phone ?? '').replace(/\D/g, '')
  const safeEmail = String(email ?? '').trim().toLowerCase()
  if (!safeSessionId && !safePhone && !safeEmail) return { ok: false, source: 'missing-identity', orders: [] }

  const { data, error } = await supabase.rpc('get_client_delivery_orders', {
    p_session_id: safeSessionId,
    p_phone: safePhone,
    p_email: safeEmail,
    p_limit: limit,
  })

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message, orders: [] }
  }

  return {
    ok: true,
    orders: (data ?? []).map(mapOrderFromRow),
  }
}

export function subscribeToClientDeliveryOrdersFromSupabase(onOrder) {
  if (!canUseClientDeliveryRemote() || typeof onOrder !== 'function') return null

  const channel = supabase
    .channel('public-client-delivery-orders-db')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: clientDeliveryOrdersTable,
        filter: `store_id=eq.${defaultStoreId}`,
      },
      (payload) => {
        const row = payload?.new ?? payload?.old
        if (row?.app_id) onOrder(mapOrderFromRow(row))
      },
    )
    .subscribe()

  return channel
}

export function closeClientDeliveryOrdersSupabaseSubscription(channel) {
  if (channel && supabase?.removeChannel) supabase.removeChannel(channel)
}
