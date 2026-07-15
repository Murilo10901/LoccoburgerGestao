import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'
import { getDataOwnerId } from './tenantRepository.js'

function mapTableFromSupabase(table) {
  const tabs = table.tabs ?? []
  const mainTab = tabs.find((tab) => String(tab.id).endsWith('-mesa')) ?? tabs[0] ?? {}

  return {
    id: Number(table.app_id),
    guests: Number(table.guests || 0),
    status: table.status,
    attendant: table.attendant ?? '-',
    total: Number(table.total || 0),
    orderItems: table.order_items ?? [],
    tabs,
    customerName: mainTab.customerName ?? '',
    tableNumber: mainTab.tableNumber ?? '',
    tableLabel: mainTab.tableLabel ?? '',
    dynamic: Boolean(mainTab.dynamic),
  }
}

function serializeTableTabs(table) {
  const tabs = table.tabs?.length
    ? table.tabs
    : [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: table.orderItems ?? [] }]
  const mainTabId = `${table.id}-mesa`
  const hasMainTab = tabs.some((tab) => tab.id === mainTabId)
  const normalizedTabs = hasMainTab ? tabs : [{ id: mainTabId, name: 'Mesa', orderItems: table.orderItems ?? [] }, ...tabs]

  return normalizedTabs.map((tab) =>
    tab.id === mainTabId || tab.name === 'Mesa'
      ? {
          ...tab,
          customerName: table.customerName ?? tab.customerName ?? '',
          tableNumber: table.tableNumber ?? tab.tableNumber ?? '',
          tableLabel: table.tableLabel ?? tab.tableLabel ?? '',
          dynamic: Boolean(table.dynamic ?? tab.dynamic),
        }
      : tab,
  )
}

function mapKitchenTicketFromSupabase(ticket) {
  return {
    id: ticket.app_id,
    source: ticket.source,
    item: ticket.item,
    modifiers: ticket.modifiers,
    notes: ticket.notes ?? '',
    status: ticket.status,
    priority: ticket.priority,
    createdAt: Number(ticket.created_at_ms || 0),
    startedAt: ticket.started_at_ms ? Number(ticket.started_at_ms) : null,
    finalizedAt: ticket.finalized_at_ms ? Number(ticket.finalized_at_ms) : null,
    completedAt: ticket.completed_at_ms ? Number(ticket.completed_at_ms) : null,
    deliveredAt: ticket.delivered_at_ms ? Number(ticket.delivered_at_ms) : null,
    targetMinutes: Number(ticket.target_minutes || 0),
  }
}

export async function loadOperationTables() {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para carregar operacao.' }
  const ownerId = await getDataOwnerId()

  const [tablesResult, kitchenResult] = await Promise.all([
    supabase.from('user_restaurant_tables').select('*').eq('user_id', ownerId),
    supabase.from('user_kitchen_tickets').select('*').eq('user_id', ownerId),
  ])

  const error = tablesResult.error ?? kitchenResult.error
  if (error) {
    return { ok: false, message: `Operacao ainda nao disponivel no Supabase: ${error.message}` }
  }

  const hasData = tablesResult.data.length > 0 || kitchenResult.data.length > 0

  return {
    ok: true,
    hasData,
    data: {
      tables: tablesResult.data.map(mapTableFromSupabase).sort((a, b) => a.id - b.id),
      kitchen: kitchenResult.data.map(mapKitchenTicketFromSupabase),
    },
  }
}

export async function saveOperationTables({ tables, kitchen }) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para salvar operacao.' }
  const ownerId = await getDataOwnerId()

  const tableRows = tables.map((table) => ({
    user_id: ownerId,
    app_id: Number(table.id),
    guests: Number(table.guests || 0),
    status: table.status,
    attendant: table.attendant ?? '-',
    total: Number(table.total || 0),
    order_items: table.orderItems ?? [],
    tabs: serializeTableTabs(table),
  }))

  const kitchenRows = kitchen.map((ticket) => ({
    user_id: ownerId,
    app_id: String(ticket.id),
    source: ticket.source,
    item: ticket.item,
    modifiers: ticket.modifiers ?? null,
    notes: ticket.notes ?? '',
    status: ticket.status,
    priority: ticket.priority,
    created_at_ms: Number(ticket.createdAt || 0),
    started_at_ms: ticket.startedAt ? Number(ticket.startedAt) : null,
    finalized_at_ms: ticket.finalizedAt ? Number(ticket.finalizedAt) : null,
    completed_at_ms: ticket.completedAt ? Number(ticket.completedAt) : null,
    delivered_at_ms: ticket.deliveredAt ? Number(ticket.deliveredAt) : null,
    target_minutes: Number(ticket.targetMinutes || 0),
  }))

  if (tableRows.length > 0) {
    const { error } = await supabase
      .from('user_restaurant_tables')
      .upsert(tableRows, { onConflict: 'user_id,app_id' })
    if (error) return { ok: false, message: `Erro ao salvar mesas: ${error.message}` }

    const tableIds = tableRows.map((row) => row.app_id).filter((id) => Number.isFinite(id))
    if (tableIds.length > 0) {
      const { error: pruneError } = await supabase
        .from('user_restaurant_tables')
        .delete()
        .eq('user_id', ownerId)
        .not('app_id', 'in', `(${tableIds.join(',')})`)
      if (pruneError) return { ok: false, message: `Erro ao limpar mesas antigas: ${pruneError.message}` }
    }
  } else {
    const { error } = await supabase.from('user_restaurant_tables').delete().eq('user_id', ownerId)
    if (error) return { ok: false, message: `Erro ao limpar mesas: ${error.message}` }
  }

  if (kitchenRows.length > 0) {
    const { error } = await supabase
      .from('user_kitchen_tickets')
      .upsert(kitchenRows, { onConflict: 'user_id,app_id' })
    if (error) return { ok: false, message: `Erro ao salvar cozinha: ${error.message}` }
  } else {
    const { error } = await supabase.from('user_kitchen_tickets').delete().eq('user_id', ownerId)
    if (error) return { ok: false, message: `Erro ao limpar cozinha: ${error.message}` }
  }

  return { ok: true, message: 'Operacao salva em tabelas proprias.' }
}
