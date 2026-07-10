import { useEffect, useMemo, useRef, useState } from 'react'
import {
  appendClientDeliveryOrder,
  clearClientDeliverySession,
  getGuestDeliveryExpiration,
  loadClientDeliveryAccounts,
  loadClientDeliveryOrders,
  loadClientDeliverySession,
  saveClientDeliveryAccounts,
  saveClientDeliverySession,
} from '../lib/clientDeliveryOrders.js'
import { buildOrderNotes, meatPointOptions } from '../lib/orderModifiers.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const allCategoriesLabel = 'Todos'
const deliveryDraftStorageKey = 'loccoburger_client_delivery_draft_v1'
const deliveryFee = 7
const defaultMeatPoint = 'Ao ponto'
const finalDeliveryStatuses = ['entregue', 'recusado', 'cancelado']
const deliverySteps = [
  { id: 'novo', label: 'Enviado' },
  { id: 'aprovado', label: 'Aceito' },
  { id: 'preparando', label: 'Preparo' },
  { id: 'pronto', label: 'Pronto' },
  { id: 'despachado', label: 'Em rota' },
  { id: 'entregue', label: 'Entregue' },
]
const deliveryPaymentOptions = [
  { id: 'debito', label: 'Debito na entrega', shortLabel: 'Debito' },
  { id: 'credito', label: 'Credito na entrega', shortLabel: 'Credito' },
  { id: 'pix', label: 'Pix na entrega', shortLabel: 'Pix na entrega' },
  { id: 'dinheiro', label: 'Dinheiro na entrega', shortLabel: 'Dinheiro' },
  { id: 'link', label: 'Solicitar link Mercado Pago', shortLabel: 'Link Mercado Pago' },
]

function getPaymentOption(method) {
  return deliveryPaymentOptions.find((option) => option.id === method) ?? deliveryPaymentOptions[0]
}

function getDeliveryStatusMeta(order) {
  const status = order?.status ?? 'novo'
  const metas = {
    novo: {
      label: 'Aguardando confirmacao',
      message: 'Seu pedido chegou para a loja e esta aguardando aprovacao do atendimento.',
      eta: 'A loja confirma em instantes',
      tone: 'waiting',
    },
    aprovado: {
      label: 'Pedido aceito',
      message: 'A loja aceitou seu pedido e enviou para a cozinha.',
      eta: order?.eta ?? '35 min',
      tone: 'accepted',
    },
    preparando: {
      label: 'Em preparo',
      message: 'A cozinha ja esta preparando seu pedido.',
      eta: order?.eta ?? '35 min',
      tone: 'preparing',
    },
    pronto: {
      label: 'Pronto para sair',
      message: 'Seu pedido ficou pronto e esta aguardando entrega.',
      eta: 'Saida em breve',
      tone: 'ready',
    },
    despachado: {
      label: 'Saiu para entrega',
      message: 'Seu pedido esta em rota. Se tudo correr bem, chega em ate 30 minutos.',
      eta: getDeliveryRemainingTime(order),
      tone: 'route',
    },
    entregue: {
      label: 'Entregue',
      message: 'Pedido finalizado. Bom apetite!',
      eta: 'Finalizado',
      tone: 'done',
    },
    recusado: {
      label: 'Recusado',
      message: 'A loja recusou este pedido. Se precisar, chame o atendimento.',
      eta: 'Finalizado',
      tone: 'error',
    },
  }

  return metas[status] ?? metas.novo
}

function getDeliveryStepIndex(status) {
  if (status === 'aprovado') return 1
  const index = deliverySteps.findIndex((step) => step.id === status)
  return index >= 0 ? index : 0
}

function getDeliveryRemainingTime(order) {
  const autoCompleteAt = Number(order?.deliveryAutoCompleteAt || 0)
  if (!autoCompleteAt) return 'Ate 30 min'

  const remainingMinutes = Math.max(0, Math.ceil((autoCompleteAt - Date.now()) / 60000))
  return remainingMinutes > 0 ? `${remainingMinutes} min restantes` : 'Finalizando'
}

