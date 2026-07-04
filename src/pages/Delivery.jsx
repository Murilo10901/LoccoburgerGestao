import { Fragment, useMemo, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { formatLocalDateLabel, getLocalDateKey, getTodayLocalDateKey } from '../lib/dateUtils.js'
import { getCustomerStats } from '../lib/deliveryRepository.js'
import { checkProductStockAvailability } from '../lib/inventoryRepository.js'
import {
  additionOptions,
  buildOrderNotes,
  emptyModifiers,
  getModifiersUnitTotal,
  getOrderUnitPrice,
  getSelectedOrderModifiers,
  meatPointOptions,
  removalOptions,
} from '../lib/orderModifiers.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const channels = ['WhatsApp', 'iFood', '99Food', 'Keeta', 'App proprio']
const allCategoriesLabel = 'Todos'
const whatsappWebhookUrl = 'https://vqentphbsvnyvambtzlx.supabase.co/functions/v1/whatsapp-webhook'
const campaigns = [
  { id: 'sem-campanha', label: 'Sem campanha', discount: 0 },
  { id: 'volte10', label: 'Volte 10', discount: 10 },
  { id: 'combo15', label: 'Combo 15', discount: 15 },
]

function getDeliveryDateKey(value) {
  return getLocalDateKey(value)
}

function formatDeliveryDateLabel(dateKey) {
  return formatLocalDateLabel(dateKey, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function getDeliveryTimestamp(order) {
  const rawDate = order?.createdAt
  if (typeof rawDate === 'number') return rawDate

  const parsed = rawDate ? new Date(rawDate).getTime() : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function getDeliveryPaymentLabel(order) {
  const labels = {
    pix: 'Pix na entrega',
    credito: 'Credito na entrega',
    debito: 'Debito na entrega',
    dinheiro: 'Dinheiro na entrega',
    entrega: 'Pagar na entrega',
    link: 'Link Mercado Pago',
  }

  const label = order?.paymentLabel || labels[order?.paymentMethod] || order?.paymentMethod || 'Pendente'
  return order?.cashChangeFor ? `${label} - troco para ${currency.format(order.cashChangeFor)}` : label
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractAddressFromMessage(message) {
  const match = String(message ?? '').match(/(?:endereco|endereço|entrega|local)\s*[:\-]\s*(.+)$/im)
  return match?.[1]?.trim() ?? ''
}

function extractQuantityForProduct(normalizedMessage, normalizedProductName) {
  const escapedName = escapeRegExp(normalizedProductName)
  const beforeMatch = normalizedMessage.match(new RegExp(`(?:^|\\D)(\\d{1,2})\\s*(?:x|un|unidade|unidades)?\\s+${escapedName}`))
  if (beforeMatch) return Number(beforeMatch[1])

  const afterMatch = normalizedMessage.match(new RegExp(`${escapedName}\\s*(?:x|:|-)?\\s*(\\d{1,2})`))
  if (afterMatch) return Number(afterMatch[1])

  return 1
}

export function Delivery({
  clientDeliveryOrders = [],
  customers,
  deliveries,
  inventoryItems,
  onAddCustomer,
  onAdvanceOrder,
  onApproveClientDeliveryOrder,
  onClearClientDeliveryHistory,
  onClearDeliveryQueue,
  onCreateOrder,
  onRejectClientDeliveryOrder,
  onUpdateWhatsAppMessageStatus,
  products,
  technicalSheets,
  whatsAppMessages = [],
}) {
  const activeProducts = products.filter((product) => product.active)
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '')
  const [orderForm, setOrderForm] = useState({
    channel: 'WhatsApp',
    productId: activeProducts[0]?.id ?? '',
    quantity: 1,
    campaign: 'sem-campanha',
    notes: '',
    modifiers: emptyModifiers,
  })
  const [selectedCategory, setSelectedCategory] = useState(allCategoriesLabel)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [orderMessage, setOrderMessage] = useState(null)
  const [siteDeliveryMessage, setSiteDeliveryMessage] = useState(null)
  const [pendingSiteDeliveryOverride, setPendingSiteDeliveryOverride] = useState(null)
  const [pendingOverride, setPendingOverride] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [activeWhatsAppMessageId, setActiveWhatsAppMessageId] = useState(null)
  const [selectedDeliveryOrderId, setSelectedDeliveryOrderId] = useState(null)
  const [deliverySearch, setDeliverySearch] = useState('')
  const [deliveryDateFilter, setDeliveryDateFilter] = useState('todos')
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('ativos')
  const [deliveryActionLoading, setDeliveryActionLoading] = useState(null)
  const [siteDeliveryActionLoading, setSiteDeliveryActionLoading] = useState(null)
  const [deliveryClearLoading, setDeliveryClearLoading] = useState(null)
  const [manualOrderLoading, setManualOrderLoading] = useState(false)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === Number(selectedCustomerId)) ?? customers[0],
    [customers, selectedCustomerId],
  )
  const productCategories = [
    allCategoriesLabel,
    ...Array.from(new Set(activeProducts.map((product) => product.category))).filter(Boolean),
  ]
  const filteredProducts = selectedCategory === allCategoriesLabel
    ? activeProducts
    : activeProducts.filter((product) => product.category === selectedCategory)
  const selectedProduct = activeProducts.find((product) => product.id === Number(orderForm.productId))
  const selectedModifiers = getSelectedOrderModifiers(orderForm.modifiers)
  const modifiersUnitTotal = getModifiersUnitTotal(selectedModifiers)
  const orderUnitPrice = getOrderUnitPrice(selectedProduct, selectedModifiers)
  const selectedCampaign = campaigns.find((campaign) => campaign.id === orderForm.campaign) ?? campaigns[0]
  const subtotal = orderUnitPrice * Number(orderForm.quantity || 0)
  const orderItemsSubtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const orderTotal = Math.max(0, orderItemsSubtotal - selectedCampaign.discount)
  const stockAvailability = checkProductStockAvailability({
    inventoryItems,
    productId: Number(orderForm.productId),
    products,
    quantity: Number(orderForm.quantity || 0),
    technicalSheets,
  })
  const customerStats = selectedCustomer ? getCustomerStats(selectedCustomer, deliveries) : null
  const deliveredOrders = deliveries.filter((order) => order.status === 'entregue').length
  const actionableWhatsAppMessages = whatsAppMessages.filter((message) =>
    ['pendente', 'em_atendimento'].includes(message.status),
  )
  const pendingWhatsAppMessages = actionableWhatsAppMessages.filter((message) => message.status === 'pendente').length
  const pendingClientDeliveryOrders = clientDeliveryOrders.filter((order) => order.status === 'novo')
  const processedClientDeliveryOrders = clientDeliveryOrders.filter((order) => order.status !== 'novo').slice(0, 20)
  const todayDateKey = getTodayLocalDateKey()
  const deliveryDateOptions = Array.from(new Set([todayDateKey, ...deliveries.map((order) => getDeliveryDateKey(order.createdAt)).filter(Boolean)])).filter(Boolean)
  const normalizedDeliverySearch = normalizeText(deliverySearch)
  const visibleDeliveries = deliveries
    .filter((order) => {
      const orderDate = getDeliveryDateKey(order.createdAt)
      const matchesDate = deliveryDateFilter === 'todos' || orderDate === deliveryDateFilter
      const matchesStatus = deliveryStatusFilter === 'todos' ||
        (deliveryStatusFilter === 'ativos' ? order.status !== 'entregue' : order.status === deliveryStatusFilter)
      const matchesSearch = !normalizedDeliverySearch ||
        normalizeText(`${order.id} ${order.customer} ${order.phone ?? ''} ${order.address} ${getDeliveryPaymentLabel(order)} ${(order.items ?? []).map((item) => item.name).join(' ')}`).includes(normalizedDeliverySearch)

      return matchesDate && matchesStatus && matchesSearch
    })
    .sort((first, second) => getDeliveryTimestamp(second) - getDeliveryTimestamp(first))
  const groupedDeliveries = visibleDeliveries.reduce((groups, order) => {
    const dateKey = getDeliveryDateKey(order.createdAt) || 'sem-data'
    const currentGroup = groups.find((group) => group.dateKey === dateKey)
    if (currentGroup) {
      currentGroup.orders.push(order)
    } else {
      groups.push({ dateKey, orders: [order] })
    }
    return groups
  }, [])
  const selectedDeliveryOrder = deliveries.find((order) => order.id === selectedDeliveryOrderId) ?? null

  function detectOrderItemsFromWhatsApp(messageBody) {
    const normalizedMessage = normalizeText(messageBody)

    return activeProducts
      .filter((product) => normalizedMessage.includes(normalizeText(product.name)))
      .map((product) => {
        const quantity = extractQuantityForProduct(normalizedMessage, normalizeText(product.name))
        const unitPrice = Number(product.price || 0)

        return {
          draftId: `${Date.now()}-${product.id}`,
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
          notes: `Origem WhatsApp: ${messageBody}`,
          manualNotes: messageBody,
          modifiers: null,
        }
      })
  }

  function resetItemForm() {
    setOrderForm((form) => ({ ...form, quantity: 1, notes: '', modifiers: emptyModifiers }))
  }

  function handleAddItemToOrder() {
    if (!selectedProduct || Number(orderForm.quantity) <= 0) return

    const item = {
      draftId: Date.now(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: Number(orderForm.quantity),
      unitPrice: orderUnitPrice,
      total: subtotal,
      notes: buildOrderNotes(selectedModifiers, orderForm.notes),
      manualNotes: orderForm.notes.trim(),
      modifiers: selectedModifiers,
    }

    setOrderItems((currentItems) => [...currentItems, item])
    setOrderMessage({ ok: true, message: `${item.quantity}x ${item.name} adicionado ao pedido.` })
    resetItemForm()
  }

  function removeOrderItem(draftId) {
    setOrderItems((currentItems) => currentItems.filter((item) => item.draftId !== draftId))
  }

  async function handleCreateOrder(event) {
    event.preventDefault()
    if (manualOrderLoading) return
    if (!selectedCustomer) return
    if (orderItems.length === 0) {
      setOrderMessage({ ok: false, message: 'Adicione pelo menos um item antes de finalizar o pedido.' })
      return
    }

    const payload = {
      customerId: selectedCustomer.id,
      channel: orderForm.channel,
      campaign: selectedCampaign.label,
      discount: selectedCampaign.discount,
      items: orderItems,
    }
    setManualOrderLoading(true)
    setOrderMessage({ ok: true, message: 'Salvando delivery, cozinha e estoque...' })

    let result = null
    try {
      ;[result] = await Promise.all([
        Promise.resolve(onCreateOrder(payload)),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
    } catch (error) {
      result = { ok: false, message: error?.message ?? 'Nao foi possivel finalizar o pedido delivery.' }
    } finally {
      setManualOrderLoading(false)
    }

    setOrderMessage(result)
    setPendingOverride(result?.needsOverride ? payload : null)

    if (result?.ok) {
      if (activeWhatsAppMessageId && onUpdateWhatsAppMessageStatus) {
        onUpdateWhatsAppMessageStatus(activeWhatsAppMessageId, 'convertido')
      }
      setOrderItems([])
      setActiveWhatsAppMessageId(null)
      resetItemForm()
    }
  }

  async function handleApproveSiteDelivery(orderId, forceStock = false) {
    if (siteDeliveryActionLoading) return

    const actionKey = `${orderId}-${forceStock ? 'force' : 'normal'}`
    setSiteDeliveryActionLoading(actionKey)
    setSiteDeliveryMessage({ ok: true, message: 'Enviando pedido para a cozinha...' })

    try {
      const [result] = await Promise.all([
        Promise.resolve(onApproveClientDeliveryOrder?.(orderId, { forceStock })),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      setSiteDeliveryMessage(result ?? { ok: false, message: 'Nao foi possivel aprovar este pedido do site.' })
      setPendingSiteDeliveryOverride(result?.needsOverride ? orderId : null)
    } finally {
      setSiteDeliveryActionLoading(null)
    }
  }

  function handleRejectSiteDelivery(orderId) {
    const result = onRejectClientDeliveryOrder?.(orderId)
    setSiteDeliveryMessage(result ?? { ok: false, message: 'Nao foi possivel recusar este pedido do site.' })
    if (pendingSiteDeliveryOverride === orderId) setPendingSiteDeliveryOverride(null)
  }

  async function handleAdvanceDeliveryQueueOrder(orderId) {
    setDeliveryActionLoading(orderId)
    try {
      const result = await Promise.resolve(onAdvanceOrder?.(orderId))
      if (result) setOrderMessage(result)
    } catch (error) {
      setOrderMessage({ ok: false, message: error?.message ?? 'Nao foi possivel avancar este pedido.' })
    } finally {
      setDeliveryActionLoading(null)
    }
  }

  async function handleClearDeliveredQueue() {
    if (!onClearDeliveryQueue) return

    const dateKey = deliveryDateFilter === 'todos' ? '' : deliveryDateFilter
    const dateLabel = dateKey ? ` de ${formatDeliveryDateLabel(dateKey)}` : ''
    if (!window.confirm(`Limpar pedidos entregues${dateLabel} da fila de delivery?`)) return

    setDeliveryClearLoading('deliveries')
    try {
      const result = await onClearDeliveryQueue({ status: 'entregue', dateKey })
      setOrderMessage(result)
    } finally {
      setDeliveryClearLoading(null)
    }
  }

  async function handleClearSiteHistory() {
    if (!onClearClientDeliveryHistory) return

    const dateKey = deliveryDateFilter === 'todos' ? '' : deliveryDateFilter
    const dateLabel = dateKey ? ` de ${formatDeliveryDateLabel(dateKey)}` : ''
    if (!window.confirm(`Limpar historico do site${dateLabel}? Pedidos novos aguardando aprovacao serao mantidos.`)) return

    setDeliveryClearLoading('site-history')
    try {
      const result = await onClearClientDeliveryHistory({ dateKey })
      setSiteDeliveryMessage(result)
    } finally {
      setDeliveryClearLoading(null)
    }
  }

  async function handleForceCreateOrder() {
    if (!pendingOverride) return
    if (manualOrderLoading) return

    setManualOrderLoading(true)
    setOrderMessage({ ok: true, message: 'Salvando mesmo com alerta de estoque...' })

    let result = null
    try {
      ;[result] = await Promise.all([
        Promise.resolve(onCreateOrder(pendingOverride, { forceStock: true })),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
    } catch (error) {
      result = { ok: false, message: error?.message ?? 'Nao foi possivel finalizar o pedido delivery.' }
    } finally {
      setManualOrderLoading(false)
    }

    setOrderMessage(result)
    if (result?.ok) {
      if (activeWhatsAppMessageId && onUpdateWhatsAppMessageStatus) {
        onUpdateWhatsAppMessageStatus(activeWhatsAppMessageId, 'convertido')
      }
      setOrderItems([])
      setActiveWhatsAppMessageId(null)
      resetItemForm()
      setPendingOverride(null)
    }
  }

  function handlePrepareWhatsAppOrder(message) {
    const phone = normalizePhone(message.fromPhone)
    const existingCustomer = customers.find((customer) => normalizePhone(customer.phone).endsWith(phone.slice(-8)))
    const address = extractAddressFromMessage(message.body)
    const detectedItems = detectOrderItemsFromWhatsApp(message.body)

    if (existingCustomer) {
      setSelectedCustomerId(existingCustomer.id)
    } else {
      setCustomerForm({
        name: message.customerName || `Cliente ${phone.slice(-4)}`,
        phone,
        address,
        notes: `Origem WhatsApp. Mensagem: ${message.body}`,
      })
    }

    if (detectedItems.length > 0) {
      setOrderItems((currentItems) => [...currentItems, ...detectedItems])
    }

    setOrderForm((form) => ({
      ...form,
      channel: 'WhatsApp',
      notes: message.body,
    }))
    setActiveWhatsAppMessageId(message.id)
    setOrderMessage({
      ok: true,
      message: detectedItems.length > 0
        ? 'Mensagem carregada. Confira os itens antes de finalizar.'
        : 'Mensagem carregada. Selecione os itens do pedido antes de finalizar.',
    })

    if (onUpdateWhatsAppMessageStatus) {
      onUpdateWhatsAppMessageStatus(message.id, 'em_atendimento')
    }
  }

  function handleIgnoreWhatsAppMessage(messageId) {
    if (onUpdateWhatsAppMessageStatus) {
      onUpdateWhatsAppMessageStatus(messageId, 'ignorado')
    }
    if (activeWhatsAppMessageId === messageId) {
      setActiveWhatsAppMessageId(null)
    }
  }

  function handleCreateCustomer(event) {
    event.preventDefault()
    if (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.address.trim()) return

    const customer = onAddCustomer({
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
      notes: customerForm.notes.trim(),
    })

    setSelectedCustomerId(customer.id)
    setCustomerForm({ name: '', phone: '', address: '', notes: '' })
  }

  function toggleRemoval(removal) {
    setOrderForm((currentForm) => {
      const currentRemovals = currentForm.modifiers.removals
      const removals = currentRemovals.includes(removal)
        ? currentRemovals.filter((item) => item !== removal)
        : [...currentRemovals, removal]

      return { ...currentForm, modifiers: { ...currentForm.modifiers, removals } }
    })
  }

  function toggleAddition(additionId) {
    setOrderForm((currentForm) => {
      const currentAdditions = currentForm.modifiers.additions
      const additions = currentAdditions.includes(additionId)
        ? currentAdditions.filter((item) => item !== additionId)
        : [...currentAdditions, additionId]

      return { ...currentForm, modifiers: { ...currentForm.modifiers, additions } }
    })
  }

  return (
    <div className="delivery-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Pedidos ativos</span>
          <strong>{deliveries.filter((order) => order.status !== 'entregue').length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Clientes cadastrados</span>
          <strong>{customers.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Entregues</span>
          <strong>{deliveredOrders}</strong>
        </Card>
        <Card className="stat-card">
          <span>Ativos na fila</span>
          <strong>{deliveries.filter((order) => order.status !== 'entregue').length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Ticket medio</span>
          <strong>{currency.format(deliveries.length ? deliveries.reduce((sum, order) => sum + order.total, 0) / deliveries.length : 0)}</strong>
        </Card>
      </section>

      <Card className="wide-card site-delivery-admin-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Site Delivery</p>
            <h2>Pedidos online aguardando aprovacao</h2>
          </div>
          <span className="soft-label">{pendingClientDeliveryOrders.length} novo(s)</span>
        </div>

        {siteDeliveryMessage && (
          <div className={siteDeliveryMessage.ok ? 'form-hint' : 'form-alert'}>{siteDeliveryMessage.message}</div>
        )}

        {pendingClientDeliveryOrders.length === 0 ? (
          <p className="empty-state">Nenhum pedido do site aguardando aprovacao.</p>
        ) : (
          <div className="site-delivery-order-grid">
            {pendingClientDeliveryOrders.map((order) => (
              <article className="site-delivery-order-card" key={order.id}>
                <div>
                  <span>{order.id}</span>
                  <strong>{order.customerName}</strong>
                  <small>{order.phone}</small>
                </div>
                <p>{order.address}{order.complement ? ` - ${order.complement}` : ''}</p>
                <div className="qr-order-items">
                  {(order.items ?? []).map((item) => (
                    <span key={item.id}>{item.quantity}x {item.name}</span>
                  ))}
                </div>
                {order.notes && <small className="qr-order-note">{order.notes}</small>}
                <div className="site-delivery-total-row">
                  <span>{order.paymentMethod === 'link' ? 'Link Mercado Pago solicitado' : 'Pagar na entrega'}</span>
                  <strong>{currency.format(order.total || 0)}</strong>
                </div>
                <div className="row-actions">
                  <button
                    className="primary-button"
                    disabled={Boolean(siteDeliveryActionLoading)}
                    type="button"
                    onClick={() => handleApproveSiteDelivery(order.id)}
                  >
                    {siteDeliveryActionLoading === `${order.id}-normal` ? 'Enviando...' : 'Aprovar e enviar'}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={Boolean(siteDeliveryActionLoading)}
                    type="button"
                    onClick={() => handleApproveSiteDelivery(order.id, true)}
                  >
                    {siteDeliveryActionLoading === `${order.id}-force` ? 'Enviando...' : 'Aprovar sem estoque'}
                  </button>
                  <button className="ghost-button danger-button" disabled={Boolean(siteDeliveryActionLoading)} type="button" onClick={() => handleRejectSiteDelivery(order.id)}>
                    Recusar
                  </button>
                </div>
                {pendingSiteDeliveryOverride === order.id && (
                  <button className="secondary-button" type="button" onClick={() => handleApproveSiteDelivery(order.id, true)}>
                    Continuar mesmo sem estoque
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {processedClientDeliveryOrders.length > 0 && (
          <details className="qr-processed-list site-delivery-history">
            <summary>
              <strong>Historico do site</strong>
              <span>{processedClientDeliveryOrders.length} recentes</span>
            </summary>
            <div className="row-actions">
              <button className="ghost-button danger-button" disabled={deliveryClearLoading === 'site-history'} type="button" onClick={handleClearSiteHistory}>
                {deliveryClearLoading === 'site-history' ? 'Limpando...' : 'Limpar historico do site'}
              </button>
            </div>
            <div className="qr-processed-scroll">
              {processedClientDeliveryOrders.map((order) => (
                <span key={order.id}>{order.customerName}: {order.status} - {order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : 'sem data'}</span>
              ))}
            </div>
          </details>
        )}
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pedidos externos</p>
            <h2>Fila de delivery</h2>
          </div>
          <span className="soft-label">{visibleDeliveries.length} de {deliveries.length} pedidos</span>
        </div>
        <div className="delivery-queue-toolbar">
          <label>
            Buscar
            <input
              value={deliverySearch}
              onChange={(event) => setDeliverySearch(event.target.value)}
              placeholder="Nome, telefone, pedido, endereco ou item"
            />
          </label>
          <label>
            Dia
            <select value={deliveryDateFilter} onChange={(event) => setDeliveryDateFilter(event.target.value)}>
              <option value="todos">Todos os dias</option>
              {deliveryDateOptions.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {dateKey === todayDateKey ? `Hoje - ${formatDeliveryDateLabel(dateKey)}` : formatDeliveryDateLabel(dateKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={deliveryStatusFilter} onChange={(event) => setDeliveryStatusFilter(event.target.value)}>
              <option value="ativos">Ativos</option>
              <option value="novo">Novo</option>
              <option value="preparando">Preparando</option>
              <option value="pronto">Pronto</option>
              <option value="despachado">Em rota</option>
              <option value="entregue">Entregue</option>
              <option value="todos">Todos</option>
            </select>
          </label>
        </div>
        {orderMessage && <div className={orderMessage.ok ? 'form-hint' : 'form-alert'}>{orderMessage.message}</div>}
        <div className="responsive-table delivery-queue-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Canal</th>
              <th>Status</th>
              <th>Endereco</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {groupedDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="8">Nenhum pedido encontrado com os filtros atuais.</td>
                </tr>
              ) : groupedDeliveries.map((group) => (
                <Fragment key={group.dateKey}>
                  <tr className="delivery-date-row">
                    <td colSpan="8">{formatDeliveryDateLabel(group.dateKey)} - {group.orders.length} pedido(s)</td>
                  </tr>
                  {group.orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>
                        <strong>{order.customer}</strong>
                        {order.phone && <span className="muted">{order.phone}</span>}
                      </td>
                      <td>{order.channel}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>{order.address}</td>
                      <td>{(order.items ?? []).map((item) => `${item.quantity}x ${item.name}`).join(', ')}</td>
                      <td>{currency.format(order.total)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="ghost-button" type="button" onClick={() => setSelectedDeliveryOrderId(order.id)}>
                            Ver
                          </button>
                          <button
                            className="ghost-button"
                            disabled={order.status === 'entregue' || deliveryActionLoading === order.id}
                            type="button"
                            onClick={() => handleAdvanceDeliveryQueueOrder(order.id)}
                          >
                            {deliveryActionLoading === order.id ? 'Atualizando...' : order.status === 'entregue' ? 'Finalizado' : 'Avancar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {selectedDeliveryOrder && (
          <div className="delivery-detail-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Detalhes do pedido</p>
                <h3>{selectedDeliveryOrder.id} - {selectedDeliveryOrder.customer}</h3>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSelectedDeliveryOrderId(null)}>Fechar</button>
            </div>
            <div className="delivery-detail-grid">
              <div><span>Status</span><strong><StatusBadge status={selectedDeliveryOrder.status} /></strong></div>
              <div><span>Canal</span><strong>{selectedDeliveryOrder.channel}</strong></div>
              <div><span>Endereco</span><strong>{selectedDeliveryOrder.address}</strong></div>
              <div><span>Total</span><strong>{currency.format(selectedDeliveryOrder.total)}</strong></div>
              <div><span>Telefone</span><strong>{selectedDeliveryOrder.phone ?? '-'}</strong></div>
              <div><span>Pagamento</span><strong>{getDeliveryPaymentLabel(selectedDeliveryOrder)} / {selectedDeliveryOrder.paymentStatus ?? 'pendente'}</strong></div>
              <div><span>Previsao</span><strong>{selectedDeliveryOrder.eta ?? '-'}</strong></div>
            </div>
            <div className="delivery-detail-items">
              {(selectedDeliveryOrder.items ?? []).map((item) => (
                <article key={`${selectedDeliveryOrder.id}-${item.productId}-${item.name}`}>
                  <strong>{item.quantity}x {item.name}</strong>
                  <span>{currency.format(item.total || 0)}</span>
                  {(item.notes || item.manualNotes) && <small>{item.manualNotes || item.notes}</small>}
                </article>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Entrada manual</p>
            <h2>Novo pedido</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={handleCreateOrder}>
          <label>
            Cliente
            <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(Number(event.target.value))}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <label>
            Canal
            <select value={orderForm.channel} onChange={(event) => setOrderForm((form) => ({ ...form, channel: event.target.value }))}>
              {channels.map((channel) => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
          </label>
          <div className="menu-picker">
            <div className="segmented-control menu-category-tabs" aria-label="Categorias do cardapio delivery">
              {productCategories.map((category) => (
                <button
                  className={selectedCategory === category ? 'active' : ''}
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="menu-product-grid">
              {filteredProducts.map((product) => (
                <button
                  className={`menu-product-button ${Number(orderForm.productId) === product.id ? 'active' : ''}`}
                  key={product.id}
                  type="button"
                  onClick={() => setOrderForm((form) => ({ ...form, productId: product.id }))}
                >
                  <span>{product.category}</span>
                  <strong>{product.name}</strong>
                  <b>{currency.format(product.price)}</b>
                </button>
              ))}
            </div>
          </div>
          <label>
            Produto
            <select value={orderForm.productId} onChange={(event) => setOrderForm((form) => ({ ...form, productId: Number(event.target.value) }))}>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Quantidade
              <input min="1" step="1" type="number" value={orderForm.quantity} onChange={(event) => setOrderForm((form) => ({ ...form, quantity: event.target.value }))} />
            </label>
            <label>
              Campanha
              <select value={orderForm.campaign} onChange={(event) => setOrderForm((form) => ({ ...form, campaign: event.target.value }))}>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="modifier-panel">
            <div>
              <span>Ponto da carne</span>
              <div className="modifier-options">
                {meatPointOptions.map((option) => (
                  <button
                    className={orderForm.modifiers.meatPoint === option ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() =>
                      setOrderForm((form) => ({
                        ...form,
                        modifiers: {
                          ...form.modifiers,
                          meatPoint: form.modifiers.meatPoint === option ? '' : option,
                        },
                      }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>Remover</span>
              <div className="modifier-options">
                {removalOptions.map((option) => (
                  <button
                    className={orderForm.modifiers.removals.includes(option) ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() => toggleRemoval(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>Adicionais</span>
              <div className="modifier-options">
                {additionOptions.map((option) => (
                  <button
                    className={orderForm.modifiers.additions.includes(option.id) ? 'active' : ''}
                    key={option.id}
                    type="button"
                    onClick={() => toggleAddition(option.id)}
                  >
                    {option.label} +{currency.format(option.price)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label>
            Observacoes do item
            <textarea
              rows="3"
              value={orderForm.notes}
              onChange={(event) => setOrderForm((form) => ({ ...form, notes: event.target.value }))}
              placeholder="Ex.: entregar sem contato, carne ao ponto"
            />
          </label>
          <div className="form-hint">Item atual: {currency.format(subtotal)}</div>
          <div className="form-hint">
            Unitario: {currency.format(orderUnitPrice)}
            {modifiersUnitTotal > 0 ? ` (${currency.format(modifiersUnitTotal)} em adicionais)` : ''}
          </div>
          <div className={stockAvailability.available ? 'form-hint' : 'form-alert'}>
            {stockAvailability.message}
          </div>
          {orderMessage && (
            <div className={orderMessage.ok ? 'form-hint' : 'form-alert'}>{orderMessage.message}</div>
          )}
          {pendingOverride && (
            <button className="secondary-button" disabled={manualOrderLoading} type="button" onClick={handleForceCreateOrder}>
              {manualOrderLoading ? 'Salvando...' : 'Continuar mesmo assim'}
            </button>
          )}
          <div className="delivery-order-draft">
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">Pedido em montagem</p>
                <h2>{orderItems.length} itens</h2>
              </div>
              <strong>{currency.format(orderTotal)}</strong>
            </div>
            {orderItems.length === 0 ? (
              <p className="empty-state">Adicione os produtos antes de finalizar o pedido.</p>
            ) : (
              <div className="list-stack">
                {orderItems.map((item) => (
                  <div className="list-row draft-order-item" key={item.draftId}>
                    <div>
                      <strong>{item.quantity}x {item.name}</strong>
                      <span>{item.notes || 'Sem observacoes'}</span>
                    </div>
                    <div className="row-actions">
                      <b>{currency.format(item.total)}</b>
                      <button className="ghost-button" type="button" onClick={() => removeOrderItem(item.draftId)}>
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={handleAddItemToOrder}>
              Adicionar item
            </button>
            <button className="primary-button" disabled={manualOrderLoading} type="submit">
              {manualOrderLoading ? 'Salvando no sistema...' : 'Finalizar pedido delivery'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cliente</p>
            <h2>Cadastro rapido</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={handleCreateCustomer}>
          <label>Nome<input value={customerForm.name} onChange={(event) => setCustomerForm((form) => ({ ...form, name: event.target.value }))} /></label>
          <label>Telefone<input value={customerForm.phone} onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))} /></label>
          <label>Endereco<input value={customerForm.address} onChange={(event) => setCustomerForm((form) => ({ ...form, address: event.target.value }))} /></label>
          <label>Observacoes<input value={customerForm.notes} onChange={(event) => setCustomerForm((form) => ({ ...form, notes: event.target.value }))} /></label>
          <button className="secondary-button" type="submit">Cadastrar cliente</button>
        </form>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Relacionamento</p>
            <h2>{selectedCustomer?.name ?? 'Cliente'}</h2>
          </div>
        </div>
        {selectedCustomer && (
          <div className="customer-profile">
            <p>{selectedCustomer.phone}</p>
            <p>{selectedCustomer.address}</p>
            <p>{selectedCustomer.notes}</p>
            <div className="summary-stack">
              <div><span>Pedidos</span><strong>{customerStats.orders}</strong></div>
              <div><span>Total consumido</span><strong>{currency.format(customerStats.total)}</strong></div>
              <div><span>Preferencia</span><strong>{customerStats.favoriteItem}</strong></div>
            </div>
            <div className="campaign-box">
              <strong>Sugestao de campanha</strong>
              <span>{customerStats.orders >= 2 ? 'Enviar cupom Volte 10 pelo WhatsApp' : 'Enviar boas-vindas com combo promocional'}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
