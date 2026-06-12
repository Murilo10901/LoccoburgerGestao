import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'
import { getDataOwnerId } from './tenantRepository.js'

function mapCustomerFromSupabase(customer) {
  return {
    id: Number(customer.app_id),
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    notes: customer.notes ?? '',
    tags: customer.tags ?? [],
  }
}

function mapCampaignFromSupabase(campaign) {
  return {
    id: Number(campaign.app_id),
    code: campaign.code,
    customerId: Number(campaign.customer_app_id),
    customerName: campaign.customer_name,
    promotionId: campaign.promotion_id,
    promotionLabel: campaign.promotion_label,
    type: campaign.type,
    value: Number(campaign.value || 0),
    channel: campaign.channel,
    status: campaign.status,
    message: campaign.message ?? '',
    createdAt: campaign.created_at_label,
    createdAtIso: campaign.created_at_iso,
    time: campaign.time_label,
  }
}

function mapDeliveryFromSupabase(order, items) {
  return {
    id: order.app_id,
    customerId: Number(order.customer_app_id),
    customer: order.customer_name,
    channel: order.channel,
    status: order.status,
    total: Number(order.total || 0),
    eta: order.eta,
    address: order.address,
    campaign: order.campaign,
    discount: Number(order.discount || 0),
    createdAt: Number(order.created_at_ms || 0),
    items: items
      .filter((item) => item.order_app_id === order.app_id)
      .map((item) => ({
        productId: Number(item.product_app_id),
        name: item.product_name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        total: Number(item.total || 0),
        notes: item.notes ?? '',
        manualNotes: item.manual_notes ?? '',
        modifiers: item.modifiers,
      })),
  }
}

export async function loadCustomerDeliveryTables() {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para carregar clientes e delivery.' }
  const ownerId = await getDataOwnerId()

  const [customersResult, campaignsResult, ordersResult, itemsResult] = await Promise.all([
    supabase.from('user_customers').select('*').eq('user_id', ownerId),
    supabase.from('user_customer_campaigns').select('*').eq('user_id', ownerId),
    supabase.from('user_delivery_orders').select('*').eq('user_id', ownerId),
    supabase.from('user_delivery_order_items').select('*').eq('user_id', ownerId),
  ])

  const error = customersResult.error ?? campaignsResult.error ?? ordersResult.error ?? itemsResult.error
  if (error) {
    return { ok: false, message: `CRM ainda nao disponivel no Supabase: ${error.message}` }
  }

  const hasData =
    customersResult.data.length > 0 ||
    campaignsResult.data.length > 0 ||
    ordersResult.data.length > 0 ||
    itemsResult.data.length > 0

  return {
    ok: true,
    hasData,
    data: {
      customers: customersResult.data.map(mapCustomerFromSupabase),
      customerCampaigns: campaignsResult.data.map(mapCampaignFromSupabase),
      deliveries: ordersResult.data.map((order) => mapDeliveryFromSupabase(order, itemsResult.data)),
    },
  }
}

export async function saveCustomerDeliveryTables({ customers, customerCampaigns, deliveries }) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para salvar clientes e delivery.' }
  const ownerId = await getDataOwnerId()

  const deleteItems = await supabase.from('user_delivery_order_items').delete().eq('user_id', ownerId)
  const deleteOrders = await supabase.from('user_delivery_orders').delete().eq('user_id', ownerId)
  const deleteCampaigns = await supabase.from('user_customer_campaigns').delete().eq('user_id', ownerId)
  const deleteCustomers = await supabase.from('user_customers').delete().eq('user_id', ownerId)
  const deleteError = deleteItems.error ?? deleteOrders.error ?? deleteCampaigns.error ?? deleteCustomers.error
  if (deleteError) return { ok: false, message: `Erro ao limpar CRM antigo: ${deleteError.message}` }

  if (customers.length > 0) {
    const { error } = await supabase.from('user_customers').insert(
      customers.map((customer) => ({
        user_id: ownerId,
        app_id: Number(customer.id),
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes ?? '',
        tags: customer.tags ?? [],
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar clientes: ${error.message}` }
  }

  if (customerCampaigns.length > 0) {
    const { error } = await supabase.from('user_customer_campaigns').insert(
      customerCampaigns.map((campaign) => ({
        user_id: ownerId,
        app_id: Number(campaign.id),
        code: campaign.code,
        customer_app_id: Number(campaign.customerId),
        customer_name: campaign.customerName,
        promotion_id: campaign.promotionId,
        promotion_label: campaign.promotionLabel,
        type: campaign.type,
        value: Number(campaign.value || 0),
        channel: campaign.channel,
        status: campaign.status,
        message: campaign.message ?? '',
        created_at_label: campaign.createdAt,
        created_at_iso: campaign.createdAtIso,
        time_label: campaign.time,
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar campanhas: ${error.message}` }
  }

  if (deliveries.length > 0) {
    const { error } = await supabase.from('user_delivery_orders').insert(
      deliveries.map((order) => ({
        user_id: ownerId,
        app_id: String(order.id),
        customer_app_id: Number(order.customerId),
        customer_name: order.customer,
        channel: order.channel,
        status: order.status,
        total: Number(order.total || 0),
        eta: order.eta,
        address: order.address,
        campaign: order.campaign,
        discount: Number(order.discount || 0),
        created_at_ms: Number(order.createdAt || 0),
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar pedidos delivery: ${error.message}` }
  }

  const orderItems = deliveries.flatMap((order) =>
    (order.items ?? []).map((item, index) => ({
      user_id: ownerId,
      order_app_id: String(order.id),
      line_index: index,
      product_app_id: Number(item.productId),
      product_name: item.name,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unitPrice || 0),
      total: Number(item.total || 0),
      notes: item.notes ?? '',
      manual_notes: item.manualNotes ?? '',
      modifiers: item.modifiers ?? null,
    })),
  )

  if (orderItems.length > 0) {
    const { error } = await supabase.from('user_delivery_order_items').insert(orderItems)
    if (error) return { ok: false, message: `Erro ao salvar itens do delivery: ${error.message}` }
  }

  return { ok: true, message: 'Clientes e delivery salvos em tabelas proprias.' }
}
