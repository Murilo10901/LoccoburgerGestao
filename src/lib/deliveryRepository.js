export const deliveryStatusFlow = ['novo', 'preparando', 'pronto', 'despachado', 'entregue']

export function createDeliveryCustomer(customer) {
  return {
    id: Date.now(),
    name: customer.name,
    email: customer.email ?? '',
    phone: customer.phone,
    address: customer.address,
    notes: customer.notes,
    tags: customer.tags?.length ? customer.tags : ['Novo'],
  }
}

export function createDeliveryOrder({ order, customers, deliveries, products }) {
  const customer = customers.find((item) => item.id === Number(order.customerId))
  const discount = Number(order.discount || 0)
  const rawItems = order.items?.length
    ? order.items
    : [{ productId: order.productId, quantity: order.quantity, unitPrice: order.unitPrice, notes: order.notes, manualNotes: order.manualNotes, modifiers: order.modifiers }]

  if (!customer || rawItems.length === 0) return null

  const items = rawItems
    .map((item) => {
      const product = products.find((entry) => entry.id === Number(item.productId))
      const quantity = Number(item.quantity)
      if (!product || quantity <= 0) return null

      const unitPrice = Number(item.unitPrice ?? product.price)
      const subtotal = unitPrice * quantity

      return {
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice,
        total: subtotal,
        notes: item.notes ?? '',
        manualNotes: item.manualNotes ?? '',
        modifiers: item.modifiers ?? null,
      }
    })
    .filter(Boolean)

  if (items.length === 0) return null

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const deliveryFee = Number(order.deliveryFee || 0)
  const total = Math.max(0, subtotal - discount + deliveryFee)

  return {
    id: `#D-${String(deliveries.length + 1052).padStart(4, '0')}`,
    customerId: customer.id,
    customer: customer.name,
    channel: order.channel,
    status: 'novo',
    total,
    subtotal,
    deliveryFee,
    eta: '35 min',
    address: customer.address,
    phone: customer.phone,
    campaign: order.campaign,
    discount,
    paymentMethod: order.paymentMethod ?? 'entrega',
    paymentStatus: order.paymentStatus ?? 'pendente',
    paymentLabel: order.paymentLabel ?? '',
    payOnDelivery: Boolean(order.payOnDelivery),
    cashChangeFor: Number(order.cashChangeFor || 0),
    clientDeliveryOrderId: order.clientDeliveryOrderId ?? null,
    createdAt: Date.now(),
    items,
  }
}

export function advanceDeliveryOrder(order) {
  const currentIndex = deliveryStatusFlow.indexOf(order.status)
  const nextStatus = deliveryStatusFlow[Math.min(currentIndex + 1, deliveryStatusFlow.length - 1)]
  const eta = nextStatus === 'entregue' ? 'Finalizado' : nextStatus === 'despachado' ? '12 min' : order.eta

  return { ...order, status: nextStatus, eta }
}

export function getCustomerStats(customer, deliveries) {
  const orders = deliveries.filter((order) => order.customerId === customer.id)
  const total = orders.reduce((sum, order) => sum + order.total, 0)
  const favorite = orders
    .flatMap((order) => order.items)
    .reduce((accumulator, item) => {
      accumulator[item.name] = (accumulator[item.name] ?? 0) + item.quantity
      return accumulator
    }, {})
  const favoriteItem = Object.entries(favorite).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sem historico'

  return { orders: orders.length, total, favoriteItem }
}
