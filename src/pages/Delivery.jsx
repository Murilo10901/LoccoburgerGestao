import { useMemo, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
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

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '')
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
  customers,
  deliveries,
  inventoryItems,
  onAddCustomer,
  onAdvanceOrder,
  onCreateOrder,
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
  const [pendingOverride, setPendingOverride] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [activeWhatsAppMessageId, setActiveWhatsAppMessageId] = useState(null)

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

  function handleCreateOrder(event) {
    event.preventDefault()
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
    const result = onCreateOrder(payload)
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

  function handleForceCreateOrder() {
    if (!pendingOverride) return

    const result = onCreateOrder(pendingOverride, { forceStock: true })
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
          <span>WhatsApp pendentes</span>
          <strong>{pendingWhatsAppMessages}</strong>
        </Card>
        <Card className="stat-card">
          <span>Ticket medio</span>
          <strong>{currency.format(deliveries.length ? deliveries.reduce((sum, order) => sum + order.total, 0) / deliveries.length : 0)}</strong>
        </Card>
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Integracao WhatsApp</p>
            <h2>Entrada de mensagens</h2>
          </div>
          <span className="soft-label">{pendingWhatsAppMessages} pendentes</span>
        </div>
        <div className="integration-callout">
          <div>
            <strong>Webhook do LoccoBurger</strong>
            <span>{whatsappWebhookUrl}</span>
          </div>
          <small>Use esta URL na configuracao do WhatsApp Cloud API. As mensagens recebidas aparecem abaixo para conferencia.</small>
        </div>
        {actionableWhatsAppMessages.length === 0 ? (
          <p className="empty-state">Nenhuma mensagem pendente do WhatsApp.</p>
        ) : (
          <div className="whatsapp-inbox-grid">
            {actionableWhatsAppMessages.map((message) => (
              <div className="whatsapp-message-card" key={message.id}>
                <div>
                  <strong>{message.customerName || 'Cliente WhatsApp'}</strong>
                  <span>{message.fromPhone}</span>
                </div>
                <p>{message.body}</p>
                <div className="row-actions">
                  <StatusBadge status={message.status} />
                  <button className="secondary-button" type="button" onClick={() => handlePrepareWhatsAppOrder(message)}>
                    Montar pedido
                  </button>
                  <button className="ghost-button" type="button" onClick={() => handleIgnoreWhatsAppMessage(message.id)}>
                    Ignorar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pedidos externos</p>
            <h2>Fila de delivery</h2>
          </div>
          <span className="soft-label">{deliveries.length} pedidos</span>
        </div>
        <div className="responsive-table">
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
              {deliveries.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.customer}</td>
                  <td>{order.channel}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{order.address}</td>
                  <td>{(order.items ?? []).map((item) => `${item.quantity}x ${item.name}`).join(', ')}</td>
                  <td>{currency.format(order.total)}</td>
                  <td>
                    <button className="ghost-button" type="button" onClick={() => onAdvanceOrder(order.id)}>
                      Avancar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <button className="secondary-button" type="button" onClick={handleForceCreateOrder}>
              Continuar mesmo assim
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
            <button className="primary-button" type="submit">Finalizar pedido delivery</button>
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
