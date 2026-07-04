import { getLocalDateKey } from './dateUtils.js'

export const defaultCustomerPromotions = [
  { id: 'volte10', label: 'Volte 10', type: 'Desconto', value: 10, channel: 'WhatsApp' },
  { id: 'combo15', label: 'Combo 15', type: 'Desconto', value: 15, channel: 'WhatsApp' },
  { id: 'cashback5', label: 'Cashback 5%', type: 'Cashback', value: 5, channel: 'WhatsApp' },
  { id: 'aniversario', label: 'Aniversario Locco', type: 'Brinde', value: 0, channel: 'WhatsApp' },
]

export function getCustomerOrders(customer, deliveries) {
  return deliveries.filter((order) => Number(order.customerId) === Number(customer.id))
}

export function getCustomerRelationship(customer, deliveries, cashbackRate = 5) {
  const orders = getCustomerOrders(customer, deliveries)
  const deliveredOrders = orders.filter((order) => order.status === 'entregue')
  const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const deliveredTotal = deliveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const favorite = orders
    .flatMap((order) => order.items ?? [])
    .reduce((accumulator, item) => {
      accumulator[item.name] = (accumulator[item.name] ?? 0) + Number(item.quantity || 0)
      return accumulator
    }, {})
  const favoriteItem = Object.entries(favorite).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sem historico'
  const lastOrder = [...orders].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0]
  const cashbackBalance = deliveredTotal * (cashbackRate / 100)

  return {
    cashbackBalance,
    deliveredOrders: deliveredOrders.length,
    favoriteItem,
    lastOrder,
    orders: orders.length,
    ticketAverage: orders.length ? total / orders.length : 0,
    total,
  }
}

export function getRankedCustomers(customers, deliveries, cashbackRate = 5) {
  return customers
    .map((customer) => ({
      ...customer,
      relationship: getCustomerRelationship(customer, deliveries, cashbackRate),
    }))
    .sort((a, b) => b.relationship.total - a.relationship.total)
}

export function saveCustomer({ customer, currentCustomers }) {
  const customerId = customer.id ? Number(customer.id) : Date.now()
  const tags = Array.isArray(customer.tags)
    ? customer.tags
    : String(customer.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

  const payload = {
    id: customerId,
    name: customer.name.trim(),
    phone: customer.phone.trim(),
    address: customer.address.trim(),
    notes: customer.notes.trim(),
    tags: tags.length ? tags : ['Novo'],
  }

  if (!payload.name || !payload.phone || !payload.address) return null

  const exists = currentCustomers.some((item) => item.id === customerId)
  if (!exists) return { customer: payload, customers: [payload, ...currentCustomers] }

  return {
    customer: payload,
    customers: currentCustomers.map((item) => (item.id === customerId ? { ...item, ...payload } : item)),
  }
}

export function createCustomerCampaign({ campaign, currentCampaigns, customers, deliveries }) {
  const customer = customers.find((item) => item.id === Number(campaign.customerId))
  const promotion = defaultCustomerPromotions.find((item) => item.id === campaign.promotionId)
  if (!customer || !promotion) return null

  const relationship = getCustomerRelationship(customer, deliveries)
  const now = new Date()

  return {
    id: Date.now(),
    code: `CRM-${String(currentCampaigns.length + 1).padStart(4, '0')}`,
    customerId: customer.id,
    customerName: customer.name,
    promotionId: promotion.id,
    promotionLabel: promotion.label,
    type: promotion.type,
    value: promotion.type === 'Cashback' ? relationship.cashbackBalance : promotion.value,
    channel: campaign.channel || promotion.channel,
    status: 'enviada',
    message: campaign.message.trim(),
    createdAt: now.toLocaleDateString('pt-BR'),
    createdAtIso: getLocalDateKey(now),
    time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}
