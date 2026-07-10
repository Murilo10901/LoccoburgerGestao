import { useEffect, useMemo, useRef, useState } from 'react'
import {
  appendClientQrOrder,
  clearClientQrSession,
  closeClientQrBroadcastChannel,
  createClientQrBroadcastChannel,
  getClientQrSessionIdentity,
  getNextClientQrSessionExpiration,
  loadActiveClientQrSessionIdentity,
  loadClientQrOrders,
  loadClientQrSession,
  mergeAndSaveClientQrOrders,
  normalizeClientQrPhone,
  normalizeClientQrText,
  publishClientQrOrderReliable,
  publishClientQrOrders,
  publishClientQrOrdersRequest,
  saveActiveClientQrSessionIdentity,
  saveClientQrSession,
  updateClientQrOrder,
} from '../lib/clientQrOrders.js'
import {
  insertClientQrOrderToSupabase,
  loadClientQrOrdersForCustomerFromSupabase,
  persistClientQrOrderToSupabaseReliable,
} from '../lib/clientQrSupabaseRepository.js'
import { buildOrderNotes, meatPointOptions } from '../lib/orderModifiers.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const allCategoriesLabel = 'Todos'
const clientQrDraftStoragePrefix = 'loccoburger_client_qr_draft_v1'
const defaultMeatPoint = 'Ao ponto'

function formatOrderTime(order) {
  if (!order?.createdAt) return ''

  try {
    return new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function getOrderStatusText(status) {
  const labels = {
    novo: 'Aguardando aprovação',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
    erro: 'Erro',
    fechado: 'Fechado',
    pago: 'Pago',
    cancelado: 'Cancelado',
  }

  return labels[status] ?? status
}

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

function getOrderSessionIdentity(order = {}) {
  return order.sessionIdentity || getClientQrSessionIdentity({
    customerName: order.customerName,
    phone: order.phone,
  })
}

function orderBelongsToCustomer(order, tableNumber, identity, form = {}) {
  if (String(order?.tableNumber ?? '').trim() !== String(tableNumber ?? '').trim()) return false

  const orderIdentity = getOrderSessionIdentity(order)
  if (identity && orderIdentity && orderIdentity === identity) return true

  const formPhone = normalizeClientQrPhone(form.phone)
  const orderPhone = normalizeClientQrPhone(order.phone)
  if (formPhone.length >= 8 && orderPhone.length >= 8 && formPhone.slice(-8) === orderPhone.slice(-8)) return true

  const formName = normalizeClientQrText(form.customerName)
  const orderName = normalizeClientQrText(order.customerName)
  return Boolean(formName && orderName && formName === orderName)
}

function isClosedQrOrderStatus(status) {
  return ['fechado', 'pago', 'recusado', 'erro', 'cancelado'].includes(String(status ?? '').toLowerCase())
}

function isActiveCloseRequest(order) {
  return order?.type === 'fechamento' && !['recusado', 'erro', 'pago', 'fechado', 'cancelado'].includes(String(order.status ?? '').toLowerCase())
}

function orderBelongsToCurrentSession(order, tableNumber, session) {
  if (!session) return false
  if (String(order?.tableNumber ?? '').trim() !== String(tableNumber ?? '').trim()) return false

  const currentSessionId = String(session.id ?? '').trim()
  const orderSessionId = String(order?.sessionId ?? '').trim()
  if (currentSessionId && orderSessionId && currentSessionId === orderSessionId) return true

  const sessionIdentity = getClientQrSessionIdentity(session)
  return Boolean(!orderSessionId && sessionIdentity && getOrderSessionIdentity(order) === sessionIdentity)
}

function findRestorableClientQrSession(tableNumber, form) {
  const identity = getClientQrSessionIdentity(form)
  const storedSession = identity ? loadClientQrSession(tableNumber, identity) : null
  if (storedSession) return storedSession

  const matchingOrders = loadClientQrOrders()
    .filter((order) => orderBelongsToCustomer(order, tableNumber, identity, form))
    .sort((first, second) => new Date(second.createdAt ?? 0).getTime() - new Date(first.createdAt ?? 0).getTime())

  const openCloseRequest = matchingOrders.find(isActiveCloseRequest)
  const activeOrder = matchingOrders.find((order) => order.sessionId && !isClosedQrOrderStatus(order.status))
  const sourceOrder = activeOrder ?? openCloseRequest
  if (!sourceOrder) return null

  return {
    id: sourceOrder.sessionId,
    tableNumber: String(tableNumber ?? '').trim(),
    customerName: sourceOrder.customerName || form.customerName.trim(),
    phone: sourceOrder.phone || form.phone.trim(),
    openedAt: sourceOrder.createdAt || new Date().toISOString(),
    expiresAt: getNextClientQrSessionExpiration(),
    closingRequested: Boolean(openCloseRequest),
  }
}

function getClientQrDraftKey(tableNumber, identity = '') {
  const tableStorageId = String(tableNumber || 'balcao').trim() || 'balcao'
  const identityKey = String(identity ?? '').trim()
  return `${clientQrDraftStoragePrefix}:${tableStorageId}${identityKey ? `:${identityKey}` : ''}`
}

function loadClientQrDraft(tableNumber, identity = '') {
  if (typeof window === 'undefined') return {}

  try {
    const parsedDraft = JSON.parse(window.localStorage.getItem(getClientQrDraftKey(tableNumber, identity)) ?? '{}')
    return parsedDraft && typeof parsedDraft === 'object' ? parsedDraft : {}
  } catch {
    return {}
  }
}

function saveClientQrDraft(tableNumber, draft, identity = '') {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getClientQrDraftKey(tableNumber, identity), JSON.stringify(draft))
}

function clearClientQrDraft(tableNumber, identity = '') {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getClientQrDraftKey(tableNumber, identity))
}

