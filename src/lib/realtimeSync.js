import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'
import { getDataOwnerId } from './tenantRepository.js'

export const realtimeTables = [
  'user_app_state',
  'user_products',
  'user_inventory_items',
  'user_technical_sheets',
  'user_technical_sheet_ingredients',
  'user_customers',
  'user_customer_campaigns',
  'user_delivery_orders',
  'user_delivery_order_items',
  'user_payments',
  'user_accounts_receivable',
  'user_expenses',
  'user_cash_closings',
  'user_cash_closing_methods',
  'user_restaurant_tables',
  'user_kitchen_tickets',
  'user_whatsapp_messages',
]

const realtimeDebounceMs = 650

export async function subscribeToSharedDataChanges({ onChange, onStatus } = {}) {
  if (!supabase) {
    return { ok: false, message: 'Supabase nao configurado.', unsubscribe: () => {} }
  }

  const user = await getCurrentUser()
  const ownerId = await getDataOwnerId()

  if (!user || !ownerId) {
    return { ok: false, message: 'Entre no sistema para sincronizar.', unsubscribe: () => {} }
  }

  let timeoutId = null
  let lastPayload = null
  const channel = supabase.channel(`loccoburger-sync-${ownerId}`)

  function scheduleRefresh(payload) {
    lastPayload = payload
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      onChange?.({ ownerId, payload: lastPayload })
    }, realtimeDebounceMs)
  }

  realtimeTables.forEach((table) => {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${ownerId}`,
      },
      scheduleRefresh,
    )
  })

  channel.subscribe((status, error) => {
    onStatus?.({
      status,
      error,
      ownerId,
      message: error?.message ?? null,
    })
  })

  return {
    ok: true,
    ownerId,
    unsubscribe: () => {
      window.clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    },
  }
}
