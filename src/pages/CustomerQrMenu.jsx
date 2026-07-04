import { useEffect, useMemo, useRef, useState } from 'react'
import {
  appendClientQrOrder,
  getNextClientQrSessionExpiration,
  loadClientQrOrders,
  loadClientQrSession,
  saveClientQrSession,
} from '../lib/clientQrOrders.js'
import { buildOrderNotes, meatPointOptions } from '../lib/orderModifiers.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const allCategoriesLabel = 'Todos'
const clientQrDraftStoragePrefix = 'loccoburger_client_qr_draft_v1'
const defaultMeatPoint = 'Ao ponto'

function isBurgerProduct(product) {
  const text = `${product?.category ?? ''} ${product?.name ?? ''}`.toLowerCase()
  return text.includes('burger') || text.includes('hamburg') || text.includes('smash')
}

function getProductDescription(product) {
  if (product?.description) return product.description

  const name = String(product?.name ?? '').toLowerCase()
  if (name.includes('brie')) return 'Pao brioche, hamburguer artesanal, queijo brie, rucula, tomate cereja e maionese da casa.'
  if (name.includes('rustico')) return 'Blend na brasa com molho rustico, bacon, queijo e maionese artesanal.'
  if (name.includes('bacon')) return 'Hamburguer na brasa com bacon crocante, queijo derretido e molho da casa.'
  if (name.includes('cebola')) return 'Carne artesanal, cheddar, bacon e cebola caramelizada para um sabor mais marcante.'
  if (name.includes('tradicional')) return 'Classico da casa com pao brioche, carne artesanal, queijo, salada e maionese.'
  if (name.includes('cheddar')) return 'Carne na brasa, cheddar cremoso, bacon, cebola ao molho e maionese artesanal.'
  if (name.includes('smash')) return 'Smash selado na chapa, queijo cheddar, bacon, ketchup e mostarda.'
  if (name.includes('kids')) return 'Versao menor, simples e gostosa para criancas.'
  if (name.includes('batata')) return 'Porcao de batata crocante para acompanhar o lanche.'
  if (name.includes('refrigerante') || name.includes('suco') || name.includes('cerveja') || name.includes('agua')) return 'Bebida gelada para acompanhar seu pedido.'

  return 'Produto preparado pela LoccoBurger com sabor artesanal e ingredientes selecionados.'
}

function getTableNumberFromRoute() {
  if (typeof window === 'undefined') return '1'

  const params = new URLSearchParams(window.location.search)
  const queryTable = params.get('mesa') || params.get('table')
  if (queryTable) return String(queryTable).trim()

  const [, routeName, routeTable] = window.location.pathname.split('/')
  if (['mesa', 'cardapio-mesa', 'cardapio'].includes(routeName) && routeTable) return String(routeTable).trim()

  return '1'
}