export function CustomerQrMenu({ products = [] }) {
  const tableNumber = getTableNumberFromRoute()
  const savedSession = useMemo(() => {
    const activeIdentity = loadActiveClientQrSessionIdentity(tableNumber)
    return activeIdentity ? loadClientQrSession(tableNumber, activeIdentity) : null
  }, [tableNumber])
  const savedSessionIdentity = getClientQrSessionIdentity(savedSession ?? {})
  const savedDraft = useMemo(() => loadClientQrDraft(tableNumber, savedSessionIdentity), [savedSessionIdentity, tableNumber])
  const [session, setSession] = useState(savedSession)
  const [customerForm, setCustomerForm] = useState({
    customerName: savedSession?.customerName ?? savedDraft.customerForm?.customerName ?? '',
    phone: savedSession?.phone ?? savedDraft.customerForm?.phone ?? '',
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
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] = useState(savedDraft.selectedHistoryOrderId ?? null)
  const [message, setMessage] = useState(null)
  const [ordersVersion, setOrdersVersion] = useState(0)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [isRequestingClose, setIsRequestingClose] = useState(false)
  const [isCancelingClose, setIsCancelingClose] = useState(false)
  const cartRef = useRef(null)
  const sessionRef = useRef(session)
  const activeProducts = products.filter((product) => product.active && (product.availableChannels?.qr ?? true))
  const categories = [
    allCategoriesLabel,
    ...Array.from(new Set(activeProducts.map((product) => product.category))).filter(Boolean),
  ]
  const visibleProducts = selectedCategory === allCategoriesLabel
    ? activeProducts
    : activeProducts.filter((product) => product.category === selectedCategory)
  const recentOrders = useMemo(() => loadClientQrOrders()
    .filter((order) => orderBelongsToCurrentSession(order, tableNumber, session))
    .slice(0, 12), [ordersVersion, session?.customerName, session?.id, session?.phone, tableNumber])
  const activeCloseRequest = recentOrders.find(isActiveCloseRequest)
  const hasActiveCloseRequest = Boolean(activeCloseRequest)
  const canCancelCloseRequest = String(activeCloseRequest?.status ?? '').toLowerCase() === 'novo'
  const hasCompletedCloseRequest = recentOrders.some((order) =>
    order.type === 'fechamento' && ['pago', 'fechado'].includes(String(order.status ?? '').toLowerCase()),
  )
  const sessionClosingRequested = Boolean(session?.closingRequested || hasActiveCloseRequest)
  const sessionOpenTotal = recentOrders
    .filter((order) => order.type !== 'fechamento' && !isClosedQrOrderStatus(order.status))
    .reduce((total, order) => total + Number(order.total || 0), 0)
  const lastSubmittedOrder = recentOrders.find((order) => order.id === lastSubmittedOrderId) ?? recentOrders[0] ?? null
  const selectedHistoryOrder = recentOrders.find((order) => order.id === selectedHistoryOrderId) ?? null
  const cartTotal = cart.reduce((total, item) => total + item.total, 0)
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    const identity = getClientQrSessionIdentity(session ?? {})
    if (identity) saveActiveClientQrSessionIdentity(tableNumber, identity)
  }, [session, tableNumber])

  useEffect(() => {
    if (!session || !hasCompletedCloseRequest || hasActiveCloseRequest) return

    const identity = getClientQrSessionIdentity(session)
    clearClientQrSession(tableNumber, session)
    clearClientQrDraft(tableNumber, identity)
    setSession(null)
    setCart([])
    setItemNotes('')
    setCustomItemNotes('')
    setCustomizingProduct(null)
    setLastSubmittedOrderId(null)
    setSelectedHistoryOrderId(null)
    setQrScreen('menu')
    setMessage({ ok: true, text: 'Pagamento confirmado. A comanda foi encerrada e a mesa esta liberada.' })
  }, [hasActiveCloseRequest, hasCompletedCloseRequest, session, tableNumber])

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
      selectedHistoryOrderId,
    }, getClientQrSessionIdentity(session ?? {}))
  }, [cart, customerForm, customItemNotes, customMeatPoint, itemNotes, lastSubmittedOrderId, qrScreen, selectedCategory, selectedHistoryOrderId, session, tableNumber])

  async function syncRemoteCustomerOrders(identity = getClientQrSessionIdentity(sessionRef.current ?? {})) {
    const safeIdentity = String(identity ?? '').trim()
    if (!safeIdentity) return []

    const result = await loadClientQrOrdersForCustomerFromSupabase({
      tableNumber,
      sessionIdentity: safeIdentity,
      limit: 80,
    })

    if (!result.ok || !result.orders.length) return []

    mergeAndSaveClientQrOrders(result.orders)
    setOrdersVersion((version) => version + 1)

    const currentSession = sessionRef.current
    const activeCloseOrder = result.orders.find(isActiveCloseRequest)
    if (currentSession && activeCloseOrder && !currentSession.closingRequested) {
      const nextSession = { ...currentSession, closingRequested: true }
      saveClientQrSession(tableNumber, nextSession)
      setSession(nextSession)
    }

    return result.orders
  }

  useEffect(() => {
    if (!session) return undefined

    let active = true
    const identity = getClientQrSessionIdentity(session)
    const syncRemote = async () => {
      const result = await loadClientQrOrdersForCustomerFromSupabase({
        tableNumber,
        sessionIdentity: identity,
        limit: 80,
      })

      if (!active || !result.ok || !result.orders.length) return

      mergeAndSaveClientQrOrders(result.orders)
      setOrdersVersion((version) => version + 1)

      const currentSession = sessionRef.current
      const activeCloseOrder = result.orders.find(isActiveCloseRequest)
      if (currentSession && activeCloseOrder && !currentSession.closingRequested) {
        const nextSession = { ...currentSession, closingRequested: true }
        saveClientQrSession(tableNumber, nextSession)
        setSession(nextSession)
      }
    }

    syncRemote()
    const intervalId = window.setInterval(syncRemote, 9000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [session?.customerName, session?.id, session?.phone, tableNumber])

  useEffect(() => {
    const syncOrders = () => setOrdersVersion((version) => version + 1)
    const mergeIncomingOrders = (incomingOrders) => {
      const currentSession = sessionRef.current
      const currentSessionId = currentSession?.id
      const currentIdentity = getClientQrSessionIdentity(currentSession ?? {})
      const relevantOrders = incomingOrders.filter((order) => {
        if (String(order?.tableNumber ?? '') !== String(tableNumber)) return false
        if (currentSessionId && order.sessionId === currentSessionId) return true
        if (currentIdentity && getOrderSessionIdentity(order) === currentIdentity) return true
        return false
      })

      if (!relevantOrders.length) return
      mergeAndSaveClientQrOrders(relevantOrders)
      syncOrders()
    }
    const resetClosedSession = (event) => {
      const clearedTableNumber = event?.detail?.tableNumber ? String(event.detail.tableNumber) : ''
      if (clearedTableNumber && clearedTableNumber !== String(tableNumber)) return
      const clearedIdentity = event?.detail?.identity ? String(event.detail.identity) : ''
      const currentSession = sessionRef.current
      const currentIdentity = getClientQrSessionIdentity(currentSession ?? {})
      if (clearedIdentity && currentIdentity && clearedIdentity !== currentIdentity) return

      const currentStoredSession = currentIdentity
        ? loadClientQrSession(tableNumber, currentIdentity)
        : loadClientQrSession(tableNumber)
      if (currentStoredSession) return

      clearClientQrDraft(tableNumber, currentIdentity)
      setSession(null)
      setCart([])
      setItemNotes('')
      setCustomItemNotes('')
      setCustomizingProduct(null)
      setLastSubmittedOrderId(null)
      setSelectedHistoryOrderId(null)
      setQrScreen('menu')
      setMessage({ ok: true, text: 'Mesa liberada. Abra uma nova comanda para fazer outro pedido.' })
    }
    const intervalId = window.setInterval(syncOrders, 5000)
    const realtimeChannel = createClientQrBroadcastChannel({
      onOrder: (incomingOrder) => mergeIncomingOrders([incomingOrder]),
      onOrdersUpdated: mergeIncomingOrders,
      onSyncRequest: (payload = {}) => {
        const criteria = payload?.criteria ?? payload ?? {}
        const requestedTable = String(criteria.tableNumber ?? '').trim()
        if (requestedTable && requestedTable !== String(tableNumber)) return

        const currentSession = sessionRef.current
        const currentIdentity = getClientQrSessionIdentity(currentSession ?? {})
        if (!currentIdentity) return

        const currentOrders = loadClientQrOrders().filter((order) => (
          String(order?.tableNumber ?? '').trim() === String(tableNumber) &&
          getOrderSessionIdentity(order) === currentIdentity
        ))

        if (currentOrders.length) publishClientQrOrders(currentOrders).catch(() => {})
      },
    })
    const syncRequestId = window.setTimeout(() => {
      publishClientQrOrdersRequest({ tableNumber }).catch(() => {})
    }, 450)

    window.addEventListener('storage', syncOrders)
    window.addEventListener('storage', resetClosedSession)
    window.addEventListener('loccoburger:client-qr-orders-updated', syncOrders)
    window.addEventListener('loccoburger:client-qr-session-cleared', resetClosedSession)
    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(syncRequestId)
      closeClientQrBroadcastChannel(realtimeChannel)
      window.removeEventListener('storage', syncOrders)
      window.removeEventListener('storage', resetClosedSession)
      window.removeEventListener('loccoburger:client-qr-orders-updated', syncOrders)
      window.removeEventListener('loccoburger:client-qr-session-cleared', resetClosedSession)
    }
  }, [tableNumber])

  async function openSession(event) {
    event.preventDefault()

    if (!customerForm.customerName.trim() || !customerForm.phone.trim()) {
      setMessage({ ok: false, text: 'Informe seu nome e telefone para abrir a comanda.' })
      return
    }

    const identity = getClientQrSessionIdentity(customerForm)
    setMessage({ ok: true, text: 'Conferindo se existe comanda aberta para este telefone...' })
    await syncRemoteCustomerOrders(identity)

    const restoredSession = findRestorableClientQrSession(tableNumber, customerForm)
    const nextSession = restoredSession ?? createSession(tableNumber, customerForm)
    saveClientQrSession(tableNumber, nextSession)
    saveActiveClientQrSessionIdentity(tableNumber, getClientQrSessionIdentity(nextSession))
    setSession(nextSession)
    setCustomerForm({
      customerName: nextSession.customerName,
      phone: nextSession.phone,
    })
    setQrScreen(nextSession.closingRequested ? 'history' : 'menu')
    setCart([])
    setItemNotes('')
    setCustomItemNotes('')
    setCustomizingProduct(null)
    setLastSubmittedOrderId(null)
    setSelectedHistoryOrderId(null)
    setOrdersVersion((version) => version + 1)
    window.setTimeout(() => {
      publishClientQrOrdersRequest({
        tableNumber,
        sessionIdentity: getClientQrSessionIdentity(nextSession),
      }).catch(() => {})
    }, 350)
    setMessage({
      ok: true,
      text: restoredSession
        ? nextSession.closingRequested
          ? `Comanda de ${nextSession.customerName} esta em fechamento. Va ao caixa para acertar.`
          : `Comanda de ${nextSession.customerName} recuperada.`
        : `Comanda aberta para ${nextSession.customerName}.`,
    })
  }

  function openProductCustomization(product) {
    if (sessionClosingRequested) {
      setMessage({ ok: false, text: 'Sua comanda esta em fechamento. Procure o caixa para liberar uma nova sessao.' })
      setQrScreen('history')
      return
    }

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
    if (sessionClosingRequested) {
      setMessage({ ok: false, text: 'Sua comanda esta em fechamento. Procure o caixa para liberar uma nova sessao.' })
      setQrScreen('history')
      return
    }

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

  async function sendOrder() {
    if (isSendingOrder) return

    if (!session) {
      setMessage({ ok: false, text: 'Abra sua comanda antes de enviar o pedido.' })
      return
    }

    if (sessionClosingRequested) {
      setMessage({ ok: false, text: 'Sua comanda esta em fechamento. Depois do pagamento, abra uma nova comanda para pedir novamente.' })
      setQrScreen('history')
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
      sessionIdentity: getClientQrSessionIdentity(session),
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
    appendClientQrOrder(order)
    publishClientQrOrderReliable(order, { attempts: 8, intervalMs: 700 })
    const remoteResult = await insertClientQrOrderToSupabase(order)
    if (!remoteResult.ok) {
      persistClientQrOrderToSupabaseReliable(order, { operation: 'insert', attempts: 5, intervalMs: 1300 })
    }

    window.setTimeout(() => {
      setCart([])
      setItemNotes('')
      setLastSubmittedOrderId(order.id)
      setSelectedHistoryOrderId(order.id)
      setQrScreen('sent')
      setOrdersVersion((version) => version + 1)
      setIsSendingOrder(false)
      setMessage(remoteResult.ok
        ? { ok: true, text: 'Pedido enviado para o garcom aprovar.' }
        : { ok: false, text: 'Pedido salvo neste aparelho, mas ainda nao confirmou no banco. Confira a internet ou chame o atendimento.' })
    }, 650)
  }

  function requestClose() {
    if (!session) return
    if (sessionClosingRequested || isRequestingClose) return
    setCloseConfirmationOpen(true)
  }

  async function confirmRequestClose() {
    if (!session || isRequestingClose) return

    const closeOrder = {
      id: `QR-F-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'fechamento',
      status: 'novo',
      tableNumber,
      sessionId: session.id,
      sessionIdentity: getClientQrSessionIdentity(session),
      customerName: session.customerName,
      phone: session.phone,
      createdAt: new Date().toISOString(),
      items: [],
      total: 0,
      notes: 'Cliente solicitou fechamento da comanda pelo QR Code.',
    }

    setIsRequestingClose(true)
    setMessage({ ok: true, text: 'Enviando solicitacao de fechamento para o caixa...' })
    appendClientQrOrder(closeOrder)
    publishClientQrOrderReliable(closeOrder, { attempts: 8, intervalMs: 700 })
    const remoteResult = await insertClientQrOrderToSupabase(closeOrder)
    if (!remoteResult.ok) {
      persistClientQrOrderToSupabaseReliable(closeOrder, { operation: 'insert', attempts: 5, intervalMs: 1300 })
    }

    const nextSession = { ...session, closingRequested: true }
    saveClientQrSession(tableNumber, nextSession)
    setSession(nextSession)
    setCart([])
    setItemNotes('')
    setSelectedHistoryOrderId(closeOrder.id)
    setOrdersVersion((version) => version + 1)
    setCloseConfirmationOpen(false)
    window.setTimeout(() => {
      setIsRequestingClose(false)
      setQrScreen('history')
      setMessage(remoteResult.ok
        ? {
            ok: true,
            text: `Fechamento da comanda de ${session.customerName} solicitado. Va ao caixa e informe seu nome para realizar o pagamento.`,
          }
        : {
            ok: false,
            text: 'Fechamento salvo neste aparelho, mas ainda nao confirmou no banco. Confira a internet ou chame o atendimento.',
          })
    }, 550)
  }

  function cancelCloseRequest() {
    if (!session || !activeCloseRequest || !canCancelCloseRequest || isCancelingClose) return

    setIsCancelingClose(true)
    setMessage({ ok: true, text: 'Cancelando solicitacao de fechamento...' })

    const updatedOrder = updateClientQrOrder(activeCloseRequest.id, (order) => ({
      ...order,
      status: 'cancelado',
      updatedAt: new Date().toISOString(),
      adminMessage: 'Cliente cancelou a solicitacao de fechamento pelo QR Code.',
    }))

    if (updatedOrder?.id) {
      persistClientQrOrderToSupabaseReliable(updatedOrder, { operation: 'update', attempts: 5, intervalMs: 1300 })
      publishClientQrOrderReliable(updatedOrder, { attempts: 8, intervalMs: 700 })
    }

    const nextSession = { ...session, closingRequested: false }
    saveClientQrSession(tableNumber, nextSession)
    setSession(nextSession)
    setSelectedHistoryOrderId(updatedOrder?.id ?? activeCloseRequest.id)
    setOrdersVersion((version) => version + 1)

    window.setTimeout(() => {
      setIsCancelingClose(false)
      setMessage({ ok: true, text: 'Fechamento cancelado. Voce pode continuar pedindo nesta comanda.' })
      setQrScreen('menu')
    }, 550)
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

            {isRequestingClose && (
              <section className="client-fullscreen-feedback" role="status" aria-live="polite">
                <span className="client-loading-ring" aria-hidden="true" />
                <p className="eyebrow">Solicitando fechamento</p>
                <h2>Enviando sua comanda para o caixa...</h2>
                <strong>Depois disso, novos pedidos ficam bloqueados ate o pagamento.</strong>
              </section>
            )}

            {isCancelingClose && (
              <section className="client-fullscreen-feedback" role="status" aria-live="polite">
                <span className="client-loading-ring" aria-hidden="true" />
                <p className="eyebrow">Cancelando fechamento</p>
                <h2>Liberando sua comanda...</h2>
                <strong>Aguarde um instante para continuar pedindo.</strong>
              </section>
            )}

            <div className="client-mini-nav">
              <button type="button" onClick={() => setQrScreen('menu')}>Cardapio</button>
              <button type="button" onClick={() => setQrScreen('history')}>Minha comanda</button>
            </div>

            {sessionClosingRequested && (
              <section className="client-history-detail">
                <div>
                  <span>Fechamento solicitado</span>
                  <strong>Comanda de {session.customerName}</strong>
                </div>
                <p>
                  Sua comanda esta aguardando o caixa. Nao e possivel enviar novos pedidos ate o pagamento ser finalizado.
                </p>
                <footer>
                  <span>Total em aberto</span>
                  <strong>{currency.format(sessionOpenTotal)}</strong>
                </footer>
                {canCancelCloseRequest ? (
                  <button className="client-secondary-button" disabled={isCancelingClose} type="button" onClick={cancelCloseRequest}>
                    {isCancelingClose ? 'Cancelando...' : 'Cancelar solicitacao de fechamento'}
                  </button>
                ) : (
                  <small>Se o caixa ja aprovou, peça para reabrir a comanda no balcao.</small>
                )}
              </section>
            )}

            {closeConfirmationOpen && (
              <section className="client-product-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar fechamento da comanda">
                <div className="client-product-modal">
                  <button className="client-modal-close" disabled={isRequestingClose} type="button" onClick={() => setCloseConfirmationOpen(false)}>x</button>
                  <p className="eyebrow">Confirmar fechamento</p>
                  <h2>Deseja fechar a comanda de {session.customerName}?</h2>
                  <p className="client-product-modal-description">
                    Ao confirmar, sua comanda vai para o caixa e voce nao conseguira fazer novos pedidos ate acertar no balcao.
                  </p>
                  <div className="client-sent-summary">
                    <strong>Mesa {tableNumber}</strong>
                    <span>{currency.format(sessionOpenTotal)}</span>
                    <small>Solicitado as {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  {cart.length > 0 && (
                    <p className="client-error">
                      Voce ainda tem {cartItemCount} item(ns) no carrinho que nao foram enviados. Envie o pedido ou remova antes de fechar.
                    </p>
                  )}
                  <button className="client-primary-button" disabled={isRequestingClose || cart.length > 0} type="button" onClick={confirmRequestClose}>
                    Tenho certeza, solicitar fechamento
                  </button>
                  <button className="client-secondary-button" disabled={isRequestingClose} type="button" onClick={() => setCloseConfirmationOpen(false)}>
                    Continuar pedindo
                  </button>
                </div>
              </section>
            )}

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
                  <button className="client-secondary-button" disabled={sessionClosingRequested} type="button" onClick={() => setQrScreen('menu')}>
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

                <div className="client-quick-actions">
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
                  <button
                    className="client-close-shortcut"
                    disabled={sessionClosingRequested || isRequestingClose}
                    type="button"
                    onClick={requestClose}
                  >
                    {sessionClosingRequested ? 'Fechamento solicitado' : 'Fechar comanda'}
                  </button>
                </div>

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
                      <img src={product.imageUrl || (product.category === 'Porcao' ? '/locco-site/order-burger-drip-v1.png' : '/locco-site/hero-burger-v2.png')} alt="" />
                      <div>
                        <span>{product.category}</span>
                        <strong>{product.name}</strong>
                        <p>{getProductDescription(product)}</p>
                        <small>{currency.format(product.price)}</small>
                      </div>
                      <button disabled={sessionClosingRequested} type="button" onClick={() => addToCart(product)}>+</button>
                    </article>
                  ))}
                </section>

                {customizingProduct && (
                  <section className="client-product-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Adicionar ${customizingProduct.name}`}>
                    <div className="client-product-modal">
                      <button className="client-modal-close" disabled={cartActionLoading} type="button" onClick={closeProductCustomization}>x</button>
                      <div className="client-product-modal-head">
                        <img src={customizingProduct.imageUrl || (customizingProduct.category === 'Porcao' ? '/locco-site/order-burger-drip-v1.png' : '/locco-site/hero-burger-v2.png')} alt="" />
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

                  <button className="client-primary-button" disabled={isSendingOrder || sessionClosingRequested} type="button" onClick={sendOrder}>
                    {sessionClosingRequested ? 'Comanda em fechamento' : isSendingOrder ? 'Enviando...' : 'Enviar pedido'}
                  </button>
                  {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
                </section>
              </>
            )}

            {qrScreen === 'history' && (
            <section className="client-history-card">
              <p className="eyebrow">Minha comanda</p>
              <h2>Ultimos envios</h2>
              <button
                className="client-close-command-button"
                disabled={sessionClosingRequested || isRequestingClose}
                type="button"
                onClick={requestClose}
              >
                {sessionClosingRequested
                  ? `Fechamento de ${session.customerName} solicitado`
                  : `Solicitar fechamento da comanda de ${session.customerName}`}
              </button>
              {recentOrders.length === 0 ? (
                <p className="empty-state">Nenhum pedido enviado ainda.</p>
              ) : recentOrders.map((order) => (
                <button
                  className={`client-history-row ${selectedHistoryOrderId === order.id ? 'is-selected' : ''}`}
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedHistoryOrderId((currentId) => currentId === order.id ? null : order.id)}
                >
                  <span>
                    {order.type === 'fechamento' ? 'Fechamento' : `${order.items.length} item(ns)`}
                    {formatOrderTime(order) && <small>{formatOrderTime(order)}</small>}
                  </span>
                  <strong>{getOrderStatusText(order.status)}</strong>
                  <b>{currency.format(order.total || 0)}</b>
                </button>
              ))}

              {selectedHistoryOrder && (
                <article className="client-history-detail">
                  <div>
                    <span>Resumo do envio</span>
                    <strong>{selectedHistoryOrder.type === 'fechamento' ? 'Solicitação de fechamento' : selectedHistoryOrder.id}</strong>
                  </div>
                  <p>
                    Status: <b>{getOrderStatusText(selectedHistoryOrder.status)}</b>
                    {selectedHistoryOrder.adminMessage ? ` - ${selectedHistoryOrder.adminMessage}` : ''}
                  </p>
                  {selectedHistoryOrder.type === 'fechamento' ? (
                    <p>Fechamento solicitado para a comanda de {selectedHistoryOrder.customerName}. Informe seu nome no caixa.</p>
                  ) : (
                    <div className="client-history-items">
                      {(selectedHistoryOrder.items ?? []).map((item) => (
                        <div key={item.id}>
                          <span>{item.quantity}x {item.name}</span>
                          <b>{currency.format(item.total || 0)}</b>
                          {item.notes && <small>{item.notes}</small>}
                        </div>
                      ))}
                    </div>
                  )}
                  <footer>
                    <span>Total</span>
                    <strong>{currency.format(selectedHistoryOrder.total || 0)}</strong>
                  </footer>
                </article>
              )}
            </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}