function loadDeliveryDraft() {
  if (typeof window === 'undefined') return {}

  try {
    const draft = JSON.parse(window.localStorage.getItem(deliveryDraftStorageKey) ?? '{}')
    return draft && typeof draft === 'object' ? draft : {}
  } catch {
    return {}
  }
}

function saveDeliveryDraft(draft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(deliveryDraftStorageKey, JSON.stringify(draft))
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
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
  if (name.includes('refrigerante') || name.includes('suco') || name.includes('cerveja')) return 'Bebida gelada para acompanhar seu pedido.'

  return 'Produto preparado pela LoccoBurger com sabor artesanal e ingredientes selecionados.'
}

async function hashPassword(password) {
  const rawPassword = String(password ?? '')
  if (!window.crypto?.subtle) return btoa(rawPassword)

  const data = new TextEncoder().encode(rawPassword)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function CustomerDeliveryMenu({ products = [] }) {
  const savedSession = loadClientDeliverySession()
  const savedDraft = useMemo(() => loadDeliveryDraft(), [])
  const [session, setSession] = useState(savedSession)
  const [authMode, setAuthMode] = useState(savedDraft.authMode ?? 'guest')
  const [accountAction, setAccountAction] = useState(savedDraft.accountAction ?? 'login')
  const [customerForm, setCustomerForm] = useState({
    name: savedSession?.name ?? '',
    phone: savedSession?.phone ?? '',
    address: savedSession?.address ?? '',
    complement: savedSession?.complement ?? '',
    email: savedSession?.email ?? '',
    password: '',
    ...(savedSession ? {} : savedDraft.customerForm ?? {}),
    password: '',
  })
  const [selectedCategory, setSelectedCategory] = useState(savedDraft.selectedCategory ?? allCategoriesLabel)
  const [cart, setCart] = useState(savedDraft.cart ?? [])
  const [notes, setNotes] = useState(savedDraft.notes ?? '')
  const [paymentMethod, setPaymentMethod] = useState(savedDraft.paymentMethod === 'entrega' ? 'debito' : savedDraft.paymentMethod ?? 'debito')
  const [cashChangeFor, setCashChangeFor] = useState(savedDraft.cashChangeFor ?? '')
  const [deliveryOrdersTab, setDeliveryOrdersTab] = useState(savedDraft.deliveryOrdersTab ?? 'active')
  const [deliveryScreen, setDeliveryScreen] = useState(savedDraft.deliveryScreen ?? 'home')
  const [isSendingOrder, setIsSendingOrder] = useState(false)
  const [lastSubmittedOrderId, setLastSubmittedOrderId] = useState(savedDraft.lastSubmittedOrderId ?? null)
  const [cartToast, setCartToast] = useState(null)
  const [cartActionLoading, setCartActionLoading] = useState(false)
  const [customizingProduct, setCustomizingProduct] = useState(null)
  const [customMeatPoint, setCustomMeatPoint] = useState(defaultMeatPoint)
  const [customItemNotes, setCustomItemNotes] = useState('')
  const [message, setMessage] = useState(null)
  const [ordersVersion, setOrdersVersion] = useState(0)
  const cartRef = useRef(null)

  const activeProducts = products.filter((product) => product.active && (product.availableChannels?.delivery ?? true))
  const categories = [
    allCategoriesLabel,
    ...Array.from(new Set(activeProducts.map((product) => product.category))).filter(Boolean),
  ]
  const visibleProducts = selectedCategory === allCategoriesLabel
    ? activeProducts
    : activeProducts.filter((product) => product.category === selectedCategory)
  const subtotal = cart.reduce((total, item) => total + item.total, 0)
  const total = subtotal + (cart.length > 0 ? deliveryFee : 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const myOrders = useMemo(() => {
    if (!session) return []

    const phone = normalizePhone(session.phone)
    const email = normalizeEmail(session.email)
    const now = Date.now()

    return loadClientDeliveryOrders()
      .filter((order) => {
        if (session.accountType === 'registered') {
          return (email && normalizeEmail(order.customerEmail) === email) ||
            (phone && normalizePhone(order.phone).endsWith(phone.slice(-8)))
        }

        return order.sessionId === session.id &&
          (!order.guestVisibleUntil || now <= Number(order.guestVisibleUntil))
      })
      .slice(0, session.accountType === 'registered' ? 20 : 5)
  }, [ordersVersion, session])
  const activeOrders = myOrders.filter((order) => !finalDeliveryStatuses.includes(order.status))
  const historyOrders = myOrders.filter((order) => finalDeliveryStatuses.includes(order.status))
  const visibleOrders = deliveryOrdersTab === 'active' ? activeOrders : historyOrders
  const lastSubmittedOrder = myOrders.find((order) => order.id === lastSubmittedOrderId) ?? activeOrders[0] ?? null

  useEffect(() => {
    const { password: _password, ...safeCustomerForm } = customerForm
    saveDeliveryDraft({
      authMode,
      accountAction,
      customerForm: safeCustomerForm,
      selectedCategory,
      cart,
      notes,
      paymentMethod,
      cashChangeFor,
      deliveryOrdersTab,
      deliveryScreen,
      lastSubmittedOrderId,
    })
  }, [accountAction, authMode, cart, cashChangeFor, customerForm, deliveryOrdersTab, deliveryScreen, lastSubmittedOrderId, notes, paymentMethod, selectedCategory])

  useEffect(() => {
    if (!cartToast) return undefined

    const timeoutId = window.setTimeout(() => setCartToast(null), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [cartToast])

  useEffect(() => {
    const syncOrders = () => setOrdersVersion((version) => version + 1)
    const intervalId = window.setInterval(syncOrders, 5000)
    window.addEventListener('storage', syncOrders)
    window.addEventListener('loccoburger:client-delivery-orders-updated', syncOrders)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', syncOrders)
      window.removeEventListener('loccoburger:client-delivery-orders-updated', syncOrders)
    }
  }, [])

  async function openDeliveryAccount(event) {
    event.preventDefault()

    if (authMode === 'registered') {
      const email = normalizeEmail(customerForm.email)
      const password = String(customerForm.password ?? '')

      if (!email || password.length < 4) {
        setMessage({ ok: false, text: 'Informe e-mail e senha com pelo menos 4 caracteres.' })
        return
      }

      const accounts = loadClientDeliveryAccounts()
      const existingAccount = accounts.find((account) => normalizeEmail(account.email) === email)
      const passwordHash = await hashPassword(password)

      if (existingAccount && existingAccount.passwordHash !== passwordHash) {
        setMessage({ ok: false, text: 'Senha incorreta para este e-mail.' })
        return
      }

      if (!existingAccount && (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.address.trim())) {
        setMessage({ ok: false, text: 'Para criar conta, informe nome, telefone e endereco.' })
        return
      }

      const account = existingAccount ?? {
        id: `ACC-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        email,
        passwordHash,
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim(),
        complement: customerForm.complement.trim(),
        createdAt: new Date().toISOString(),
      }
      const updatedAccount = existingAccount
        ? {
            ...existingAccount,
            name: customerForm.name.trim() || existingAccount.name,
            phone: customerForm.phone.trim() || existingAccount.phone,
            address: customerForm.address.trim() || existingAccount.address,
            complement: customerForm.complement.trim() || existingAccount.complement,
            updatedAt: new Date().toISOString(),
          }
        : account
      const nextAccounts = existingAccount
        ? accounts.map((item) => item.id === existingAccount.id ? updatedAccount : item)
        : [updatedAccount, ...accounts]

      saveClientDeliveryAccounts(nextAccounts)

      const nextSession = {
        id: updatedAccount.id,
        accountType: 'registered',
        email: updatedAccount.email,
        name: updatedAccount.name,
        phone: updatedAccount.phone,
        address: updatedAccount.address,
        complement: updatedAccount.complement,
        createdAt: updatedAccount.createdAt,
      }

      saveClientDeliverySession(nextSession)
      setCustomerForm((form) => ({
        ...form,
        name: nextSession.name,
        phone: nextSession.phone,
        address: nextSession.address,
        complement: nextSession.complement,
        email: nextSession.email ?? form.email,
        password: '',
      }))
      setSession(nextSession)
      setDeliveryScreen('home')
      setMessage({ ok: true, text: existingAccount ? `Bem-vindo de volta, ${nextSession.name}.` : `Conta criada para ${nextSession.name}.` })
      return
    }

    if (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.address.trim()) {
      setMessage({ ok: false, text: 'Informe nome, telefone e endereco para pedir como convidado.' })
      return
    }

    const nextSession = {
      id: `GUEST-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      accountType: 'guest',
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
      complement: customerForm.complement.trim(),
      createdAt: new Date().toISOString(),
      expiresAt: getGuestDeliveryExpiration(),
    }

    saveClientDeliverySession(nextSession)
    setCustomerForm((form) => ({
      ...form,
      name: nextSession.name,
      phone: nextSession.phone,
      address: nextSession.address,
      complement: nextSession.complement,
    }))
    setSession(nextSession)
    setDeliveryScreen('home')
    setMessage({ ok: true, text: `Pedido convidado aberto para ${nextSession.name}. Historico visivel por 2 horas.` })
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
    const needsMeatPoint = isBurgerProduct(customizingProduct)
    if (needsMeatPoint && !customMeatPoint) {
      setMessage({ ok: false, text: 'Escolha o ponto da carne antes de adicionar.' })
      return
    }

    setCartActionLoading(true)
    setMessage(null)

    window.setTimeout(() => {
      const modifiers = needsMeatPoint
        ? { meatPoint: customMeatPoint, removals: [], additions: [] }
        : null
      const notes = needsMeatPoint
        ? buildOrderNotes({ meatPoint: customMeatPoint, removals: [], additions: [] }, customItemNotes)
        : customItemNotes.trim()
      const unitPrice = Number(product.price || 0)
      const cartItem = {
        id: `${Date.now()}-${product.id}-${Math.random().toString(16).slice(2, 7)}`,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice,
        total: unitPrice,
        notes,
        manualNotes: customItemNotes.trim(),
        modifiers,
      }

      setCart((currentCart) => [...currentCart, cartItem])
      setCartToast(`${product.name} adicionado ao carrinho.`)
      setCustomizingProduct(null)
      setCustomMeatPoint(defaultMeatPoint)
      setCustomItemNotes('')
      setCartActionLoading(false)
    }, 520)
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
      currentCart.map((item) => item.id === itemId ? { ...item, quantity, total: quantity * item.unitPrice } : item),
    )
  }

  function sendDeliveryOrder() {
    if (isSendingOrder) return

    if (!session) {
      setMessage({ ok: false, text: 'Abra seu cadastro delivery antes de enviar.' })
      return
    }

    if (cart.length === 0) {
      setMessage({ ok: false, text: 'Adicione pelo menos um item ao carrinho.' })
      return
    }

    const globalNotes = notes.trim()
    const paymentOption = getPaymentOption(paymentMethod)
    const cashChangeValue = paymentMethod === 'dinheiro' ? Number(String(cashChangeFor).replace(',', '.')) : 0
    const cartSnapshot = cart.map((item) => ({
      ...item,
      notes: [item.notes, globalNotes ? `Pedido: ${globalNotes}` : ''].filter(Boolean).join(' | '),
    }))
    const orderPayload = {
      id: `SITE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'delivery',
      status: 'novo',
      paymentStatus: paymentMethod === 'link' ? 'link_solicitado' : 'pagar_na_entrega',
      paymentMethod,
      paymentLabel: paymentOption.shortLabel,
      payOnDelivery: paymentMethod !== 'link',
      cashChangeFor: Number.isFinite(cashChangeValue) && cashChangeValue > 0 ? cashChangeValue : 0,
      eta: 'Aguardando loja',
      adminMessage: 'Pedido enviado. Aguardando a loja confirmar e mandar para a cozinha.',
      sessionId: session.id,
      accountType: session.accountType,
      customerEmail: session.email ?? '',
      customerName: session.name,
      phone: session.phone,
      address: session.address,
      complement: session.complement,
      guestVisibleUntil: session.accountType === 'guest' ? Date.now() + 2 * 60 * 60 * 1000 : null,
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
      deliveryFee,
      subtotal,
      total,
      items: cartSnapshot,
    }

    setIsSendingOrder(true)
    setMessage({ ok: true, text: 'Enviando seu pedido para a loja...' })

    window.setTimeout(() => {
      const order = appendClientDeliveryOrder(orderPayload)

      setCart([])
      setNotes('')
      setCashChangeFor('')
      setDeliveryOrdersTab('active')
      setLastSubmittedOrderId(order.id)
      setDeliveryScreen('sent')
      setMessage({
        ok: true,
        text: paymentMethod === 'link'
          ? `Pedido ${order.id} enviado. Acompanhe enquanto a loja gera o link seguro.`
          : `Pedido ${order.id} enviado. Acompanhe ate a entrega.`,
      })
      setOrdersVersion((version) => version + 1)
      setIsSendingOrder(false)
    }, 650)
  }

  function saveDeliveryAddress(event) {
    event.preventDefault()
    if (!session) return

    if (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.address.trim()) {
      setMessage({ ok: false, text: 'Nome, telefone e endereco sao obrigatorios.' })
      return
    }

    const nextSession = {
      ...session,
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
      complement: customerForm.complement.trim(),
      updatedAt: new Date().toISOString(),
    }

    if (session.accountType === 'registered') {
      const accounts = loadClientDeliveryAccounts()
      saveClientDeliveryAccounts(accounts.map((account) => (
        account.id === session.id
          ? {
              ...account,
              name: nextSession.name,
              phone: nextSession.phone,
              address: nextSession.address,
              complement: nextSession.complement,
              updatedAt: nextSession.updatedAt,
            }
          : account
      )))
    }

    saveClientDeliverySession(nextSession)
    setSession(nextSession)
    setDeliveryScreen('home')
    setMessage({ ok: true, text: 'Endereco atualizado para os proximos pedidos.' })
  }

  function logoutDeliveryAccount() {
    clearClientDeliverySession()
    setSession(null)
    setAuthMode('guest')
    setAccountAction('login')
    setCustomerForm({
      name: '',
      phone: '',
      address: '',
      complement: '',
      email: '',
      password: '',
    })
    setDeliveryScreen('home')
    setLastSubmittedOrderId(null)
    setMessage({ ok: true, text: 'Voce saiu da conta delivery.' })
  }

  return (
    <main className="client-menu-shell client-delivery-shell">
      <section className="client-menu-phone">
        <header className="client-menu-header">
          <span>Delivery</span>
          <strong>LoccoBurger</strong>
          {session ? (
            <button className="client-logout-button" type="button" onClick={logoutDeliveryAccount}>
              Sair
            </button>
          ) : (
            <small>Pedido online</small>
          )}
        </header>

        {!session ? (
          <form className="client-login-card client-delivery-login" onSubmit={openDeliveryAccount}>
            <p className="eyebrow">Delivery Locco</p>
            <h1>{authMode === 'registered' ? 'Entre ou crie sua conta.' : 'Peça como convidado.'}</h1>
            <div className="client-auth-tabs">
              <button className={authMode === 'guest' ? 'active' : ''} type="button" onClick={() => setAuthMode('guest')}>
                Convidado 2h
              </button>
              <button className={authMode === 'registered' ? 'active' : ''} type="button" onClick={() => setAuthMode('registered')}>
                Conta cadastrada
              </button>
            </div>
            {authMode === 'registered' && (
              <>
                <div className="client-auth-tabs subtle">
                  <button className={accountAction === 'login' ? 'active' : ''} type="button" onClick={() => setAccountAction('login')}>
                    Entrar
                  </button>
                  <button className={accountAction === 'create' ? 'active' : ''} type="button" onClick={() => setAccountAction('create')}>
                    Criar conta
                  </button>
                </div>
                <label>E-mail<input type="email" value={customerForm.email} onChange={(event) => setCustomerForm((form) => ({ ...form, email: event.target.value }))} placeholder="seuemail@email.com" /></label>
                <label>Senha<input type="password" value={customerForm.password} onChange={(event) => setCustomerForm((form) => ({ ...form, password: event.target.value }))} placeholder="Senha" /></label>
              </>
            )}
            {(authMode === 'guest' || accountAction === 'create') && (
              <>
                <label>Nome<input value={customerForm.name} onChange={(event) => setCustomerForm((form) => ({ ...form, name: event.target.value }))} placeholder="Ex.: Murilo" /></label>
                <label>Telefone<input inputMode="tel" value={customerForm.phone} onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))} placeholder="(11) 99999-9999" /></label>
                <label>Endereco<input value={customerForm.address} onChange={(event) => setCustomerForm((form) => ({ ...form, address: event.target.value }))} placeholder="Rua, numero, bairro" /></label>
                <label>Complemento<input value={customerForm.complement} onChange={(event) => setCustomerForm((form) => ({ ...form, complement: event.target.value }))} placeholder="Apto, bloco, referencia" /></label>
              </>
            )}
            {authMode === 'registered' && accountAction === 'login' && (
              <p className="client-auth-note">Ao entrar, seu historico fica vinculado ao e-mail neste navegador. Depois conectamos isso ao Supabase Auth para producao.</p>
            )}
            <button className="client-primary-button" type="submit">
              {authMode === 'registered' ? (accountAction === 'create' ? 'Criar conta e pedir' : 'Entrar no delivery') : 'Continuar como convidado'}
            </button>
            {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
          </form>
        ) : (
          <>
            <section className="client-hero-card">
              <div>
                <p className="eyebrow">Entrega para {session.name}</p>
                <h1>Monte seu pedido.</h1>
                <span>{session.address}{session.complement ? ` - ${session.complement}` : ''}</span>
              </div>
              <img src="/locco-site/hero-burger-v2.png" alt="" />
            </section>

            {isSendingOrder && (
              <section className="client-fullscreen-feedback" role="status" aria-live="polite">
                <span className="client-loading-ring" aria-hidden="true" />
                <p className="eyebrow">Enviando pedido</p>
                <h2>Mandando para o atendimento...</h2>
                <strong>Feedback rapido, sem travar a tela.</strong>
              </section>
            )}

            {cartActionLoading && (
              <section className="client-fullscreen-feedback client-cart-loading-feedback" role="status" aria-live="polite">
                <span className="client-loading-ring" aria-hidden="true" />
                <p className="eyebrow">Adicionando ao carrinho</p>
                <h2>Salvando seu item...</h2>
                <strong>Ponto da carne, observacao e valor ficam guardados no pedido.</strong>
              </section>
            )}

            {deliveryScreen !== 'home' && (
              <div className="client-mini-nav">
                <button type="button" onClick={() => setDeliveryScreen('home')}>Inicio</button>
                <button type="button" onClick={() => setDeliveryScreen('menu')}>Cardapio</button>
                <button type="button" onClick={() => { setDeliveryOrdersTab('active'); setDeliveryScreen('orders') }}>
                  Pedidos ativos
                </button>
              </div>
            )}

            {deliveryScreen === 'home' && (
              <section className="client-home-card">
                <div>
                  <p className="eyebrow">Sua area delivery</p>
                  <h2>O que voce quer fazer agora?</h2>
                  <span>
                    {activeOrders.length > 0
                      ? `Voce tem ${activeOrders.length} pedido(s) ativo(s) para acompanhar.`
                      : 'Escolha uma opcao e siga o fluxo sem se perder.'}
                  </span>
                </div>

                <div className="client-home-actions">
                  <button type="button" onClick={() => setDeliveryScreen('menu')}>
                    <strong>Fazer novo pedido</strong>
                    <span>Ver cardapio e montar carrinho</span>
                  </button>
                  <button type="button" onClick={() => setDeliveryScreen('address')}>
                    <strong>Ver meu endereco</strong>
                    <span>Editar entrega e telefone</span>
                  </button>
                  <button type="button" onClick={() => { setDeliveryOrdersTab('active'); setDeliveryScreen('orders') }}>
                    <strong>Ver meus pedidos</strong>
                    <span>Ativos e historico</span>
                  </button>
                  <button type="button" onClick={logoutDeliveryAccount}>
                    <strong>Sair da conta</strong>
                    <span>Limpar acesso deste aparelho</span>
                  </button>
                </div>

                {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
              </section>
            )}

            {deliveryScreen === 'address' && (
              <form className="client-login-card client-address-card" onSubmit={saveDeliveryAddress}>
                <p className="eyebrow">Endereco cadastrado</p>
                <h2>Atualize seus dados de entrega.</h2>
                <label>Nome<input value={customerForm.name} onChange={(event) => setCustomerForm((form) => ({ ...form, name: event.target.value }))} /></label>
                <label>Telefone<input inputMode="tel" value={customerForm.phone} onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))} /></label>
                <label>Endereco<input value={customerForm.address} onChange={(event) => setCustomerForm((form) => ({ ...form, address: event.target.value }))} /></label>
                <label>Complemento<input value={customerForm.complement} onChange={(event) => setCustomerForm((form) => ({ ...form, complement: event.target.value }))} /></label>
                <button className="client-primary-button" type="submit">Salvar endereco</button>
                {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
              </form>
            )}

            {deliveryScreen === 'sent' && (
              <section className="client-order-sent-card">
                <span className="client-sent-icon">✓</span>
                <p className="eyebrow">Pedido enviado</p>
                <h2>Agora a loja confirma e atualiza voce por aqui.</h2>
                {lastSubmittedOrder ? (
                  <div className="client-sent-summary">
                    <strong>{lastSubmittedOrder.id}</strong>
                    <span>{currency.format(lastSubmittedOrder.total || 0)}</span>
                    <small>{getDeliveryStatusMeta(lastSubmittedOrder).message}</small>
                  </div>
                ) : (
                  <p className="empty-state">Pedido registrado. Abra os pedidos ativos para acompanhar.</p>
                )}
                <div className="client-sent-actions">
                  <button className="client-primary-button" type="button" onClick={() => { setDeliveryOrdersTab('active'); setDeliveryScreen('orders') }}>
                    Acompanhar pedido
                  </button>
                  <button className="client-secondary-button" type="button" onClick={() => setDeliveryScreen('menu')}>
                    Fazer outro pedido
                  </button>
                  <button className="client-secondary-button" type="button" onClick={() => setDeliveryScreen('home')}>
                    Voltar para inicio
                  </button>
                </div>
              </section>
            )}

            {deliveryScreen === 'menu' && (
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
                  <strong>{cartItemCount > 0 ? `${cartItemCount} item(ns)` : 'Carrinho vazio'}</strong>
                  <b>{currency.format(total)}</b>
                </button>

                <div className="client-category-tabs">
                  {categories.map((category) => (
                    <button className={selectedCategory === category ? 'active' : ''} key={category} type="button" onClick={() => setSelectedCategory(category)}>
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
                      <button type="button" onClick={() => openProductCustomization(product)}>+</button>
                    </article>
                  ))}
                </section>

                {customizingProduct && (
                  <section className="client-product-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Adicionar ${customizingProduct.name}`}>
                    <div className="client-product-modal">
                      <button className="client-modal-close" type="button" onClick={closeProductCustomization}>x</button>
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
                          <small>Padrao da casa: Ao ponto. Voce pode mudar antes de adicionar.</small>
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
                      <p className="eyebrow">Carrinho delivery</p>
                      <h2>{cart.length} item(ns)</h2>
                    </div>
                    <strong>{currency.format(total)}</strong>
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
                  <div className="client-delivery-total">
                    <span>Produtos: {currency.format(subtotal)}</span>
                    <span>Entrega estimada: {currency.format(cart.length > 0 ? deliveryFee : 0)}</span>
                  </div>
                  <label>
                    Forma de pagamento
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      {deliveryPaymentOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  {paymentMethod === 'dinheiro' && (
                    <label>
                      Troco para quanto?
                      <input
                        inputMode="decimal"
                        value={cashChangeFor}
                        onChange={(event) => setCashChangeFor(event.target.value)}
                        placeholder="Ex.: 100,00"
                      />
                    </label>
                  )}
                  <label>
                    Observacao
                    <textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: ponto de referencia, sem cebola, entregar na portaria..." />
                  </label>
                  <button className="client-primary-button" disabled={isSendingOrder} type="button" onClick={sendDeliveryOrder}>
                    {isSendingOrder ? 'Enviando...' : 'Enviar pedido delivery'}
                  </button>
                  {message && <p className={message.ok ? 'client-success' : 'client-error'}>{message.text}</p>}
                </section>
              </>
            )}

            {deliveryScreen === 'orders' && (
            <section className="client-history-card client-delivery-orders-card">
              <p className="eyebrow">Meus pedidos</p>
              <h2>{deliveryOrdersTab === 'active' ? 'Pedidos ativos' : 'Historico de pedidos'}</h2>
              {session.accountType === 'guest' ? (
                <span>Como convidado, o acompanhamento fica visivel por cerca de 2 horas.</span>
              ) : (
                <span>Conta cadastrada: seus pedidos ficam no historico deste perfil.</span>
              )}

              <div className="client-order-tabs">
                <button className={deliveryOrdersTab === 'active' ? 'active' : ''} type="button" onClick={() => setDeliveryOrdersTab('active')}>
                  Ativos <b>{activeOrders.length}</b>
                </button>
                <button className={deliveryOrdersTab === 'history' ? 'active' : ''} type="button" onClick={() => setDeliveryOrdersTab('history')}>
                  Historico <b>{historyOrders.length}</b>
                </button>
              </div>

              {visibleOrders.length === 0 ? (
                <p className="empty-state">
                  {deliveryOrdersTab === 'active'
                    ? 'Nenhum pedido ativo agora. Monte seu carrinho e envie para a loja.'
                    : 'Nenhum pedido finalizado ainda.'}
                </p>
              ) : visibleOrders.map((order) => {
                const statusMeta = getDeliveryStatusMeta(order)
                const currentStepIndex = getDeliveryStepIndex(order.status)

                return (
                  <article className={`client-active-order-card status-${statusMeta.tone}`} key={order.id}>
                    <div className="client-active-order-head">
                      <div>
                        <span>{order.id}</span>
                        <strong>{statusMeta.label}</strong>
                      </div>
                      <b>{currency.format(order.total || 0)}</b>
                    </div>

                    <div className="client-order-feedback">
                      <span>Feedback da loja</span>
                      <strong>{order.adminMessage || statusMeta.message}</strong>
                      <small>Previsao: {statusMeta.eta}</small>
                    </div>

                    <div className="client-order-timeline" aria-label={`Status do pedido ${order.id}`}>
                      {deliverySteps.map((step, index) => (
                        <span
                          className={index <= currentStepIndex ? 'done' : ''}
                          key={step.id}
                        >
                          {step.label}
                        </span>
                      ))}
                    </div>

                    <div className="client-order-items-summary">
                      {(order.items ?? []).map((item) => (
                        <span key={item.id ?? `${order.id}-${item.productId}`}>{item.quantity}x {item.name}</span>
                      ))}
                    </div>

                    <footer>
                      <span>
                        {order.paymentMethod === 'link'
                          ? 'Link de pagamento solicitado'
                          : `${order.paymentLabel || getPaymentOption(order.paymentMethod).shortLabel}${order.cashChangeFor ? ` - troco para ${currency.format(order.cashChangeFor)}` : ''}`}
                      </span>
                      <strong>{order.eta ?? statusMeta.eta}</strong>
                    </footer>
                  </article>
                )
              })}
            </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}