function createSession(tableNumber, form) {
  return {
    id: `S-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    tableNumber,
    customerName: form.customerName.trim(),
    phone: form.phone.trim(),
    openedAt: new Date().toISOString(),
    expiresAt: getNextClientQrSessionExpiration(),
    closingRequested: false,
  }
}

function getClientQrDraftKey(tableNumber) {
  return `${clientQrDraftStoragePrefix}:${String(tableNumber || 'balcao').trim() || 'balcao'}`
}

function loadClientQrDraft(tableNumber) {
  if (typeof window === 'undefined') return {}

  try {
    const parsedDraft = JSON.parse(window.localStorage.getItem(getClientQrDraftKey(tableNumber)) ?? '{}')
    return parsedDraft && typeof parsedDraft === 'object' ? parsedDraft : {}
  } catch {
    return {}
  }
}

function saveClientQrDraft(tableNumber, draft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getClientQrDraftKey(tableNumber), JSON.stringify(draft))
}

function clearClientQrDraft(tableNumber) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getClientQrDraftKey(tableNumber))
}

export function CustomerQrMenu({ products = [] }) {
  const tableNumber = getTableNumberFromRoute()
  const savedSession = loadClientQrSession(tableNumber)
  const savedDraft = useMemo(() => loadClientQrDraft(tableNumber), [tableNumber])
  const [session, setSession] = useState(savedSession)
  const [customerForm, setCustomerForm] = useState({
    customerName: savedSession?.customerName ?? '',
    phone: savedSession?.phone ?? '',
    ...(savedSession ? {} : savedDraft.customerForm ?? {}),
  })
  const [selectedCategory, setSelectedCategory] = useState(savedDraft.selectedCategory ?? allCategoriesLabel)
  const [itemNotes, setItemNotes] = useState(savedDraft.itemNotes ?? '')
  const [cart, setCart] = useState(savedDraft.cart ?? [])
  const [cartToast, setCartToast] = useState(null)
  const [customizingProduct, setCustomizingProduct] = useState(null)
  const [customMeatPoint, setCustomMeatPoint] = useState(savedDraft.customMeatPoint ?? defaultMeatPoint)
  const [customItemNotes, setCustomItemNotes] = useState(savedDraft.customItemNotes ?? '')
  const [cartActionLoading, setCartActionLoading] = useState(false)
  const [qrScreen, setQrScreen] = useState(savedDraft.qrScreen ?? 'menu')
  const [isSendingOrder, setIsSendingOrder] = useState(false)
  const [lastSubmittedOrderId, setLastSubmittedOrderId] = useState(savedDraft.lastSubmittedOrderId ?? null)
  const [message, setMessage] = useState(null)
  const [ordersVersion, setOrdersVersion] = useState(0)
  const cartRef = useRef(null)
  const activeProducts = products.filter((product) => product.active)
  const categories = [
    allCategoriesLabel,
    ...Array.from(new Set(activeProducts.map((product) => product.category))).filter(Boolean),
  ]
  const visibleProducts = selectedCategory === allCategoriesLabel
    ? activeProducts
    : activeProducts.filter((product) => product.category === selectedCategory)
  const recentOrders = useMemo(
    () => loadClientQrOrders().filter((order) => order.sessionId === session?.id).slice(0, 5),
    [ordersVersion, session?.id],
  )
  const lastSubmittedOrder = recentOrders.find((order) => order.id === lastSubmittedOrderId) ?? recentOrders[0] ?? null
  const cartTotal = cart.reduce((total, item) => total + item.total, 0)
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    if (!cartToast) return undefined

    const timeoutId = window.setTimeout(() => setCartToast(null), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [cartToast])

  useEffect(() => {
    saveClientQrDraft(tableNumber, {
      customerForm,
      selectedCategory,
      customMeatPoint,
      customItemNotes,
      itemNotes,
      cart,
      qrScreen,
      lastSubmittedOrderId,
    })
  }, [cart, customerForm, customItemNotes, customMeatPoint, itemNotes, lastSubmittedOrderId, qrScreen, selectedCategory, tableNumber])

  useEffect(() => {
    const syncOrders = () => setOrdersVersion((version) => version + 1)
    const resetClosedSession = (event) => {
      const clearedTableNumber = event?.detail?.tableNumber ? String(event.detail.tableNumber) : ''
      if (clearedTableNumber && clearedTableNumber !== String(tableNumber)) return

      const currentStoredSession = loadClientQrSession(tableNumber)
      if (currentStoredSession) return

      clearClientQrDraft(tableNumber)
      setSession(null)
      setCart([])
      setItemNotes('')
      setCustomItemNotes('')
      setCustomizingProduct(null)
      setLastSubmittedOrderId(null)
      setQrScreen('menu')
      setMessage({ ok: true, text: 'Mesa liberada. Abra uma nova comanda para fazer outro pedido.' })
    }
    const intervalId = window.setInterval(syncOrders, 5000)
    window.addEventListener('storage', syncOrders)
    window.addEventListener('storage', resetClosedSession)
    window.addEventListener('loccoburger:client-qr-orders-updated', syncOrders)
    window.addEventListener('loccoburger:client-qr-session-cleared', resetClosedSession)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', syncOrders)
      window.removeEventListener('storage', resetClosedSession)
      window.removeEventListener('loccoburger:client-qr-orders-updated', syncOrders)
      window.removeEventListener('loccoburger:client-qr-session-cleared', resetClosedSession)
    }
  }, [tableNumber])

  function openSession(event) {
    event.preventDefault()

    if (!customerForm.customerName.trim() || !customerForm.phone.trim()) {
      setMessage({ ok: false, text: 'Informe seu nome e telefone para abrir a comanda.' })
      return
    }

    const nextSession = createSession(tableNumber, customerForm)
    saveClientQrSession(tableNumber, nextSession)
    setSession(nextSession)
    setQrScreen('menu')
    setMessage({ ok: true, text: `Comanda aberta para ${nextSession.customerName}.` })
  }

  function openProductCustomization(product) {
    setCustomizingProduct(product)
    setCustomMeatPoint(isBurgerProduct(product) ? defaultMeatPoint : '')
    setCustomItemNotes('')
  }

  function closeProductCustomization() {
    if (cartActionLoading) return
    setCustomizingProduct(null)
    setCustomMeatPoint(defaultMeatPoint)
    setCustomItemNotes('')
  }

  function addCustomizedProductToCart() {
    if (!customizingProduct || cartActionLoading) return

    const product = customizingProduct
    const needsMeatPoint = isBurgerProduct(product)
    if (needsMeatPoint && !customMeatPoint) {
      setMessage({ ok: false, text: 'Escolha o ponto da carne antes de adicionar.' })
      return
    }

    setCartActionLoading(true)
    setMessage(null)

    window.setTimeout(() => {
      const modifiers = needsMeatPoint
        ? { meatPoint: customMeatPoint, removals: [], additions: [] }
        : { meatPoint: '', removals: [], additions: [] }
      const notes = needsMeatPoint
        ? buildOrderNotes({ meatPoint: customMeatPoint, removals: [], additions: [] }, customItemNotes)
        : customItemNotes.trim()
      const unitPrice = Number(product.price || 0)

      setCart((currentCart) => ([
        ...currentCart,
        {
          id: `${Date.now()}-${product.id}-${Math.random().toString(16).slice(2, 7)}`,
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice,
          total: unitPrice,
          modifiers,
          notes,
          manualNotes: customItemNotes.trim(),
        },
      ]))
      setCartToast(`${product.name} adicionado ao carrinho.`)
      setCartActionLoading(false)
      setCustomizingProduct(null)
      setCustomMeatPoint(defaultMeatPoint)
      setCustomItemNotes('')
    }, 520)
  }

  function addToCart(product) {
    openProductCustomization(product)
  }

  function scrollToCart() {
    cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateCartItem(itemId, nextQuantity) {
    const quantity = Number(nextQuantity)
    if (quantity <= 0) {
      setCart((currentCart) => currentCart.filter((item) => item.id !== itemId))
      return
    }

    setCart((currentCart) =>
      currentCart.map((item) => (
        item.id === itemId ? { ...item, quantity, total: quantity * item.unitPrice } : item
      )),
    )
  }

  function sendOrder() {
    if (isSendingOrder) return

    if (!session) {
      setMessage({ ok: false, text: 'Abra sua comanda antes de enviar o pedido.' })
      return
    }

    if (cart.length === 0) {
      setMessage({ ok: false, text: 'Adicione pelo menos um item ao carrinho.' })
      return
    }

    const order = {
      id: `QR-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'pedido',
      status: 'novo',
      tableNumber,
      sessionId: session.id,
      customerName: session.customerName,
      phone: session.phone,
      createdAt: new Date().toISOString(),
      notes: itemNotes.trim(),
      items: cart.map((item) => ({
        ...item,
        notes: [item.notes, itemNotes.trim()].filter(Boolean).join(' | '),
      })),
      total: cartTotal,
    }

    setIsSendingOrder(true)
    setMessage({ ok: true, text: 'Enviando pedido para o atendimento...' })

    window.setTimeout(() => {
      appendClientQrOrder(order)
      setCart([])
      setItemNotes('')
      setLastSubmittedOrderId(order.id)
      setQrScreen('sent')
      setOrdersVersion((version) => version + 1)
      setIsSendingOrder(false)
      setMessage({ ok: true, text: 'Pedido enviado para o garcom aprovar.' })
    }, 650)
  }

  function requestClose() {
    if (!session) return

    appendClientQrOrder({
      id: `QR-F-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'fechamento',
      status: 'novo',
      tableNumber,
      sessionId: session.id,
      customerName: session.customerName,
      phone: session.phone,
      createdAt: new Date().toISOString(),
      items: [],
      total: 0,
      notes: 'Cliente solicitou fechamento da comanda pelo QR Code.',
    })

    const nextSession = { ...session, closingRequested: true }
    saveClientQrSession(tableNumber, nextSession)
    setSession(nextSession)
    setOrdersVersion((version) => version + 1)
    setMessage({ ok: true, text: 'Fechamento solicitado. Aguarde o atendimento.' })
  }

  return (
    <main className="client-menu-shell">
      <section className="client-menu-phone">
        <header className="client-menu-header">
          <span>Mesa {tableNumber}</span>
          <strong>LoccoBurger</strong>
          <small>Pedido digital</small>
        </header>

        {!session ? (
          <form className="client-login-card" onSubmit={openSession}>
            <p className="eyebrow">Abrir comanda</p>
            <h1>Informe seus dados para pedir na mesa.</h1>
            <label>
              Nome
              <input
                value={customerForm.customerName}
                onChange={(event) => setCustomerForm((form) => ({ ...form, customerName: event.target.value }))}
                placeholder="Ex.: Murilo"
              />
            </label>
            <label>
              Telefone
              <input
                inputMode="tel"
                value={customerForm.phone}
                onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </label>
            <button className="client-primary-button" type="submit">Abrir cardapio</button>
            {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
          </form>
        ) : (
          <>
            <section className="client-hero-card">
              <div>
                <p className="eyebrow">Pedido de {session.customerName}</p>
                <h1>Escolha seu burger favorito.</h1>
                <span>Seu pedido vai para o garcom aprovar antes da cozinha.</span>
              </div>
              <img src="/locco-site/hero-burger-v2.png" alt="" />
            </section>

            {isSendingOrder && (
              <section className="client-fullscreen-feedback" role="status" aria-live="polite">
                <span className="client-loading-ring" aria-hidden="true" />
                <p className="eyebrow">Enviando para atendimento</p>
                <h2>Registrando pedido da mesa {tableNumber}...</h2>
                <strong>O garcom recebe para aprovar e mandar para a cozinha.</strong>
              </section>
            )}

            {cartActionLoading && (
              <section className="client-fullscreen-feedback client-cart-loading-feedback" role="status" aria-live="polite">
                <span className="client-loading-ring" aria-hidden="true" />
                <p className="eyebrow">Adicionando ao carrinho</p>
                <h2>Salvando seu item...</h2>
                <strong>Estamos guardando ponto da carne, observacao e valor do pedido.</strong>
              </section>
            )}

            <div className="client-mini-nav">
              <button type="button" onClick={() => setQrScreen('menu')}>Cardapio</button>
              <button type="button" onClick={() => setQrScreen('history')}>Minha comanda</button>
            </div>

            {qrScreen === 'sent' && (
              <section className="client-order-sent-card">
                <span className="client-sent-icon">✓</span>
                <p className="eyebrow">Pedido enviado</p>
                <h2>Seu pedido foi para o garcom aprovar.</h2>
                {lastSubmittedOrder ? (
                  <div className="client-sent-summary">
                    <strong>{lastSubmittedOrder.id}</strong>
                    <span>{currency.format(lastSubmittedOrder.total || 0)}</span>
                    <small>Status atual: {lastSubmittedOrder.status}</small>
                  </div>
                ) : (
                  <p className="empty-state">Pedido registrado. Acompanhe pela sua comanda.</p>
                )}
                <div className="client-sent-actions">
                  <button className="client-primary-button" type="button" onClick={() => setQrScreen('history')}>
                    Acompanhar comanda
                  </button>
                  <button className="client-secondary-button" type="button" onClick={() => setQrScreen('menu')}>
                    Fazer outro pedido
                  </button>
                </div>
              </section>
            )}

            {qrScreen === 'menu' && (
              <>
                {cartToast && (
                  <div className="client-cart-toast" role="status" aria-live="polite">
                    {cartToast}
                  </div>
                )}

                <button
                  className={`client-cart-shortcut ${cartItemCount > 0 ? 'has-items' : ''}`}
                  disabled={cartItemCount === 0}
                  type="button"
                  onClick={scrollToCart}
                >
                  <span>Carrinho</span>
                  <strong>{cartItemCount > 0 ? `${cartItemCount} item(ns)` : 'Vazio'}</strong>
                  <b>{currency.format(cartTotal)}</b>
                </button>

                <div className="client-category-tabs">
                  {categories.map((category) => (
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

                <section className="client-product-grid">
                  {visibleProducts.map((product) => (
                    <article className="client-product-card" key={product.id}>
                      <img src={product.category === 'Porcao' ? '/locco-site/order-burger-drip-v1.png' : '/locco-site/hero-burger-v2.png'} alt="" />
                      <div>
                        <span>{product.category}</span>
                        <strong>{product.name}</strong>
                        <p>{getProductDescription(product)}</p>
                        <small>{currency.format(product.price)}</small>
                      </div>
                      <button type="button" onClick={() => addToCart(product)}>+</button>
                    </article>
                  ))}
                </section>

                {customizingProduct && (
                  <section className="client-product-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Adicionar ${customizingProduct.name}`}>
                    <div className="client-product-modal">
                      <button className="client-modal-close" disabled={cartActionLoading} type="button" onClick={closeProductCustomization}>x</button>
                      <div className="client-product-modal-head">
                        <img src={customizingProduct.category === 'Porcao' ? '/locco-site/order-burger-drip-v1.png' : '/locco-site/hero-burger-v2.png'} alt="" />
                        <div>
                          <p className="eyebrow">{customizingProduct.category}</p>
                          <h2>{customizingProduct.name}</h2>
                          <strong>{currency.format(customizingProduct.price)}</strong>
                        </div>
                      </div>
                      <p className="client-product-modal-description">{getProductDescription(customizingProduct)}</p>

                      {isBurgerProduct(customizingProduct) && (
                        <div className="client-meat-point-picker">
                          <span>Ponto da carne</span>
                          <div>
                            {meatPointOptions.map((option) => (
                              <button
                                className={customMeatPoint === option ? 'active' : ''}
                                key={option}
                                type="button"
                                onClick={() => setCustomMeatPoint(option)}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          <small>Padrao da casa: Ao ponto. Escolha o ponto antes de enviar para a cozinha.</small>
                        </div>
                      )}

                      <label className="client-item-note-field">
                        Observacao do item
                        <textarea
                          rows="3"
                          value={customItemNotes}
                          onChange={(event) => setCustomItemNotes(event.target.value)}
                          placeholder="Ex.: sem cebola, maionese a parte, cortar ao meio..."
                        />
                      </label>

                      <button className="client-primary-button" disabled={cartActionLoading} type="button" onClick={addCustomizedProductToCart}>
                        {cartActionLoading ? 'Adicionando...' : 'Adicionar ao carrinho'}
                      </button>
                    </div>
                  </section>
                )}

                <section className="client-cart-card" ref={cartRef}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Carrinho</p>
                      <h2>{cart.length} item(ns)</h2>
                    </div>
                    <strong>{currency.format(cartTotal)}</strong>
                  </div>

                  {cart.length === 0 ? (
                    <p className="empty-state">Adicione itens para enviar o pedido.</p>
                  ) : (
                    <div className="client-cart-list">
                      {cart.map((item) => (
                        <div className="client-cart-row" key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{currency.format(item.unitPrice)} cada</span>
                            {item.notes && <small>{item.notes}</small>}
                          </div>
                          <button type="button" onClick={() => updateCartItem(item.id, item.quantity - 1)}>-</button>
                          <b>{item.quantity}</b>
                          <button type="button" onClick={() => updateCartItem(item.id, item.quantity + 1)}>+</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label>
                    Observacao para o pedido
                    <textarea
                      rows="3"
                      value={itemNotes}
                      onChange={(event) => setItemNotes(event.target.value)}
                      placeholder="Ex.: sem cebola, batata para agora..."
                    />
                  </label>

                  <button className="client-primary-button" disabled={isSendingOrder} type="button" onClick={sendOrder}>
                    {isSendingOrder ? 'Enviando...' : 'Enviar pedido'}
                  </button>
                  <button className="client-secondary-button" disabled={session.closingRequested} type="button" onClick={requestClose}>
                    {session.closingRequested ? 'Fechamento solicitado' : 'Solicitar fechamento'}
                  </button>
                  {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
                </section>
              </>
            )}

            {qrScreen === 'history' && (
            <section className="client-history-card">
              <p className="eyebrow">Minha comanda</p>
              <h2>Ultimos envios</h2>
              {recentOrders.length === 0 ? (
                <p className="empty-state">Nenhum pedido enviado ainda.</p>
              ) : recentOrders.map((order) => (
                <div className="client-history-row" key={order.id}>
                  <span>{order.type === 'fechamento' ? 'Fechamento' : `${order.items.length} item(ns)`}</span>
                  <strong>{order.status}</strong>
                  <b>{currency.format(order.total || 0)}</b>
                </div>
              ))}
            </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}
