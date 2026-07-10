import { isSupabaseConfigured, supabase } from './supabaseClient.js'

const clientQrOrdersTable = 'public_client_qr_orders'
const defaultStoreId = 'loccoburger'

let remoteUnavailableUntil = 0

function canUseClientQrRemote() {
  return isSupabaseConfigured && Boolean(supabase) && Date.now() >= remoteUnavailableUntil
}

function markRemoteUnavailable(error) {
  const message = String(error?.message ?? '').toLowerCase()
  const code = String(error?.code ?? '').toLowerCase()
  if (
    code === '42p01' ||
    code === 'pgrst205' ||
    message.includes('does not exist') ||
    message.includes(clientQrOrdersTable)
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
    order_type: order.type ?? 'pedido',
    status: order.status ?? 'novo',
    table_number: String(order.tableNumber ?? '').trim(),
    session_id: order.sessionId ?? null,
    session_identity: order.sessionIdentity ?? null,
    customer_name: order.customerName ?? '',
    phone: order.phone ?? '',
    notes: order.notes ?? '',
    items: Array.isArray(order.items) ? order.items : [],
    total: Number(order.total || 0),
    tab_id: order.tabId ?? null,
    admin_message: order.adminMessage ?? null,
    created_at: createdAt,
    updated_at: toIsoDate(order.updatedAt ?? order.processedAt ?? order.paidAt, createdAt),
    processed_at: toIsoDate(order.processedAt),
    paid_at: toIsoDate(order.paidAt),
  }
}

function mapOrderFromRow(row = {}) {
  return {
    id: row.app_id,
    type: row.order_type ?? 'pedido',
    status: row.status ?? 'novo',
    tableNumber: row.table_number,
    sessionId: row.session_id ?? '',
    sessionIdentity: row.session_identity ?? '',
    customerName: row.customer_name ?? '',
    phone: row.phone ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processedAt: row.processed_at,
    paidAt: row.paid_at,
    notes: row.notes ?? '',
    items: Array.isArray(row.items) ? row.items : [],
    total: Number(row.total || 0),
    tabId: row.tab_id ?? '',
    adminMessage: row.admin_message ?? '',
  }
}

function isDuplicateInsert(error) {
  return String(error?.code ?? '') === '23505'
}

export async function insertClientQrOrderToSupabase(order) {
  if (!order?.id || !canUseClientQrRemote()) return { ok: false, source: 'disabled' }

  const { error } = await supabase
    .from(clientQrOrdersTable)
    .insert(mapOrderToRow(order))

  if (error) {
    if (isDuplicateInsert(error)) return { ok: true, duplicate: true }
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message }
  }

  return { ok: true }
}

export async function saveClientQrOrderToSupabase(order) {
  if (!order?.id || !canUseClientQrRemote()) return { ok: false, source: 'disabled' }

  const { error } = await supabase
    .from(clientQrOrdersTable)
    .upsert(mapOrderToRow(order), { onConflict: 'store_id,app_id' })

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message }
  }

  return { ok: true }
}

export async function updateClientQrOrderInSupabase(order) {
  if (!order?.id || !canUseClientQrRemote()) return { ok: false, source: 'disabled' }

  const row = mapOrderToRow(order)
  delete row.store_id
  delete row.app_id
  delete row.created_at

  const { error } = await supabase
    .from(clientQrOrdersTable)
    .update(row)
    .eq('store_id', defaultStoreId)
    .eq('app_id', order.id)

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message }
  }

  return { ok: true }
}

export function persistClientQrOrderToSupabaseReliable(order, { operation = 'insert', attempts = 4, intervalMs = 1200 } = {}) {
  if (!order?.id) return []

  const persistOnce = () => {
    const action = operation === 'update'
      ? updateClientQrOrderInSupabase
      : operation === 'upsert'
        ? saveClientQrOrderToSupabase
        : insertClientQrOrderToSupabase

    action(order).catch(() => {})
  }

  persistOnce()

  if (typeof window === 'undefined') return []

  return Array.from({ length: Math.max(0, attempts - 1) }, (_, index) =>
    window.setTimeout(persistOnce, intervalMs * (index + 1)),
  )
}

export async function loadClientQrOrdersFromSupabase({ tableNumber = '', sessionIdentity = '', limit = 250 } = {}) {
  if (!canUseClientQrRemote()) return { ok: false, source: 'disabled', orders: [] }

  let query = supabase
    .from(clientQrOrdersTable)
    .select('*')
    .eq('store_id', defaultStoreId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tableNumber) query = query.eq('table_number', String(tableNumber).trim())
  if (sessionIdentity) query = query.eq('session_identity', String(sessionIdentity).trim())

  const { data, error } = await query

  if (error) {
    markRemoteUnavailable(error)
    return { ok: false, error, message: error.message, orders: [] }
  }

  return {
    ok: true,
    orders: (data ?? []).map(mapOrderFromRow),
  }
}

export async function loadClientQrOrdersForCustomerFromSupabase({ tableNumber = '', sessionIdentity = '', limit = 80 } = {}) {
  if (!canUseClientQrRemote()) return { ok: false, source: 'disabled', orders: [] }

  const safeTableNumber = String(tableNumber ?? '').trim()
  const safeSessionIdentity = String(sessionIdentity ?? '').trim()
  if (!safeTableNumber || !safeSessionIdentity) return { ok: false, source: 'missing-identity', orders: [] }

  const { data, error } = await supabase.rpc('get_client_qr_orders', {
    p_table_number: safeTableNumber,
    p_session_identity: safeSessionIdentity,
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

export function subscribeToClientQrOrdersFromSupabase(onOrder) {
  if (!canUseClientQrRemote() || typeof onOrder !== 'function') return null

  const channel = supabase
    .channel('public-client-qr-orders-db')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: clientQrOrdersTable,
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

export function closeClientQrOrdersSupabaseSubscription(channel) {
  if (channel && supabase?.removeChannel) supabase.removeChannel(channel)
}
