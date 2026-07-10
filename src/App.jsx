import { useEffect, useRef, useState } from 'react'
import './loccoburger-public.css'
import './loccoburger-landing-final.css'
import { customers, deliveries, inventoryItems, kitchenQueue, products, tables, technicalSheets } from './data/mockData.js'
import { Layout } from './components/Layout.jsx'
import { BrandLogo } from './components/BrandLogo.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { DailyOperation } from './pages/DailyOperation.jsx'
import { Tables } from './pages/Tables.jsx'
import { Delivery } from './pages/Delivery.jsx'
import { Kitchen } from './pages/Kitchen.jsx'
import { Products } from './pages/Products.jsx'
import { Inventory } from './pages/Inventory.jsx'
import { TechnicalSheet } from './pages/TechnicalSheet.jsx'
import { Cashier } from './pages/Cashier.jsx'
import { Customers } from './pages/Customers.jsx'
import { CustomerQrMenu } from './pages/CustomerQrMenu.jsx'
import { CustomerDeliveryMenu } from './pages/CustomerDeliveryMenu.jsx'
import { AuthPage } from './pages/AuthPage.jsx'
import { UserPermissions } from './pages/UserPermissions.jsx'
import { Financial } from './pages/Financial.jsx'
import { Dre } from './pages/Dre.jsx'
import { Purchases } from './pages/Purchases.jsx'
import { PlaceholderPage } from './pages/PlaceholderPage.jsx'
import { clearAppState, getRepositoryStatus, loadAppState, saveAppState } from './lib/appRepository.js'
import { getCurrentSession, resetPassword, signIn, signOut, signUp } from './lib/auth.js'
import { loadCatalogTables, saveCatalogTables } from './lib/catalogSupabaseRepository.js'
import { loadCustomerDeliveryTables, saveCustomerDeliveryTables } from './lib/customerDeliverySupabaseRepository.js'
import { loadFinanceTables, saveFinanceTables } from './lib/financeSupabaseRepository.js'
import { loadOperationTables, saveOperationTables } from './lib/operationSupabaseRepository.js'
import { subscribeToSharedDataChanges } from './lib/realtimeSync.js'
import {
  clearClientQrSession,
  closeClientQrBroadcastChannel,
  createClientQrBroadcastChannel,
  loadClientQrOrders,
  mergeClientQrOrders,
  mergeAndSaveClientQrOrders,
  publishClientQrOrders,
  publishClientQrOrdersRequest,
  saveClientQrOrders,
} from './lib/clientQrOrders.js'
import {
  closeClientQrOrdersSupabaseSubscription,
  loadClientQrOrdersFromSupabase,
  saveClientQrOrderToSupabase,
  subscribeToClientQrOrdersFromSupabase,
} from './lib/clientQrSupabaseRepository.js'
import { loadClientDeliveryOrders, saveClientDeliveryOrders, updateClientDeliveryOrder } from './lib/clientDeliveryOrders.js'
import {
  clearAdminNotifications,
  loadAdminNotifications,
  loadSeenAdminNotificationKeys,
  saveAdminNotifications,
  saveSeenAdminNotificationKeys,
} from './lib/adminNotifications.js'
import { loadUserProfile } from './lib/userProfileRepository.js'
import { updateWhatsAppMessageStatus } from './lib/whatsappRepository.js'
import { saveInventoryItem, saveProduct, toggleProductStatus } from './lib/catalogRepository.js'
import { createCustomerCampaign, saveCustomer } from './lib/customerRepository.js'
import { advanceDeliveryOrder, createDeliveryCustomer, createDeliveryOrder } from './lib/deliveryRepository.js'
import {
  applyStockAdjustment,
  applyProductStockConsumption,
  applyStockEntry,
  checkProductStockAvailability,
  createStockAdjustment,
} from './lib/inventoryRepository.js'
import { createFiscalCouponReceipt, createPurchaseOrder, receivePurchaseOrder } from './lib/purchaseRepository.js'
import {
  addIngredientToSheet,
  createEmptyTechnicalSheet,
  removeIngredientFromSheet,
  updateTechnicalSheetDetails,
} from './lib/technicalSheetRepository.js'
import { getLocalDateKey } from './lib/dateUtils.js'
import { applyModifierStockConsumption } from './lib/orderModifiers.js'
import { loadStoredState } from './lib/storage.js'


function normalizeRouteValue(value) {
  const cleanedValue = String(value || '').replace(/^#/, '').replace(/\/+$/, '')
  return cleanedValue || '/'
}

function isManagementAreaRoute() {
  if (typeof window === 'undefined') return false

  const allowedRoutes = new Set(['/gestao', '/admin', '/login', '/app'])
  const currentPath = normalizeRouteValue(window.location.pathname)
  const currentHash = normalizeRouteValue(window.location.hash)

  return allowedRoutes.has(currentPath) || allowedRoutes.has(currentHash)
}

function isCustomerQrMenuRoute() {
  if (typeof window === 'undefined') return false

  const currentPath = normalizeRouteValue(window.location.pathname)
  return currentPath === '/mesa' ||
    currentPath.startsWith('/mesa/') ||
    currentPath === '/cardapio-mesa' ||
    currentPath.startsWith('/cardapio-mesa/') ||
    currentPath === '/cardapio-cliente'
}

function isCustomerDeliveryRoute() {
  if (typeof window === 'undefined') return false

  const currentPath = normalizeRouteValue(window.location.pathname)
  return currentPath === '/delivery'
}

const meatPoints = [
  {
    id: 'bem-passado',
    label: 'Bem passado',
    temperature: 'Mais firme, tostado e marcante',
    imagePosition: '32%',
    description:
      'Ideal para quem prefere a carne mais cozida, com crosta mais presente e sabor defumado evidente. A brasa ajuda a manter personalidade sem perder o prazer da mordida.',
  },
  {
    id: 'ao-ponto-bem',
    label: 'Ao ponto para bem',
    temperature: 'Centro discreto, crosta intensa',
    imagePosition: '47%',
    description:
      'Um ponto mais firme, mas ainda com umidade no centro. Combina com quem quer a segurança do bem passado sem abrir mão de um pouco de suculência.',
  },
  {
    id: 'ao-ponto',
    label: 'Ao ponto',
    temperature: 'Equilíbrio entre suculência e crosta',
    imagePosition: '61%',
    description:
      'O clássico da casa: carne com centro rosado, borda tostada e textura macia. Entrega aquele meio-termo que agrada a maioria e deixa o burger bem apetitoso.',
  },
  {
    id: 'mal-passado',
    label: 'Mal passado',
    temperature: 'Mais vermelho, macio e suculento',
    imagePosition: '76%',
    description:
      'Para quem gosta de sentir a carne mais macia, úmida e com sabor intenso de brasa. É o ponto mais suculento, preservando bastante o gosto natural do blend.',
  },
]

const menuHighlights = [
  'Burger Queijo Brie',
  'Cebola Caramelizada',
  'Duplo Smash',
  'Porção de Batata',
]

const orderCategories = ['Todos', 'Especiais', 'Smash', 'Porções']
const appCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const orderProducts = [
  {
    id: 'cebola-caramelizada',
    name: 'Cebola Caramelizada',
    category: 'Especiais',
    price: 'R$ 41,90',
    description: 'Burger gourmet 200g, cheddar, bacon, rúcula, tomate cereja e cebola caramelizada.',
    image: '/locco-site/hero-burger-v2.png',
  },
  {
    id: 'duplo-smash',
    name: 'Duplo Smash',
    category: 'Smash',
    price: 'R$ 32,90',
    description: 'Pão brioche, queijo cheddar, bacon, ketchup e mostarda.',
    image: '/locco-site/hero-burger-v2.png',
  },
  {
    id: 'queijo-brie',
    name: 'Queijo Brie',
    category: 'Especiais',
    price: 'R$ 41,90',
    description: 'Hambúrguer gourmet 200g com queijo brie, cebola caramelizada, bacon e rúcula.',
    image: '/locco-site/hero-burger-v2.png',
  },
  {
    id: 'batata',
    name: 'Porção de Batata',
    category: 'Porções',
    price: 'R$ 20,00',
    description: 'Porção de batata 350g para acompanhar com maionese artesanal da casa.',
    image: '/locco-site/order-burger-drip-v1.png',
  },
]

function CursorTrail() {
  const canvasRef = useRef(null)
  const dotRef = useRef(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const revealSelectors = [
      '.locco-premium-header',
      '.locco-premium-copy > :not(.locco-premium-score-card)',
      '.locco-premium-food-stage',
      '.locco-premium-section',
      '.locco-premium-cards article',
      '.locco-premium-app-section',
      '.locco-premium-meat-selector',
      '.locco-premium-meat-stack',
      '.locco-premium-meat-copy',
      '.locco-premium-meat-detail',
      '.locco-premium-order-copy',
      '.locco-premium-order-ui',
      '.locco-premium-phone',
      '.locco-premium-mayo-copy',
      '.locco-premium-mayo-art',
      '.locco-premium-menu-copy',
      '.locco-premium-menu-card',
      '.locco-premium-experience > *',
      '.locco-premium-location > *',
      '.locco-premium-footer',
    ]
    const revealElements = Array.from(
      new Set(revealSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))),
    )

    document.documentElement.classList.add('loccoburger-public-page')

    if (revealElements.length === 0) {
      return () => document.documentElement.classList.remove('loccoburger-public-page')
    }

    revealElements.forEach((element, index) => {
      element.setAttribute('data-locco-reveal', '')
      element.style.setProperty('--locco-reveal-delay', `${Math.min(index * 30, 210)}ms`)
    })
    document.documentElement.classList.add('loccoburger-motion-ready')

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
      window.requestAnimationFrame(() => {
        revealElements.forEach((element) => element.classList.add('is-visible'))
      })

      return () => {
        document.documentElement.classList.remove('loccoburger-public-page', 'loccoburger-motion-ready')
        revealElements.forEach((element) => {
          element.removeAttribute('data-locco-reveal')
          element.classList.remove('is-visible')
          element.style.removeProperty('--locco-reveal-delay')
        })
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -2% 0px', threshold: 0.06 },
    )

    revealElements.forEach((element) => observer.observe(element))

    return () => {
      observer.disconnect()
      document.documentElement.classList.remove('loccoburger-public-page', 'loccoburger-motion-ready')
      revealElements.forEach((element) => {
        element.removeAttribute('data-locco-reveal')
        element.classList.remove('is-visible')
        element.style.removeProperty('--locco-reveal-delay')
      })
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const cursorDot = dotRef.current
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const usesFinePointer = window.matchMedia('(pointer: fine)')

    if (!canvas || window.innerWidth < 720 || prefersReducedMotion.matches || !usesFinePointer.matches) {
      return undefined
    }

    const context = canvas.getContext('2d')
    let animationFrame = 0
    let lastPoint = null
    let currentPoint = null
    let width = 0
    let height = 0
    let pixelRatio = 1
    let isAnimating = false
    let lastMoveAt = 0

    const resizeCanvas = () => {
      width = window.innerWidth
      height = window.innerHeight
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * pixelRatio)
      canvas.height = Math.floor(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const clearTrail = () => {
      lastPoint = null
      currentPoint = null
      context.clearRect(0, 0, width, height)
      if (cursorDot) {
        cursorDot.style.opacity = '0'
      }
    }

    const startPaint = () => {
      if (isAnimating) return
      isAnimating = true
      animationFrame = window.requestAnimationFrame(paint)
    }

    const updatePointer = (event) => {
      currentPoint = { x: event.clientX, y: event.clientY }
      lastMoveAt = Date.now()
      if (cursorDot) {
        cursorDot.style.opacity = '1'
        cursorDot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`
      }
      startPaint()
    }

    const paint = () => {
      context.globalCompositeOperation = 'destination-out'
      context.fillStyle = 'rgba(0, 0, 0, 0.32)'
      context.fillRect(0, 0, width, height)

      if (currentPoint) {
        const previousPoint = lastPoint ?? currentPoint
        const controlPoint = {
          x: previousPoint.x + (currentPoint.x - previousPoint.x) * 0.55,
          y: previousPoint.y + (currentPoint.y - previousPoint.y) * 0.55,
        }
        const gradient = context.createLinearGradient(previousPoint.x, previousPoint.y, currentPoint.x, currentPoint.y)
        gradient.addColorStop(0, 'rgba(255, 196, 51, 0.01)')
        gradient.addColorStop(0.58, 'rgba(255, 196, 51, 0.24)')
        gradient.addColorStop(1, 'rgba(255, 248, 210, 0.62)')

        context.globalCompositeOperation = 'source-over'
        context.lineCap = 'round'
        context.lineJoin = 'round'

        context.beginPath()
        context.moveTo(previousPoint.x, previousPoint.y)
        context.quadraticCurveTo(controlPoint.x, controlPoint.y, currentPoint.x, currentPoint.y)
        context.lineWidth = 5
        context.strokeStyle = 'rgba(255, 196, 51, 0.055)'
        context.shadowBlur = 10
        context.shadowColor = 'rgba(255, 183, 24, 0.16)'
        context.stroke()

        context.beginPath()
        context.moveTo(previousPoint.x, previousPoint.y)
        context.quadraticCurveTo(controlPoint.x, controlPoint.y, currentPoint.x, currentPoint.y)
        context.lineWidth = 1.8
        context.strokeStyle = gradient
        context.shadowBlur = 5
        context.shadowColor = 'rgba(255, 183, 24, 0.22)'
        context.stroke()
        context.shadowBlur = 0
        lastPoint = currentPoint
      }

      const idleFor = Date.now() - lastMoveAt
      if (idleFor > 110) {
        currentPoint = null
        lastPoint = null
        if (cursorDot) cursorDot.style.opacity = '0'
      }

      if (idleFor > 360) {
        context.clearRect(0, 0, width, height)
        isAnimating = false
        animationFrame = 0
        return
      }

      animationFrame = window.requestAnimationFrame(paint)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('pointermove', updatePointer, { passive: true })
    window.addEventListener('blur', clearTrail)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('blur', clearTrail)
    }
  }, [])

  return (
    <>
      <canvas className="locco-premium-cursor-trail" ref={canvasRef} aria-hidden="true" />
      <span className="locco-premium-cursor-dot" ref={dotRef} aria-hidden="true" />
    </>
  )
}

function LandingMaintenancePage() {
  const currentYear = new Date().getFullYear()
  const whatsappNumber = '5511993278115'
  const whatsappMessage = encodeURIComponent('Ola, vim pelo site do LoccoBurger e quero fazer um pedido.')
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`
  const deliveryUrl = '/delivery'
  const adminUrl = '/admin'
  const mapsUrl = 'https://maps.app.goo.gl/rCcrYsNCDD6WdvZZA'
  const [heroPhotoLoaded, setHeroPhotoLoaded] = useState(false)
  const [placePhotoLoaded, setPlacePhotoLoaded] = useState(false)
  const [selectedMeatPoint, setSelectedMeatPoint] = useState(meatPoints[2])
  const [selectedOrderCategory, setSelectedOrderCategory] = useState(orderCategories[0])
  const [selectedOrderProduct, setSelectedOrderProduct] = useState(orderProducts[0])
  const [publicScreen, setPublicScreen] = useState(() => (
    typeof window !== 'undefined' && window.location.hash === '#pedido' ? 'order' : 'home'
  ))
  const visibleOrderProducts = selectedOrderCategory === 'Todos'
    ? orderProducts
    : orderProducts.filter((product) => product.category === selectedOrderCategory)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncPublicScreen = () => {
      setPublicScreen(window.location.hash === '#pedido' ? 'order' : 'home')
    }

    window.addEventListener('hashchange', syncPublicScreen)
    window.addEventListener('popstate', syncPublicScreen)

    return () => {
      window.removeEventListener('hashchange', syncPublicScreen)
      window.removeEventListener('popstate', syncPublicScreen)
    }
  }, [])

  const openOrderScreen = (event) => {
    event.preventDefault()
    setPublicScreen('order')
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '#pedido')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const closeOrderScreen = () => {
    setPublicScreen('home')
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const orderExperience = (
    <section className="locco-premium-order-experience locco-premium-order-screen-content" aria-label="Cardápio digital e pedido pelo QR Code">
      <div className="locco-premium-order-copy">
        <p className="locco-premium-kicker">Pedido pelo QR Code</p>
        <h2>Monte seu pedido em uma tela de app premium.</h2>
        <p>
          Essa é a tela demonstrativa do autoatendimento: o cliente escolhe o lanche, envia o pedido,
          o garçom aprova e a cozinha recebe na gestão. Serve para mesa, retirada, estacionamento e delivery.
        </p>

        <div className="locco-premium-order-flow" aria-label="Fluxo do pedido digital">
          <span>QR Code</span>
          <span>Cliente escolhe</span>
          <span>ChatGPT ajuda</span>
          <span>Garçom aprova</span>
          <span>Cozinha recebe</span>
        </div>

        <div className="locco-premium-actions">
          <a className="locco-premium-primary" href={deliveryUrl}>
            Fazer pedido no delivery
          </a>
          <a className="locco-premium-secondary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Pedir pelo WhatsApp
          </a>
          <button className="locco-premium-secondary locco-premium-ghost-button" type="button" onClick={closeOrderScreen}>
            Voltar ao site
          </button>
        </div>
      </div>

      <div className="locco-premium-order-ui locco-premium-order-ui-delivery">
        <article className="locco-delivery-preview" aria-label="Prévia da interface de delivery LoccoBurger">
          <header className="locco-delivery-preview-topbar">
            <span>Delivery</span>
            <strong>LoccoBurger</strong>
            <button type="button" onClick={closeOrderScreen}>Sair</button>
          </header>

          <section className="locco-delivery-preview-hero">
            <div>
              <p>Entrega para Rogério</p>
              <h3>Monte seu pedido.</h3>
              <span>Alameda México 271 - Casa D</span>
            </div>
            <img src="/locco-site/hero-burger-v2.png" alt="" />
          </section>

          <nav className="locco-delivery-preview-tabs" aria-label="Navegação demonstrativa do delivery">
            <button className="is-active" type="button">Início</button>
            <button type="button">Cardápio</button>
            <button type="button">Pedidos ativos</button>
          </nav>

          <div className="locco-delivery-preview-cart" aria-label="Resumo do carrinho visual">
            <span aria-hidden="true">🛒</span>
            <strong>1 item(ns)</strong>
            <b>{selectedOrderProduct.price}</b>
          </div>

          <div className="locco-delivery-preview-categories" role="tablist" aria-label="Categorias do cardápio">
            {orderCategories.map((category) => (
              <button
                className={selectedOrderCategory === category ? 'is-active' : ''}
                key={category}
                type="button"
                role="tab"
                aria-selected={selectedOrderCategory === category}
                onClick={() => setSelectedOrderCategory(category)}
              >
                {category === 'Especiais' ? 'Burger' : category === 'Porções' ? 'Porção' : category}
              </button>
            ))}
          </div>

          <div className="locco-delivery-preview-list">
            {visibleOrderProducts.map((product) => (
              <button
                className={selectedOrderProduct.id === product.id ? 'is-active' : ''}
                key={product.id}
                type="button"
                onClick={() => setSelectedOrderProduct(product)}
              >
                <img src={product.image} alt="" />
                <span>
                  <small>{product.category === 'Porções' ? 'Porção' : 'Burger'}</small>
                  <strong>{product.name}</strong>
                  <em>{product.description}</em>
                  <b>{product.price}</b>
                </span>
                <i aria-hidden="true">+</i>
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  )

  if (publicScreen === 'order') {
    return (
      <main className="locco-premium locco-premium-order-route">
        <CursorTrail />
        <button className="locco-premium-order-back" type="button" onClick={closeOrderScreen}>
          ← Voltar para o site
        </button>
        {orderExperience}
      </main>
    )
  }

  return (
    <main className={`locco-premium ${heroPhotoLoaded ? 'has-real-burger' : ''} ${placePhotoLoaded ? 'has-place-photo' : ''}`}>
      <CursorTrail />
      <div className="locco-premium-noise" aria-hidden="true" />
      <div className="locco-premium-word word-left" aria-hidden="true">LOCCO</div>
      <div className="locco-premium-word word-right" aria-hidden="true">BRASA</div>

      <section className="locco-premium-hero" id="inicio">
        <header className="locco-premium-header">
          <a className="locco-premium-brand" href="/" aria-label="LoccoBurger inicio">
            <BrandLogo />
            <span>
              <strong>LoccoBurger</strong>
              <small>Hamburgueria na brasa</small>
            </span>
          </a>

          <nav aria-label="Navegacao do site LoccoBurger">
            <a href="#quem-somos">Quem somos</a>
            <a href="#brasa">Na brasa</a>
            <a href={deliveryUrl}>Delivery</a>
            <a href="#pedido" onClick={openOrderScreen}>Pedido</a>
            <a href="#ponto-da-carne">Ponto da carne</a>
            <a href="#cardapio">Cardápio</a>
            <a href="#localizacao">Localização</a>
          </nav>

          <div className="locco-premium-header-actions">
            <a className="locco-premium-order-link" href="#pedido" onClick={openOrderScreen}>
              Ver app
            </a>
          </div>
        </header>

        <div className="locco-premium-hero-grid">
          <section className="locco-premium-copy">
            <p className="locco-premium-kicker">Santo André • artesanal • na brasa</p>
            <h1>
              Hamburguer artesanal
              <span>feito na brasa.</span>
            </h1>
            <p className="locco-premium-lead">
              O LoccoBurger prepara lanches na brasa com ingredientes frescos, carne selecionada e aquele sabor marcante de hamburgueria de verdade.
            </p>

            <div className="locco-premium-score-card">
              <span>★ ★ ★ ★ ★</span>
              <strong>Burger Cebola Caramelizada</strong>
              <small>Especial da casa com queijo, carne na brasa e cebola caramelizada.</small>
            </div>

            <div className="locco-premium-actions">
              <a className="locco-premium-primary" href={deliveryUrl}>Fazer pedido delivery</a>
              <a className="locco-premium-secondary" href="#pedido" onClick={openOrderScreen}>Ver app de pedidos</a>
              <a className="locco-premium-secondary" href={mapsUrl} target="_blank" rel="noreferrer">Ver localização</a>
            </div>

            <div className="locco-premium-tags" aria-label="Diferenciais LoccoBurger">
              <span>Carne na brasa</span>
              <span>Ingredientes frescos</span>
              <span>Delivery online</span>
            </div>
          </section>

          <section className="locco-premium-food-stage" aria-label="Burger destaque LoccoBurger">
            <div className="locco-premium-launch-card">
              <span>Especial da casa</span>
              <strong>Burger Cebola Caramelizada</strong>
              <small>Imagem real do lanche em breve.</small>
            </div>

            <div className="locco-premium-hero-photo">
              <img
                alt="Burger artesanal do LoccoBurger"
                src="/locco-site/hero-burger-v2.png"
                onLoad={() => setHeroPhotoLoaded(true)}
                onError={() => setHeroPhotoLoaded(false)}
              />
              <div className="locco-premium-css-burger" aria-hidden="true">
                <span className="bun top" />
                <span className="lettuce" />
                <span className="cheese" />
                <span className="meat" />
                <span className="onion" />
                <span className="bun bottom" />
                <span className="board" />
              </div>
            </div>
          </section>
        </div>

        <a className="locco-premium-scroll-cue" href="#quem-somos" aria-label="Explorar a página">
          <span aria-hidden="true" />
          Explorar
        </a>
      </section>

      <section className="locco-premium-section locco-premium-about" id="quem-somos">
        <div>
          <p className="locco-premium-kicker">Quem somos</p>
          <h2>Uma hamburgueria com identidade, cuidado e sabor marcante.</h2>
        </div>
        <p>
          Somos uma hamburgueria de Santo André feita para quem gosta de lanche bem montado,
          atendimento direto e comida preparada com atenção. Cada detalhe importa: o pão,
          a carne, o ponto, os acompanhamentos e a experiência de receber você no nosso espaço.
        </p>
      </section>

      <section className="locco-premium-cards" id="brasa">
        <article>
          <span>01</span>
          <h3>Feito na brasa</h3>
          <p>O preparo ganha aroma, intensidade e aquele sabor defumado que marca cada mordida.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Produtos frescos</h3>
          <p>Ingredientes selecionados para entregar qualidade, textura e equilíbrio em cada lanche.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Variedade Locco</h3>
          <p>Combinações para diferentes fomes e momentos, sempre com a personalidade da casa.</p>
        </article>
      </section>

      <section className="locco-premium-app-section" id="delivery">
        <div className="locco-premium-app-copy">
          <p className="locco-premium-kicker">Novo app de pedidos</p>
          <h2>Peça pelo delivery, na mesa ou até no estacionamento.</h2>
          <p>
            O LoccoBurger agora tem uma interface própria para pedidos: você monta o carrinho,
            acompanha o status e escolhe se quer retirar, receber no delivery ou pedir ajuda no atendimento.
          </p>
          <div className="locco-premium-app-options">
            <span>Delivery online</span>
            <span>QR Code na mesa</span>
            <span>Pedido no estacionamento</span>
            <span>Atendimento assistido por ChatGPT</span>
          </div>
          <div className="locco-premium-actions">
            <a className="locco-premium-primary" href={deliveryUrl}>Fazer pedido pelo delivery</a>
            <a className="locco-premium-secondary" href="#pedido" onClick={openOrderScreen}>Ver interface do app</a>
          </div>
        </div>

        <div className="locco-premium-app-card" aria-label="Interface de pedidos LoccoBurger">
          <span>Pedido Locco</span>
          <strong>Escolha, envie e acompanhe.</strong>
          <small>Pedido chega no atendimento, passa pela cozinha e atualiza o status para o cliente.</small>
          <a href={deliveryUrl}>Abrir delivery</a>
        </div>
      </section>

      <section className="locco-premium-meat-section" id="ponto-da-carne">
        <div className="locco-premium-meat-copy">
          <p className="locco-premium-kicker">Ponto da carne</p>
          <h2>Escolha o ponto e sinta a diferença na mordida.</h2>
          <p>
            A carne muda textura, aroma e suculência conforme o ponto. Clique nas camadas para entender
            qual combina mais com sua fome de hoje.
          </p>

          <div className="locco-premium-meat-selector" role="tablist" aria-label="Escolha do ponto da carne">
            {meatPoints.map((point) => (
              <button
                className={selectedMeatPoint.id === point.id ? 'is-active' : ''}
                key={point.id}
                type="button"
                role="tab"
                aria-selected={selectedMeatPoint.id === point.id}
                onClick={() => setSelectedMeatPoint(point)}
              >
                <span>{point.label}</span>
                <small>{point.temperature}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="locco-premium-meat-stack" aria-label="Pontos da carne LoccoBurger">
          <img
            className="locco-premium-meat-image"
            src="/locco-site/pontos-carne-3d-v1.png"
            alt="Montagem 3D com hambúrgueres em diferentes pontos da carne"
          />
          <div className="locco-premium-meat-hotspots" aria-label="Clique no ponto da carne desejado">
            {meatPoints.map((point) => (
              <button
                className={`locco-premium-meat-hotspot ${selectedMeatPoint.id === point.id ? 'is-active' : ''}`}
                key={point.id}
                type="button"
                style={{ '--point-y': point.imagePosition }}
                onClick={() => setSelectedMeatPoint(point)}
                aria-pressed={selectedMeatPoint.id === point.id}
              >
                <span>{point.label}</span>
                <small>{point.temperature}</small>
              </button>
            ))}
          </div>
        </div>

        <aside className="locco-premium-meat-detail" aria-live="polite">
          <span>Selecionado</span>
          <h3>{selectedMeatPoint.label}</h3>
          <strong>{selectedMeatPoint.temperature}</strong>
          <p>{selectedMeatPoint.description}</p>
        </aside>
      </section>

      <section className="locco-premium-mayo-section" id="maionese-da-casa">
        <div className="locco-premium-mayo-copy">
          <p className="locco-premium-kicker">Maionese da casa</p>
          <h2>Artesanal, cremosa e feita para acompanhar batata e burger.</h2>
          <p>
            A maionese artesanal da LoccoBurger chega com toque suave, textura cremosa e aquele sabor
            de acompanhamento que faz a porção de batata sumir da mesa rapidinho.
          </p>
          <a className="locco-premium-secondary" href={deliveryUrl}>
            Pedir com maionese da casa
          </a>
        </div>

        <div className="locco-premium-mayo-art" aria-label="Arte 3D da maionese artesanal">
          <div className="mayo-pot">
            <span className="mayo-lid" />
            <span className="mayo-label">Locco</span>
            <span className="mayo-shine" />
            <span className="mayo-drip drip-one" />
            <span className="mayo-drip drip-two" />
            <span className="mayo-drip drip-three" />
          </div>
          <div className="mayo-sauce" />
        </div>
      </section>

      <section className="locco-premium-menu-section" id="cardapio">
        <div className="locco-premium-menu-copy">
          <p className="locco-premium-kicker">Cardápio</p>
          <h2>Escolha seu Locco favorito e peça pelo app.</h2>
          <p>
            Tem burger clássico, smash, especiais da casa, porção de batata e bebidas. Dá uma olhada
            no cardápio e faça seu pedido direto pela nova interface de delivery.
          </p>
          <div className="locco-premium-menu-highlights" aria-label="Destaques do cardápio">
            {menuHighlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <a className="locco-premium-primary" href={deliveryUrl}>
            Fazer pedido no delivery
          </a>
        </div>

        <a className="locco-premium-menu-card" href="/locco-site/cardapio-locco-burger.jpeg" target="_blank" rel="noreferrer">
          <img src="/locco-site/cardapio-locco-burger.jpeg" alt="Cardápio LoccoBurger" />
          <span>Abrir cardápio completo</span>
        </a>
      </section>

      <section className="locco-premium-experience">
        <div className="locco-premium-photo-card">
          <img
            alt="Espaço LoccoBurger"
            src="/locco-site/fachada.jpg"
            onLoad={() => setPlacePhotoLoaded(true)}
            onError={() => setPlacePhotoLoaded(false)}
          />
          <div className="locco-premium-photo-fallback">
            <strong>Nosso espaço</strong>
            <span>Adicione aqui foto da fachada ou do salão.</span>
          </div>
        </div>
        <div className="locco-premium-experience-text">
          <p className="locco-premium-kicker">Atendimento no local</p>
          <h2>Um lugar para chegar, pedir e curtir um burger de brasa.</h2>
          <p>
            Estamos sempre à disposição para receber você, preparar seu pedido com cuidado e entregar uma experiência
            que combine comida boa, ambiente direto e o estilo LoccoBurger. Se estiver no estacionamento,
            peça pela nova interface e acompanhe o andamento sem sair do lugar.
          </p>
        </div>
      </section>

      <section className="locco-premium-location" id="localizacao">
        <div>
          <p className="locco-premium-kicker">Localização</p>
          <h2>Estamos em Santo André.</h2>
          <p>Av. Nova Iorque, 304 - Santo André, Brazil</p>
          <div className="locco-premium-actions compact">
            <a className="locco-premium-primary" href={deliveryUrl}>Fazer pedido pelo app</a>
            <a className="locco-premium-secondary" href={whatsappUrl} target="_blank" rel="noreferrer">Pedir pelo WhatsApp</a>
            <a className="locco-premium-secondary" href={mapsUrl} target="_blank" rel="noreferrer">Abrir no Maps</a>
          </div>
        </div>

        <div className="locco-premium-hours">
          <h3>Horário de funcionamento</h3>
          <dl>
            <div><dt>Terça-feira</dt><dd>17:00–23:00</dd></div>
            <div><dt>Quarta-feira</dt><dd>17:00–23:00</dd></div>
            <div><dt>Quinta-feira</dt><dd>17:00–23:00</dd></div>
            <div><dt>Sexta-feira</dt><dd>17:00–23:00</dd></div>
            <div><dt>Sábado</dt><dd>17:00–23:00</dd></div>
            <div><dt>Domingo</dt><dd>Fechado</dd></div>
            <div><dt>Segunda-feira</dt><dd>Fechado</dd></div>
          </dl>
        </div>
      </section>

      <footer className="locco-premium-footer">
        <div className="locco-footer-main">
          <a className="locco-footer-brand" href="#inicio" aria-label="Voltar ao início do site LoccoBurger">
            <BrandLogo />
            <span>
              <strong>LoccoBurger</strong>
              <small>Hamburgueria artesanal na brasa em Santo André.</small>
            </span>
          </a>

          <nav className="locco-footer-column" aria-label="Pedido LoccoBurger">
            <strong>Pedido</strong>
            <a href={deliveryUrl}>Abrir delivery</a>
            <a href="#pedido" onClick={openOrderScreen}>Ver app de pedidos</a>
            <a href="#cardapio">Cardápio</a>
          </nav>

          <nav className="locco-footer-column" aria-label="Contato LoccoBurger">
            <strong>Contato</strong>
            <a href="https://www.instagram.com/loccoburger" target="_blank" rel="noreferrer">Instagram</a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="mailto:loccoburgercontato@gmail.com">E-mail</a>
          </nav>

          <nav className="locco-footer-column" aria-label="Endereço LoccoBurger">
            <strong>Loja</strong>
            <a href={mapsUrl} target="_blank" rel="noreferrer">Av. Nova Iorque, 304</a>
            <a href="#localizacao">Horários</a>
            <a className="locco-premium-admin-footer-link" href={adminUrl}>Página de adm</a>
          </nav>
        </div>

        <div className="locco-footer-bottom">
          <span>© {currentYear} LoccoBurger. Todos os direitos reservados.</span>
          <small>Hambúrguer artesanal, carne na brasa e atendimento direto.</small>
        </div>
      </footer>
    </main>
  )
}
const initialExpenses = [
  { id: 1, description: 'Compra hortifruti', category: 'Insumos', amount: 186.4, status: 'pago', time: '10:40' },
  { id: 2, description: 'Motoboy extra', category: 'Operacional', amount: 90, status: 'pendente', time: '18:30' },
  { id: 3, description: 'Gas cozinha', category: 'Utilidades', amount: 132, status: 'pago', time: '09:15' },
]

const kitchenStatusFlow = ['em preparo', 'finalizado']
const remoteSyncIntervalMs = 60000
const remoteSyncMinRefreshMs = 9000
const remoteApplyWriteGuardMs = 4500
const localWriteSyncGuardMs = 12000
const deviceViewStorageKey = 'loccoburger-device-view'

const deviceViewOptions = [
  { id: 'auto', label: 'Auto' },
  { id: 'phone', label: 'Celular' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Computador' },
]

const syncStatusLabels = {
  idle: 'Sync aguardando',
  connecting: 'Conectando sync',
  online: 'Tempo real ativo',
  updating: 'Sincronizando',
  fallback: 'Sync por intervalo',
  error: 'Sync instavel',
}

const clientDeliveryStatusRank = {
  novo: 0,
  aprovado: 1,
  preparando: 2,
  pronto: 3,
  despachado: 4,
  entregue: 5,
  recusado: 6,
  cancelado: 6,
}

function mapAdminDeliveryStatusToClientStatus(status) {
  return status === 'novo' ? 'aprovado' : status
}

function getClientDeliveryPatchFromAdminOrder(order, now = Date.now()) {
  const clientStatus = mapAdminDeliveryStatusToClientStatus(order?.status)
  const statusMessages = {
    aprovado: 'A loja aceitou seu pedido. Ele ja foi enviado para a cozinha.',
    preparando: 'Seu pedido esta em preparo na cozinha.',
    pronto: 'Seu pedido ficou pronto e esta aguardando saida.',
    despachado: 'Seu pedido saiu para entrega. Previsao de chegada em ate 30 minutos.',
    entregue: 'Pedido entregue. Bom apetite!',
  }

  return {
    status: clientStatus,
    eta: order?.eta ?? (clientStatus === 'entregue' ? 'Finalizado' : '35 min'),
    adminDeliveryId: order?.id,
    adminMessage: statusMessages[clientStatus] ?? 'Pedido atualizado pela loja.',
    updatedAt: new Date(now).toISOString(),
    dispatchedAt: clientStatus === 'despachado' ? new Date(now).toISOString() : undefined,
    deliveryAutoCompleteAt: clientStatus === 'despachado' ? now + 30 * 60 * 1000 : undefined,
    deliveredAt: clientStatus === 'entregue' ? new Date(now).toISOString() : undefined,
  }
}

function shouldSyncClientDeliveryOrder(clientOrder, nextStatus) {
  if (!clientOrder || !nextStatus) return false
  if (['recusado', 'cancelado'].includes(clientOrder.status)) return false

  const currentRank = clientDeliveryStatusRank[clientOrder.status] ?? -1
  const nextRank = clientDeliveryStatusRank[nextStatus] ?? currentRank
  return nextRank >= currentRank
}

function findLinkedClientDeliveryOrder(deliveryOrder, clientOrders = []) {
  if (!deliveryOrder) return null

  if (deliveryOrder.clientDeliveryOrderId) {
    const linkedByDelivery = clientOrders.find((order) => order.id === deliveryOrder.clientDeliveryOrderId)
    if (linkedByDelivery) return linkedByDelivery
  }

  const linkedByClient = clientOrders.find((order) => order.adminDeliveryId === deliveryOrder.id)
  if (linkedByClient) return linkedByClient

  return null
}

const accessProfiles = {
  admin: {
    label: 'Administrador',
    homePage: 'dashboard',
    pages: ['dashboard', 'operacao-dia', 'mesas', 'delivery', 'clientes', 'cozinha', 'caixa', 'produtos', 'estoque', 'compras', 'ficha-tecnica', 'financeiro', 'dre', 'usuarios'],
  },
  atendimento: {
    label: 'Atendimento',
    homePage: 'mesas',
    pages: ['mesas', 'delivery', 'clientes', 'caixa'],
  },
  cozinha: {
    label: 'Cozinha',
    homePage: 'cozinha',
    pages: ['cozinha'],
  },
  garcom: {
    label: 'Garcom',
    homePage: 'mesas',
    pages: ['mesas'],
  },
}

function minutesAgo(minutes) {
  return Date.now() - minutes * 60 * 1000
}

function createInitialKitchenState() {
  const activeOrders = kitchenQueue.map((order, index) => {
    const createdAt = minutesAgo([4, 11, 14, 2][index] ?? 3)

    return {
      ...order,
      status: 'em preparo',
      createdAt,
      startedAt: createdAt,
      finalizedAt: null,
      completedAt: null,
      deliveredAt: null,
      targetMinutes: [12, 16, 8, 13][index] ?? 12,
    }
  })

  const completedOrders = [
    {
      id: '#1019',
      source: 'Mesa 4',
      item: '2x Combo Cheddar Bacon',
      status: 'finalizado',
      priority: 'normal',
      createdAt: minutesAgo(72),
      startedAt: minutesAgo(69),
      finalizedAt: minutesAgo(58),
      completedAt: minutesAgo(55),
      deliveredAt: minutesAgo(52),
      targetMinutes: 16,
    },
    {
      id: '#1020',
      source: 'Delivery',
      item: '1x Milkshake Cookies',
      status: 'finalizado',
      priority: 'normal',
      createdAt: minutesAgo(38),
      startedAt: minutesAgo(36),
      finalizedAt: minutesAgo(32),
      completedAt: minutesAgo(30),
      deliveredAt: minutesAgo(28),
      targetMinutes: 6,
    },
  ]

  return [...activeOrders, ...completedOrders]
}

function normalizeKitchenOrder(order) {
  if (order.status === 'finalizado' || order.status === 'em preparo') return order

  const isCompleted = Boolean(order.completedAt) || ['pronto', 'entregue'].includes(order.status)
  return {
    ...order,
    status: isCompleted ? 'finalizado' : 'em preparo',
    startedAt: order.startedAt ?? order.createdAt,
    completedAt: isCompleted ? order.completedAt ?? order.deliveredAt ?? Date.now() : null,
  }
}

function createDefaultTablesState() {
  return Array.from({ length: 4 }, (_, index) => {
    const tableNumber = String(index + 1)
    const tableLabel = `Mesa ${tableNumber}`

    return {
      id: index + 1,
      guests: 0,
      status: 'livre',
      attendant: '-',
      total: 0,
      customerName: '',
      tableNumber,
      tableLabel,
      dynamic: false,
      fixedQr: true,
      orderItems: [],
      tabs: [{
        id: `${index + 1}-mesa`,
        name: 'Mesa',
        orderItems: [],
        tableNumber,
        tableLabel,
        dynamic: false,
        fixedQr: true,
      }],
    }
  })
}

const legacyMockTableBlueprint = new Map(tables.map((table) => [Number(table.id), table]))

function tableHasOrderItems(table) {
  return (table?.orderItems ?? []).length > 0 ||
    (table?.tabs ?? []).some((tab) => (tab.orderItems ?? []).length > 0)
}

function isLegacyMockTable(table) {
  const blueprint = legacyMockTableBlueprint.get(Number(table?.id))
  if (!blueprint) return false

  const hasRealItems = tableHasOrderItems(table)
  const hasCustomerName = String(table?.customerName ?? getTableMainTab(table)?.customerName ?? '').trim().length > 0
  const sameStatus = String(table.status ?? '') === String(blueprint.status ?? '')
  const sameAttendant = String(table.attendant ?? '-') === String(blueprint.attendant ?? '-')
  const sameTotal = Number(table.total || 0) === Number(blueprint.total || 0)
  const noQrMetadata = !table.tableNumber && !table.tableLabel && !table.fixedQr
  const emptyResetLegacyTable = Number(table.id) > 4 &&
    Number(table.id) <= 10 &&
    noQrMetadata &&
    !hasRealItems &&
    !hasCustomerName &&
    String(table.status ?? 'livre') === 'livre' &&
    Number(table.total || 0) === 0

  return (!hasRealItems && !hasCustomerName && sameStatus && sameAttendant && sameTotal && noQrMetadata) ||
    emptyResetLegacyTable
}

function getNormalizedTableNumber(table) {
  const mainTab = getTableMainTab(table)
  return String(table?.tableNumber ?? mainTab?.tableNumber ?? '').trim()
}

function getTableDeduplicationKey(table) {
  const tableNumber = getNormalizedTableNumber(table)
  if (tableNumber) return `mesa:${tableNumber}`

  const customerName = String(table?.customerName ?? getTableMainTab(table)?.customerName ?? '').trim().toLowerCase()
  if (customerName) return `comanda:${customerName}:${table.id}`

  return `id:${table.id}`
}

function getTableKeepScore(table) {
  const tableNumber = getNormalizedTableNumber(table)
  const idMatchesQr = tableNumber && Number(tableNumber) === Number(table.id)

  return (tableHasOrderItems(table) ? 100 : 0) +
    (Number(table.total || 0) > 0 ? 80 : 0) +
    (table.status && table.status !== 'livre' ? 60 : 0) +
    (String(table.customerName ?? getTableMainTab(table)?.customerName ?? '').trim() ? 50 : 0) +
    (table.fixedQr ? 30 : 0) +
    (idMatchesQr ? 10 : 0)
}

function normalizeTableRecord(table) {
  const mainTab = getTableMainTab(table)
  const fixedQr = Boolean(table.fixedQr)
  const tableNumber = String(table.tableNumber ?? mainTab?.tableNumber ?? (fixedQr ? table.id : '')).trim()
  const tableLabel = String(table.tableLabel ?? mainTab?.tableLabel ?? (fixedQr && tableNumber ? `Mesa ${tableNumber}` : '')).trim()
  const tableId = Number(table.id) || Date.now()
  const metadata = {
    customerName: table.customerName ?? mainTab?.customerName ?? '',
    customerPhone: table.customerPhone ?? mainTab?.customerPhone ?? '',
    tableNumber,
    tableLabel,
    dynamic: Boolean(table.dynamic),
    fixedQr,
  }

  return applyTableSessionMetadata({
    id: tableId,
    guests: Number(table.guests || 0),
    status: table.status ?? 'livre',
    attendant: table.attendant ?? '-',
    total: Number(table.total || 0),
    orderItems: table.orderItems ?? mainTab?.orderItems ?? [],
    tabs: table.tabs?.length
      ? table.tabs
      : [createMainTableTab(tableId, metadata, table.orderItems ?? [])],
    fixedQr,
  }, metadata)
}

function normalizeTablesState(currentTables = []) {
  if (!Array.isArray(currentTables) || currentTables.length === 0) return createDefaultTablesState()

  const legacyTables = currentTables.filter(isLegacyMockTable)
  const looksLikeOriginalMockState = currentTables.length === legacyMockTableBlueprint.size &&
    legacyTables.length >= legacyMockTableBlueprint.size - 1

  if (looksLikeOriginalMockState) return createDefaultTablesState()

  const defaultFixedTables = createDefaultTablesState()
  const normalizedTables = currentTables
    .filter((table) => !isLegacyMockTable(table) || Number(table.id) <= 4)
    .map((table) => {
      const defaultTable = defaultFixedTables.find((item) => item.id === Number(table.id))
      return defaultTable && isLegacyMockTable(table) ? defaultTable : normalizeTableRecord(table)
    })

  const dedupedTables = Array.from(
    normalizedTables.reduce((tableMap, table) => {
      const tableKey = getTableDeduplicationKey(table)
      const currentTable = tableMap.get(tableKey)

      if (!currentTable || getTableKeepScore(table) > getTableKeepScore(currentTable)) {
        tableMap.set(tableKey, table)
      }

      return tableMap
    }, new Map()).values(),
  )

  return dedupedTables.sort((first, second) => {
    const firstNumber = Number(first.tableNumber ?? first.id)
    const secondNumber = Number(second.tableNumber ?? second.id)
    if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) return firstNumber - secondNumber
    return String(getTableSessionLabel(first)).localeCompare(String(getTableSessionLabel(second)))
  })
}

function getTableMainTab(table) {
  return table?.tabs?.find((tab) => String(tab.id).endsWith('-mesa')) ?? table?.tabs?.[0] ?? null
}

function getTableSessionLabel(table) {
  if (!table) return 'Mesa'

  const mainTab = getTableMainTab(table)
  const tableNumber = String(table.tableNumber ?? mainTab?.tableNumber ?? '').trim()
  const customerName = String(table.customerName ?? mainTab?.customerName ?? '').trim()
  const tableLabel = String(table.tableLabel ?? mainTab?.tableLabel ?? '').trim()

  if (tableLabel) return tableLabel
  if (tableNumber && customerName) return `Mesa ${tableNumber} - ${customerName}`
  if (tableNumber) return `Mesa ${tableNumber}`
  if (customerName) return `Comanda ${customerName}`
  return `Mesa ${String(table.id).padStart(2, '0')}`
}

function getTableTabs(table) {
  return table?.tabs?.length
    ? table.tabs
    : [{ id: `${table?.id ?? 'mesa'}-mesa`, name: 'Mesa', orderItems: table?.orderItems ?? [] }]
}

function getTableTabTotal(tab) {
  return (tab?.orderItems ?? []).reduce((total, item) => total + Number(item.total || 0), 0)
}

function normalizeComparableText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isDateOnlyKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim())
}

function findTableTabForClient(table, order) {
  const customerName = normalizeComparableText(order?.customerName)
  const customerPhone = normalizeComparableText(order?.phone)
  const sessionId = normalizeComparableText(order?.sessionId)

  return getTableTabs(table).find((tab) => {
    const tabName = normalizeComparableText(tab.name ?? tab.customerName)
    const tabPhone = normalizeComparableText(tab.customerPhone ?? tab.phone)
    const tabSessionId = normalizeComparableText(tab.sessionId)

    return (
      (sessionId && tabSessionId === sessionId) ||
      (customerPhone && tabPhone === customerPhone) ||
      (customerName && tabName === customerName)
    )
  })
}

function getPaymentDateKey(payment) {
  if (isDateOnlyKey(payment?.paidAtIso)) return String(payment.paidAtIso).trim()
  if (payment?.paidAtIso) return getLocalDateKey(new Date(payment.paidAtIso))
  if (isDateOnlyKey(payment?.createdAtIso)) return String(payment.createdAtIso).trim()
  if (payment?.createdAtIso) return getLocalDateKey(new Date(payment.createdAtIso))

  const paidAt = String(payment?.paidAt ?? '').trim()
  const match = paidAt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`

  return getLocalDateKey(new Date())
}

function getPaymentHour(payment) {
  if (isDateOnlyKey(payment?.paidAtIso) || isDateOnlyKey(payment?.createdAtIso)) {
    const timeMatch = String(payment?.time ?? '').match(/^(\d{1,2})/)
    if (timeMatch) return Number(timeMatch[1])
  }
  if (payment?.paidAtIso) return new Date(payment.paidAtIso).getHours()
  const timeMatch = String(payment?.time ?? '').match(/^(\d{1,2})/)
  if (timeMatch) return Number(timeMatch[1])
  return new Date().getHours()
}

function buildDashboardSnapshot({
  clientDeliveryOrders = [],
  clientQrOrders = [],
  deliveries = [],
  inventoryItems = [],
  kitchenOrders = [],
  payments = [],
  products = [],
  tables = [],
}) {
  const todayKey = getLocalDateKey(new Date())
  const todayPayments = payments.filter((payment) => getPaymentDateKey(payment) === todayKey)
  const salesToday = todayPayments.reduce((total, payment) => total + Number(payment.amount ?? payment.netAmount ?? 0), 0)
  const occupiedTables = tables.filter((table) =>
    Number(table.total || 0) > 0 || getTableTabs(table).some((tab) => getTableTabTotal(tab) > 0),
  ).length
  const activeDeliveries = deliveries.filter((order) =>
    !['entregue', 'cancelado', 'recusado', 'pago'].includes(String(order.status ?? '').toLowerCase()),
  ).length
  const activeKitchen = kitchenOrders.filter((order) => order.status !== 'finalizado').length
  const pendingQr = clientQrOrders.filter((order) => order.status === 'novo').length
  const pendingSiteDelivery = clientDeliveryOrders.filter((order) => order.status === 'novo').length
  const stockAlerts = inventoryItems.filter((item) => Number(item.currentStock ?? 0) <= Number(item.minStock ?? 0)).length

  const hourlyMap = todayPayments.reduce((accumulator, payment) => {
    const hour = getPaymentHour(payment)
    const label = `${String(hour).padStart(2, '0')}h`
    accumulator.set(label, (accumulator.get(label) ?? 0) + Number(payment.amount ?? payment.netAmount ?? 0))
    return accumulator
  }, new Map())
  const hourlySales = Array.from(hourlyMap.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([label, value]) => ({ label, value }))

  const productMap = todayPayments.reduce((accumulator, payment) => {
    ;(payment.items ?? []).forEach((item) => {
      const productName = item.name ?? products.find((product) => product.id === item.productId)?.name ?? 'Produto'
      const current = accumulator.get(productName) ?? { name: productName, quantity: 0, revenue: 0 }
      current.quantity += Number(item.quantity || 0)
      current.revenue += Number(item.total || (Number(item.unitPrice || 0) * Number(item.quantity || 0)))
      accumulator.set(productName, current)
    })
    return accumulator
  }, new Map())

  const topProducts = Array.from(productMap.values())
    .sort((first, second) => second.revenue - first.revenue)
    .slice(0, 5)
  const alerts = inventoryItems
    .filter((item) => Number(item.currentStock ?? 0) <= Number(item.minStock ?? 0))
    .slice(0, 6)
    .map((item) => `${item.name}: ${Number(item.currentStock ?? 0)} ${item.unit ?? ''}`)

  return {
    alerts,
    hourlySales,
    occupiedTables,
    openOrders: occupiedTables + activeDeliveries + activeKitchen + pendingQr + pendingSiteDelivery,
    salesToday,
    stockAlerts,
    topProducts,
  }
}

function createMainTableTab(tableId, metadata = {}, orderItems = []) {
  return {
    id: `${tableId}-mesa`,
    name: metadata.customerName || 'Mesa',
    orderItems,
    customerName: metadata.customerName || '',
    customerPhone: metadata.customerPhone || '',
    tableNumber: metadata.tableNumber || '',
    tableLabel: metadata.tableLabel || '',
    dynamic: Boolean(metadata.dynamic),
    fixedQr: Boolean(metadata.fixedQr),
  }
}

function applyTableSessionMetadata(table, metadata = {}) {
  const tableTabs = table.tabs?.length
    ? table.tabs
    : [createMainTableTab(table.id, {}, table.orderItems ?? [])]
  const mainTabId = `${table.id}-mesa`
  const hasMainTab = tableTabs.some((tab) => tab.id === mainTabId)
  const normalizedTabs = hasMainTab ? tableTabs : [createMainTableTab(table.id, {}, table.orderItems ?? []), ...tableTabs]

  return {
    ...table,
    customerName: metadata.customerName || '',
    customerPhone: metadata.customerPhone || '',
    tableNumber: metadata.tableNumber || '',
    tableLabel: metadata.tableLabel || '',
    dynamic: Boolean(metadata.dynamic),
    fixedQr: Boolean(metadata.fixedQr ?? table.fixedQr),
    tabs: normalizedTabs.map((tab) =>
      tab.id === mainTabId || tab.name === 'Mesa'
        ? {
            ...tab,
            name: metadata.customerName || tab.name || 'Mesa',
            customerName: metadata.customerName || '',
            customerPhone: metadata.customerPhone || '',
            tableNumber: metadata.tableNumber || '',
            tableLabel: metadata.tableLabel || '',
            dynamic: Boolean(metadata.dynamic),
            fixedQr: Boolean(metadata.fixedQr ?? table.fixedQr),
          }
        : tab,
    ),
  }
}

function createDefaultAppState() {
  return {
    inventory: inventoryItems,
    technicalSheets,
    tables: createDefaultTablesState(),
    kitchen: createInitialKitchenState(),
    payments: [],
    accountsReceivable: [],
    cashClosings: [],
    expenses: initialExpenses,
    stockAdjustments: [],
    customerCampaigns: [],
    customers,
    deliveries,
    whatsAppInbox: [],
    products,
    purchaseOrders: [],
  }
}

function normalizeProductChannels(channels = {}) {
  return {
    delivery: channels.delivery ?? true,
    qr: channels.qr ?? true,
  }
}

function normalizeProduct(product = {}) {
  return {
    ...product,
    description: String(product.description ?? ''),
    imageUrl: String(product.imageUrl ?? product.image_url ?? ''),
    availableChannels: normalizeProductChannels(product.availableChannels),
  }
}

function mergeProductMetadata(productsToNormalize = [], metadataProducts = []) {
  const metadataById = new Map(metadataProducts.map((product) => [Number(product.id), product]))

  return productsToNormalize.map((product) => {
    const metadata = metadataById.get(Number(product.id)) ?? {}
    return normalizeProduct({
      ...product,
      description: product.description ?? metadata.description,
      imageUrl: product.imageUrl ?? metadata.imageUrl,
      availableChannels: product.availableChannels ?? metadata.availableChannels,
    })
  })
}

function mergeOfficialProducts(currentProducts = []) {
  const customProducts = currentProducts.filter((product) => !products.some((defaultProduct) => defaultProduct.id === product.id))

  return [
    ...products.map((product) => {
      const currentProduct = currentProducts.find((item) => item.id === product.id)
      return normalizeProduct({
        ...product,
        ...(currentProduct ?? {}),
        active: currentProduct?.active ?? product.active,
      })
    }),
    ...customProducts.map(normalizeProduct),
  ]
}

function mergeOfficialInventory(currentInventory = []) {
  const customItems = currentInventory.filter((item) => !inventoryItems.some((defaultItem) => defaultItem.id === item.id))

  return [
    ...inventoryItems.map((item) => {
      const currentItem = currentInventory.find((current) => current.id === item.id)
      return {
        ...item,
        currentStock: currentItem?.currentStock ?? item.currentStock,
      }
    }),
    ...customItems,
  ]
}

function mergeOfficialTechnicalSheets(currentSheets = []) {
  const customSheets = currentSheets.filter((sheet) => !technicalSheets.some((defaultSheet) => defaultSheet.id === sheet.id))

  return [...technicalSheets, ...customSheets]
}

function normalizeCatalogState(catalog = {}) {
  return {
    inventory: mergeOfficialInventory(catalog.inventory ?? []),
    products: mergeOfficialProducts(catalog.products ?? []),
    technicalSheets: mergeOfficialTechnicalSheets(catalog.technicalSheets ?? []),
  }
}

function normalizeAppState(state) {
  return {
    ...state,
    inventory: mergeOfficialInventory(state.inventory),
    technicalSheets: mergeOfficialTechnicalSheets(state.technicalSheets),
    tables: normalizeTablesState(state.tables),
    kitchen: (state.kitchen ?? []).map(normalizeKitchenOrder),
    products: mergeOfficialProducts(state.products ?? products),
  }
}

function getPublicProductsSnapshot() {
  if (typeof window === 'undefined') return products

  const storedState = loadStoredState()
  return mergeOfficialProducts(storedState?.products ?? products)
}

function createStateSignature(value) {
  return JSON.stringify(value ?? null)
}

function getSyncRecordTime(record = {}) {
  const rawDate = record.paidAtIso ?? record.createdAtIso ?? record.updatedAt ?? record.createdAt
  const parsedDate = rawDate ? Date.parse(rawDate) : Number.NaN
  if (Number.isFinite(parsedDate)) return parsedDate

  const numericId = Number(String(record.id ?? '').match(/\d{10,}/)?.[0])
  return Number.isFinite(numericId) ? numericId : 0
}

function remoteCollectionLooksOlder(remoteItems = [], currentItems = []) {
  if (!currentItems.length) return false
  if (!remoteItems.length) return currentItems.length > 0

  const remoteIds = new Set(remoteItems.map((item) => String(item.id)))
  const currentLatestTime = Math.max(0, ...currentItems.map(getSyncRecordTime))
  const remoteLatestTime = Math.max(0, ...remoteItems.map(getSyncRecordTime))
  const missingLatestLocalRecord = currentItems.some((item) =>
    !remoteIds.has(String(item.id)) &&
    getSyncRecordTime(item) >= currentLatestTime &&
    currentLatestTime >= remoteLatestTime,
  )

  return missingLatestLocalRecord || currentItems.length > remoteItems.length
}

export default function App({ icons, hooks }) {
  if (isCustomerDeliveryRoute()) {
    return <CustomerDeliveryMenu products={getPublicProductsSnapshot()} />
  }

  if (isCustomerQrMenuRoute()) {
    return <CustomerQrMenu products={getPublicProductsSnapshot()} />
  }

  if (!isManagementAreaRoute()) {
    return <LandingMaintenancePage />
  }

  const defaultAppState = hooks.useMemo(() => normalizeAppState(createDefaultAppState()), [])
  const [currentUser, setCurrentUser] = hooks.useState(null)
  const [authMode, setAuthMode] = hooks.useState('signin')
  const [authEmail, setAuthEmail] = hooks.useState('')
  const [authPassword, setAuthPassword] = hooks.useState('')
  const [authStoreCode, setAuthStoreCode] = hooks.useState('')
  const [authStatus, setAuthStatus] = hooks.useState('idle')
  const [authMessage, setAuthMessage] = hooks.useState(null)
  const [authLoading, setAuthLoading] = hooks.useState(true)
  const [dataReady, setDataReady] = hooks.useState(false)
  const [saveStatus, setSaveStatus] = hooks.useState('idle')
  const [syncStatus, setSyncStatus] = hooks.useState({ mode: 'idle', label: syncStatusLabels.idle })
  const [deviceView, setDeviceView] = hooks.useState(() => {
    const savedView = window.localStorage.getItem(deviceViewStorageKey)
    return deviceViewOptions.some((option) => option.id === savedView) ? savedView : 'auto'
  })
  const [userProfile, setUserProfile] = hooks.useState(null)
  const catalogHydratedRef = hooks.useRef(false)
  const crmHydratedRef = hooks.useRef(false)
  const financeHydratedRef = hooks.useRef(false)
  const operationHydratedRef = hooks.useRef(false)
  const whatsappHydratedRef = hooks.useRef(false)
  const appStateRef = hooks.useRef(null)
  const remoteSyncRunningRef = hooks.useRef(false)
  const lastRemoteRefreshAtRef = hooks.useRef(0)
  const remoteApplyGuardUntilRef = hooks.useRef(0)
  const lastLocalWriteAtRef = hooks.useRef(0)
  const saveStatusRef = hooks.useRef(saveStatus)
  const repositoryStatus = hooks.useMemo(() => getRepositoryStatus(currentUser, saveStatus), [currentUser, saveStatus])
  const [activePage, setActivePage] = hooks.useState('dashboard')
  const [activeProfile, setActiveProfile] = hooks.useState('admin')
  const [inventoryState, setInventoryState] = hooks.useState(defaultAppState.inventory)
  const [technicalSheetsState, setTechnicalSheetsState] = hooks.useState(defaultAppState.technicalSheets)
  const [tablesState, setTablesState] = hooks.useState(defaultAppState.tables)
  const [kitchenState, setKitchenState] = hooks.useState(defaultAppState.kitchen)
  const [paymentsState, setPaymentsState] = hooks.useState(defaultAppState.payments)
  const [accountsReceivableState, setAccountsReceivableState] = hooks.useState(defaultAppState.accountsReceivable ?? [])
  const [cashClosingsState, setCashClosingsState] = hooks.useState(defaultAppState.cashClosings ?? [])
  const [expensesState, setExpensesState] = hooks.useState(defaultAppState.expenses)
  const [stockAdjustmentsState, setStockAdjustmentsState] = hooks.useState(defaultAppState.stockAdjustments ?? [])
  const [customersState, setCustomersState] = hooks.useState(defaultAppState.customers)
  const [customerCampaignsState, setCustomerCampaignsState] = hooks.useState(defaultAppState.customerCampaigns ?? [])
  const [deliveryState, setDeliveryState] = hooks.useState(defaultAppState.deliveries)
  const [whatsAppInboxState, setWhatsAppInboxState] = hooks.useState(defaultAppState.whatsAppInbox ?? [])
  const [productsState, setProductsState] = hooks.useState(defaultAppState.products ?? products)
  const [purchaseOrdersState, setPurchaseOrdersState] = hooks.useState(defaultAppState.purchaseOrders)
  const [clientQrOrdersState, setClientQrOrdersState] = hooks.useState(() => loadClientQrOrders())
  const [clientDeliveryOrdersState, setClientDeliveryOrdersState] = hooks.useState(() => loadClientDeliveryOrders())
  const [adminNotificationsState, setAdminNotificationsState] = hooks.useState(() => loadAdminNotifications().items)
  const notificationSeenKeysRef = useRef(loadSeenAdminNotificationKeys())
  const kitchenNotificationsPrimedRef = useRef(false)

  const navigation = hooks.useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', icon: icons.Home },
      { id: 'operacao-dia', label: 'Operacao Dia', icon: icons.BarChart3 },
      { id: 'mesas', label: 'Mesas', icon: icons.Utensils },
      { id: 'delivery', label: 'Delivery', icon: icons.Bike },
      { id: 'clientes', label: 'Clientes', icon: icons.Users },
      { id: 'cozinha', label: 'Cozinha', icon: icons.ChefHat },
      { id: 'caixa', label: 'Caixa', icon: icons.CreditCard },
      { id: 'produtos', label: 'Produtos', icon: icons.ShoppingBag },
      { id: 'estoque', label: 'Estoque', icon: icons.Boxes },
      { id: 'compras', label: 'Compras', icon: icons.Package },
      { id: 'ficha-tecnica', label: 'Ficha Tecnica', icon: icons.ClipboardList },
      { id: 'financeiro', label: 'Financeiro', icon: icons.DollarSign },
      { id: 'dre', label: 'DRE', icon: icons.FileSpreadsheet },
      { id: 'usuarios', label: 'Usuarios', icon: icons.UserCog },
    ],
    [icons],
  )

  const currentProfile = accessProfiles[activeProfile] ?? accessProfiles.admin
  const visibleNavigation = navigation.filter((item) => currentProfile.pages.includes(item.id))
  const pageTitle = navigation.find((item) => item.id === activePage)?.label ?? 'Dashboard'

  function getCurrentAppState() {
    return {
      inventory: inventoryState,
      technicalSheets: technicalSheetsState,
      tables: tablesState,
      kitchen: kitchenState,
      payments: paymentsState,
      accountsReceivable: accountsReceivableState,
      cashClosings: cashClosingsState,
      expenses: expensesState,
      stockAdjustments: stockAdjustmentsState,
      customers: customersState,
      customerCampaigns: customerCampaignsState,
      deliveries: deliveryState,
      whatsAppInbox: whatsAppInboxState,
      products: productsState,
      purchaseOrders: purchaseOrdersState,
    }
  }

  hooks.useEffect(() => {
    appStateRef.current = getCurrentAppState()
  }, [
    inventoryState,
    technicalSheetsState,
    tablesState,
    kitchenState,
    paymentsState,
    accountsReceivableState,
    cashClosingsState,
    expensesState,
    stockAdjustmentsState,
    customersState,
    customerCampaignsState,
    deliveryState,
    whatsAppInboxState,
    productsState,
    purchaseOrdersState,
  ])

  hooks.useEffect(() => {
    saveStatusRef.current = saveStatus
  }, [saveStatus])

  hooks.useEffect(() => {
    const syncClientQrOrders = () => {
      const storageOrders = loadClientQrOrders()

      setClientQrOrdersState((currentOrders) => {
        const nextOrders = mergeClientQrOrders(currentOrders, storageOrders)
        if (JSON.stringify(nextOrders) !== JSON.stringify(currentOrders)) saveClientQrOrders(nextOrders)
        return nextOrders
      })
    }

    const requestClientQrSync = () => {
      publishClientQrOrdersRequest({ admin: true }).catch(() => {})
    }
    const syncRemoteClientQrOrders = async () => {
      const remoteResult = await loadClientQrOrdersFromSupabase({ limit: 300 })
      if (!remoteResult.ok || !remoteResult.orders.length) return

      const nextOrders = mergeAndSaveClientQrOrders(remoteResult.orders)
      setClientQrOrdersState(nextOrders)
    }
    const intervalId = window.setInterval(syncClientQrOrders, 1500)
    const remoteIntervalId = window.setInterval(syncRemoteClientQrOrders, 6000)
    const syncRequestTimeoutId = window.setTimeout(requestClientQrSync, 900)
    const syncRequestIntervalId = window.setInterval(requestClientQrSync, 12000)
    syncRemoteClientQrOrders()
    const realtimeChannel = createClientQrBroadcastChannel({
      onOrder: (incomingOrder) => {
        const nextOrders = mergeAndSaveClientQrOrders([incomingOrder])
        setClientQrOrdersState(nextOrders)
      },
      onOrdersUpdated: (incomingOrders) => {
        const nextOrders = mergeAndSaveClientQrOrders(incomingOrders)
        setClientQrOrdersState(nextOrders)
      },
      onSyncRequest: (payload = {}) => {
        const criteria = payload?.criteria ?? payload ?? {}
        const requestedTable = String(criteria.tableNumber ?? '').trim()
        const requestedSessionIdentity = String(criteria.sessionIdentity ?? '').trim()
        const currentOrders = loadClientQrOrders().filter((order) => {
          if (requestedTable && String(order?.tableNumber ?? '').trim() !== requestedTable) return false
          if (requestedSessionIdentity && String(order?.sessionIdentity ?? '').trim() !== requestedSessionIdentity) return false
          return true
        })
        if (currentOrders.length) publishClientQrOrders(currentOrders).catch(() => {})
      },
    })
    const remoteChannel = subscribeToClientQrOrdersFromSupabase((incomingOrder) => {
      const nextOrders = mergeAndSaveClientQrOrders([incomingOrder])
      setClientQrOrdersState(nextOrders)
    })

    window.addEventListener('storage', syncClientQrOrders)
    window.addEventListener('loccoburger:client-qr-orders-updated', syncClientQrOrders)

    return () => {
      window.clearInterval(intervalId)
      window.clearInterval(remoteIntervalId)
      window.clearTimeout(syncRequestTimeoutId)
      window.clearInterval(syncRequestIntervalId)
      closeClientQrBroadcastChannel(realtimeChannel)
      closeClientQrOrdersSupabaseSubscription(remoteChannel)
      window.removeEventListener('storage', syncClientQrOrders)
      window.removeEventListener('loccoburger:client-qr-orders-updated', syncClientQrOrders)
    }
  }, [])

  hooks.useEffect(() => {
    const syncClientDeliveryOrders = () => setClientDeliveryOrdersState(loadClientDeliveryOrders())
    const intervalId = window.setInterval(syncClientDeliveryOrders, 1500)

    window.addEventListener('storage', syncClientDeliveryOrders)
    window.addEventListener('loccoburger:client-delivery-orders-updated', syncClientDeliveryOrders)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', syncClientDeliveryOrders)
      window.removeEventListener('loccoburger:client-delivery-orders-updated', syncClientDeliveryOrders)
    }
  }, [])

  hooks.useEffect(() => {
    if (!deliveryState.length || !clientDeliveryOrdersState.length) return

    const storedClientOrders = loadClientDeliveryOrders()
    if (!storedClientOrders.length) return

    let clientOrdersChanged = false
    let deliveryLinksChanged = false
    const now = Date.now()

    const reconciledClientOrders = storedClientOrders.map((clientOrder) => {
      const linkedDeliveryOrder = deliveryState.find((deliveryOrder) =>
        deliveryOrder.clientDeliveryOrderId === clientOrder.id ||
        clientOrder.adminDeliveryId === deliveryOrder.id,
      )

      if (!linkedDeliveryOrder) return clientOrder

      const patch = getClientDeliveryPatchFromAdminOrder(linkedDeliveryOrder, now)
      const nextStatus = patch.status
      const shouldAdvanceStatus = clientOrder.status !== nextStatus &&
        shouldSyncClientDeliveryOrder(clientOrder, nextStatus)
      const shouldAttachAdminId = !clientOrder.adminDeliveryId && patch.adminDeliveryId

      if (!shouldAdvanceStatus && !shouldAttachAdminId) return clientOrder

      clientOrdersChanged = true
      if (!shouldAdvanceStatus) {
        return { ...clientOrder, adminDeliveryId: patch.adminDeliveryId }
      }

      return Object.entries(patch).reduce((nextOrder, [key, value]) => {
        if (value !== undefined) nextOrder[key] = value
        return nextOrder
      }, { ...clientOrder })
    })

    const nextDeliveryState = deliveryState.map((deliveryOrder) => {
      if (deliveryOrder.clientDeliveryOrderId) return deliveryOrder

      const linkedClientOrder = findLinkedClientDeliveryOrder(deliveryOrder, reconciledClientOrders)
      if (!linkedClientOrder) return deliveryOrder

      deliveryLinksChanged = true
      return { ...deliveryOrder, clientDeliveryOrderId: linkedClientOrder.id }
    })

    if (clientOrdersChanged) {
      const savedOrders = saveClientDeliveryOrders(reconciledClientOrders)
      setClientDeliveryOrdersState(savedOrders)
    }

    if (deliveryLinksChanged) {
      setDeliveryState(nextDeliveryState)
    }
  }, [clientDeliveryOrdersState, deliveryState])

  function pushAdminNotification(notification) {
    const notificationKey = notification.key ?? notification.id
    if (!notificationKey || notificationSeenKeysRef.current.includes(notificationKey)) return

    const nextNotification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...notification,
      key: notificationKey,
    }
    const nextSeenKeys = saveSeenAdminNotificationKeys([notificationKey, ...notificationSeenKeysRef.current])
    notificationSeenKeysRef.current = nextSeenKeys

    setAdminNotificationsState((currentNotifications) => {
      const nextNotifications = [nextNotification, ...currentNotifications].slice(0, 120)
      saveAdminNotifications(nextNotifications)
      return nextNotifications
    })
  }

  function handleClearAdminNotifications() {
    const payload = clearAdminNotifications()
    setAdminNotificationsState(payload.items)
    return { ok: true, message: 'Notificacoes limpas.' }
  }

  hooks.useEffect(() => {
    clientQrOrdersState
      .filter((order) => order.status === 'novo')
      .forEach((order) => {
        pushAdminNotification({
          key: `qr:${order.id}`,
          type: order.type === 'fechamento' ? 'fechamento' : 'mesa',
          title: order.type === 'fechamento' ? 'Fechamento solicitado' : 'Novo pedido QR',
          message: `Mesa ${order.tableNumber} - ${order.customerName}`,
          targetPage: order.type === 'fechamento' ? 'caixa' : 'mesas',
        })
      })
  }, [clientQrOrdersState])

  hooks.useEffect(() => {
    clientDeliveryOrdersState
      .filter((order) => order.status === 'novo')
      .forEach((order) => {
        pushAdminNotification({
          key: `delivery:${order.id}`,
          type: 'delivery',
          title: 'Novo pedido delivery',
          message: `${order.customerName} - ${appCurrency.format(order.total || 0)}`,
          targetPage: 'delivery',
        })
      })
  }, [clientDeliveryOrdersState])

  hooks.useEffect(() => {
    if (!dataReady) return

    const activeKitchenOrders = kitchenState.filter((order) => order.status === 'em preparo')
    if (!kitchenNotificationsPrimedRef.current) {
      const primedKeys = activeKitchenOrders.map((order) => `kitchen:${order.id}`)
      notificationSeenKeysRef.current = saveSeenAdminNotificationKeys([
        ...primedKeys,
        ...notificationSeenKeysRef.current,
      ])
      kitchenNotificationsPrimedRef.current = true
      return
    }

    activeKitchenOrders.forEach((order) => {
      pushAdminNotification({
        key: `kitchen:${order.id}`,
        type: 'cozinha',
        title: 'Pedido novo na cozinha',
        message: `${order.source} - ${order.item}`,
        targetPage: 'cozinha',
      })
    })
  }, [dataReady, kitchenState])

  function applyAppState(state) {
    const nextState = normalizeAppState(state ?? defaultAppState)
    setInventoryState(nextState.inventory)
    setTechnicalSheetsState(nextState.technicalSheets)
    setTablesState(nextState.tables)
    setKitchenState(nextState.kitchen)
    setPaymentsState(nextState.payments ?? [])
    setAccountsReceivableState(nextState.accountsReceivable ?? [])
    setCashClosingsState(nextState.cashClosings ?? [])
    setExpensesState(nextState.expenses ?? [])
    setStockAdjustmentsState(nextState.stockAdjustments ?? [])
    setCustomersState(nextState.customers ?? [])
    setCustomerCampaignsState(nextState.customerCampaigns ?? [])
    setDeliveryState(nextState.deliveries ?? [])
    setWhatsAppInboxState(nextState.whatsAppInbox ?? [])
    setProductsState(nextState.products ?? products)
    setPurchaseOrdersState(nextState.purchaseOrders ?? [])
  }

  async function persistMaintenanceState(nextState, successMessage, options = {}) {
    const normalizedState = normalizeAppState(nextState)
    appStateRef.current = normalizedState
    applyAppState(normalizedState)
    lastLocalWriteAtRef.current = Date.now()
    setSaveStatus('saving')

    const saveJobs = [saveAppState(normalizedState)]

    if (currentUser) {
      saveJobs.push(
        saveCatalogTables({
          inventory: normalizedState.inventory ?? [],
          products: normalizedState.products ?? [],
          technicalSheets: normalizedState.technicalSheets ?? [],
        }),
        saveCustomerDeliveryTables({
          customers: normalizedState.customers ?? [],
          customerCampaigns: normalizedState.customerCampaigns ?? [],
          deliveries: normalizedState.deliveries ?? [],
        }),
        saveFinanceTables({
          payments: normalizedState.payments ?? [],
          accountsReceivable: normalizedState.accountsReceivable ?? [],
          expenses: normalizedState.expenses ?? [],
          cashClosings: normalizedState.cashClosings ?? [],
        }),
        saveOperationTables({
          tables: normalizedState.tables ?? [],
          kitchen: normalizedState.kitchen ?? [],
        }),
      )
    }

    const results = await Promise.all(saveJobs)
    const failedResult = results.find((result) => result && result.ok === false)
    const message = failedResult?.message ?? successMessage

    setSaveStatus(failedResult ? 'error' : 'saved')
    setAuthMessage({ type: failedResult ? 'error' : 'success', text: message })

    if (options.activePage) setActivePage(options.activePage)

    return { ok: !failedResult, message }
  }

  async function persistCheckoutState(nextState, successMessage) {
    const normalizedState = normalizeAppState(nextState)
    appStateRef.current = normalizedState
    applyAppState(normalizedState)
    lastLocalWriteAtRef.current = Date.now()
    setSaveStatus('saving')

    const saveJobs = [saveAppState(normalizedState)]

    if (currentUser) {
      saveJobs.push(
        saveCatalogTables({
          inventory: normalizedState.inventory ?? [],
          products: normalizedState.products ?? [],
          technicalSheets: normalizedState.technicalSheets ?? [],
        }),
        saveCustomerDeliveryTables({
          customers: normalizedState.customers ?? [],
          customerCampaigns: normalizedState.customerCampaigns ?? [],
          deliveries: normalizedState.deliveries ?? [],
        }),
        saveFinanceTables({
          payments: normalizedState.payments ?? [],
          accountsReceivable: normalizedState.accountsReceivable ?? [],
          expenses: normalizedState.expenses ?? [],
          cashClosings: normalizedState.cashClosings ?? [],
        }),
        saveOperationTables({
          tables: normalizedState.tables ?? [],
          kitchen: normalizedState.kitchen ?? [],
        }),
      )
    }

    const results = await Promise.all(saveJobs)
    const failedResult = results.find((result) => result && result.ok === false)
    const message = failedResult?.message ?? successMessage

    setSaveStatus(failedResult ? 'error' : 'saved')
    if (failedResult) {
      setAuthMessage({ type: 'error', text: message })
    }

    return { ok: !failedResult, message }
  }

  async function hydrateAppData() {
    setSaveStatus('loading')
    catalogHydratedRef.current = false
    crmHydratedRef.current = false
    financeHydratedRef.current = false
    operationHydratedRef.current = false
    whatsappHydratedRef.current = false
    const profileResult = await loadUserProfile()
    if (profileResult.ok) {
      const role = accessProfiles[profileResult.profile.role] ? profileResult.profile.role : 'atendimento'
      setUserProfile(profileResult.profile)
      setActiveProfile(role)
      setActivePage(accessProfiles[role].homePage)
    } else {
      setUserProfile(null)
      setActiveProfile('atendimento')
      setActivePage(accessProfiles.atendimento.homePage)
      setAuthMessage({ type: 'error', text: profileResult.message })
    }

    const result = await loadAppState(defaultAppState)
    let nextState = result.state
    const catalogResult = await loadCatalogTables()
    const crmResult = await loadCustomerDeliveryTables()
    const financeResult = await loadFinanceTables()
    const operationResult = await loadOperationTables()
    const whatsappResult = { ok: false, messages: [] }

    if (catalogResult.ok && catalogResult.hasData) {
      const catalogState = normalizeCatalogState(catalogResult.catalog)
      nextState = {
        ...nextState,
        inventory: catalogState.inventory,
        products: mergeProductMetadata(catalogState.products, nextState.products ?? []),
        technicalSheets: catalogState.technicalSheets,
      }
    }

    if (crmResult.ok && crmResult.hasData) {
      nextState = {
        ...nextState,
        customers: crmResult.data.customers,
        customerCampaigns: crmResult.data.customerCampaigns,
        deliveries: crmResult.data.deliveries,
      }
    }

    if (financeResult.ok && financeResult.hasData) {
      nextState = {
        ...nextState,
        payments: financeResult.data.payments,
        accountsReceivable: financeResult.data.accountsReceivable,
        expenses: financeResult.data.expenses,
        cashClosings: financeResult.data.cashClosings,
      }
    }

    if (operationResult.ok && operationResult.hasData) {
      nextState = {
        ...nextState,
        tables: operationResult.data.tables,
        kitchen: operationResult.data.kitchen,
      }
    }

    if (whatsappResult.ok) {
      nextState = {
        ...nextState,
        whatsAppInbox: whatsappResult.messages,
      }
    }

    applyAppState(nextState)
    setDataReady(true)
    catalogHydratedRef.current = true
    crmHydratedRef.current = true
    financeHydratedRef.current = true
    operationHydratedRef.current = true
    whatsappHydratedRef.current = true

    if (catalogResult.ok && !catalogResult.hasData) {
      await saveCatalogTables({
        inventory: nextState.inventory ?? [],
        products: nextState.products ?? [],
        technicalSheets: nextState.technicalSheets ?? [],
      })
    }

    if (crmResult.ok && !crmResult.hasData) {
      await saveCustomerDeliveryTables({
        customers: nextState.customers ?? [],
        customerCampaigns: nextState.customerCampaigns ?? [],
        deliveries: nextState.deliveries ?? [],
      })
    }

    if (financeResult.ok && !financeResult.hasData) {
      await saveFinanceTables({
        payments: nextState.payments ?? [],
        accountsReceivable: nextState.accountsReceivable ?? [],
        expenses: nextState.expenses ?? [],
        cashClosings: nextState.cashClosings ?? [],
      })
    }

    if (operationResult.ok && !operationResult.hasData) {
      await saveOperationTables({
        tables: nextState.tables ?? [],
        kitchen: nextState.kitchen ?? [],
      })
    }

    setSaveStatus(result.source === 'local-fallback' ? 'error' : 'idle')
    if (result.source === 'local-fallback') {
      setAuthMessage({ type: 'error', text: `${result.message} Os dados foram mantidos localmente por seguranca.` })
    } else if (result.source === 'migration') {
      setAuthMessage({ type: 'success', text: result.message })
    } else if (!profileResult.ok) {
      setAuthMessage({ type: 'error', text: profileResult.message })
    } else {
      setAuthMessage(null)
    }
  }

  function markRemoteStateApplied() {
    remoteApplyGuardUntilRef.current = Date.now() + remoteApplyWriteGuardMs
  }

  function isRemoteApplyGuardActive() {
    return Date.now() < remoteApplyGuardUntilRef.current
  }

  async function refreshSharedDataFromSupabase() {
    if (remoteSyncRunningRef.current || saveStatusRef.current === 'saving') return
    if (Date.now() - lastLocalWriteAtRef.current < localWriteSyncGuardMs) return
    if (Date.now() - lastRemoteRefreshAtRef.current < remoteSyncMinRefreshMs) return
    remoteSyncRunningRef.current = true
    lastRemoteRefreshAtRef.current = Date.now()

    try {
      const [appStateResult, catalogResult, crmResult, financeResult, operationResult] = await Promise.all([
        loadAppState(defaultAppState),
        loadCatalogTables(),
        loadCustomerDeliveryTables(),
        loadFinanceTables(),
        loadOperationTables(),
      ])
      const currentState = appStateRef.current ?? getCurrentAppState()
      const remoteAppState = appStateResult.state && appStateResult.source !== 'local-fallback'
        ? normalizeAppState(appStateResult.state)
        : null

      if (remoteAppState) {
        const remoteAuxiliaryState = {
          stockAdjustments: remoteAppState.stockAdjustments ?? [],
          purchaseOrders: remoteAppState.purchaseOrders ?? [],
        }
        const currentAuxiliaryState = {
          stockAdjustments: currentState.stockAdjustments ?? [],
          purchaseOrders: currentState.purchaseOrders ?? [],
        }

        if (createStateSignature(remoteAuxiliaryState) !== createStateSignature(currentAuxiliaryState)) {
          markRemoteStateApplied()
          setStockAdjustmentsState(remoteAuxiliaryState.stockAdjustments)
          setPurchaseOrdersState(remoteAuxiliaryState.purchaseOrders)
        }
      }

      if (catalogResult.ok && catalogResult.hasData) {
        const catalogState = normalizeCatalogState(catalogResult.catalog)
        const remoteCatalog = {
          inventory: catalogState.inventory,
          products: mergeProductMetadata(catalogState.products, remoteAppState?.products ?? currentState.products ?? []),
          technicalSheets: catalogState.technicalSheets,
        }
        const currentCatalog = {
          inventory: currentState.inventory,
          products: currentState.products,
          technicalSheets: currentState.technicalSheets,
        }

        if (createStateSignature(remoteCatalog) !== createStateSignature(currentCatalog)) {
          markRemoteStateApplied()
          setInventoryState(remoteCatalog.inventory)
          setProductsState(remoteCatalog.products)
          setTechnicalSheetsState(remoteCatalog.technicalSheets)
        }
      }

      if (crmResult.ok && crmResult.hasData) {
        const remoteCrm = {
          customers: crmResult.data.customers,
          customerCampaigns: crmResult.data.customerCampaigns,
          deliveries: crmResult.data.deliveries,
        }
        const currentCrm = {
          customers: currentState.customers,
          customerCampaigns: currentState.customerCampaigns,
          deliveries: currentState.deliveries,
        }

        if (createStateSignature(remoteCrm) !== createStateSignature(currentCrm)) {
          markRemoteStateApplied()
          setCustomersState(remoteCrm.customers)
          setCustomerCampaignsState(remoteCrm.customerCampaigns)
          setDeliveryState(remoteCrm.deliveries)
        }
      }

      if (financeResult.ok && financeResult.hasData) {
        const remoteFinance = {
          payments: financeResult.data.payments,
          accountsReceivable: financeResult.data.accountsReceivable,
          expenses: financeResult.data.expenses,
          cashClosings: financeResult.data.cashClosings,
        }
        const currentFinance = {
          payments: currentState.payments,
          accountsReceivable: currentState.accountsReceivable,
          expenses: currentState.expenses,
          cashClosings: currentState.cashClosings,
        }
        const remoteFinanceIsOlder =
          remoteCollectionLooksOlder(remoteFinance.payments, currentFinance.payments ?? []) ||
          remoteCollectionLooksOlder(remoteFinance.accountsReceivable, currentFinance.accountsReceivable ?? []) ||
          remoteCollectionLooksOlder(remoteFinance.cashClosings, currentFinance.cashClosings ?? [])

        if (!remoteFinanceIsOlder && createStateSignature(remoteFinance) !== createStateSignature(currentFinance)) {
          markRemoteStateApplied()
          setPaymentsState(remoteFinance.payments)
          setAccountsReceivableState(remoteFinance.accountsReceivable)
          setExpensesState(remoteFinance.expenses)
          setCashClosingsState(remoteFinance.cashClosings)
        }
      }

      if (operationResult.ok && operationResult.hasData) {
        const remoteOperation = {
          tables: normalizeTablesState(operationResult.data.tables),
          kitchen: operationResult.data.kitchen,
        }
        const currentOperation = {
          tables: currentState.tables,
          kitchen: currentState.kitchen,
        }

        if (createStateSignature(remoteOperation) !== createStateSignature(currentOperation)) {
          markRemoteStateApplied()
          setTablesState(remoteOperation.tables)
          setKitchenState(remoteOperation.kitchen)
        }
      }

    } finally {
      remoteSyncRunningRef.current = false
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthStatus('loading')
    setAuthMessage(null)

    const authResult = authMode === 'signup'
      ? await signUp(authEmail, authPassword, { storeCode: authStoreCode })
      : await signIn(authEmail, authPassword)

    if (!authResult.ok) {
      setAuthStatus('error')
      setAuthMessage({ type: 'error', text: authResult.message })
      return
    }

    if (!authResult.session?.user) {
      setAuthStatus('idle')
      setAuthMessage({ type: 'success', text: authResult.message })
      return
    }

    setCurrentUser(authResult.session.user)
    setAuthStatus('idle')
    setAuthPassword('')
    setAuthStoreCode('')
    await hydrateAppData()
  }

  async function handlePasswordReset() {
    setAuthStatus('loading')
    setAuthMessage(null)

    const result = await resetPassword(authEmail)

    setAuthStatus(result.ok ? 'idle' : 'error')
    setAuthMessage({ type: result.ok ? 'success' : 'error', text: result.message })
  }

  async function handleLogout() {
    setSaveStatus('saving')
    await saveAppState(getCurrentAppState())
    const result = await signOut()
    setCurrentUser(null)
    setUserProfile(null)
    setDataReady(false)
    setAuthMode('signin')
    setAuthPassword('')
    setSaveStatus('idle')
    setAuthMessage({ type: result.ok ? 'success' : 'error', text: result.message })
  }

  function handleProfileChange(profileId) {
    if (userProfile?.role !== 'admin') return
    const nextProfile = accessProfiles[profileId] ?? accessProfiles.admin
    setActiveProfile(profileId)
    setActivePage(nextProfile.pages.includes(activePage) ? activePage : nextProfile.homePage)
  }

  function handleNavigate(pageId) {
    if (!currentProfile.pages.includes(pageId)) return
    setActivePage(pageId)
  }

  function handleDeviceViewChange(nextView) {
    const view = deviceViewOptions.some((option) => option.id === nextView) ? nextView : 'auto'
    setDeviceView(view)
    window.localStorage.setItem(deviceViewStorageKey, view)
  }

  hooks.useEffect(() => {
    if (!currentProfile.pages.includes(activePage)) {
      setActivePage(currentProfile.homePage)
    }
  }, [activePage, currentProfile.homePage, currentProfile.pages])

  hooks.useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const session = await getCurrentSession()
      if (cancelled) return

      if (session?.user) {
        setCurrentUser(session.user)
        await hydrateAppData()
      }

      if (!cancelled) {
        setAuthLoading(false)
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady || isRemoteApplyGuardActive()) return undefined

    setSaveStatus('saving')
    const timeoutId = window.setTimeout(async () => {
      if (isRemoteApplyGuardActive()) return
      const result = await saveAppState(getCurrentAppState())
      setSaveStatus(result.ok ? 'saved' : 'error')
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentUser,
    dataReady,
    inventoryState,
    technicalSheetsState,
    tablesState,
    kitchenState,
    paymentsState,
    accountsReceivableState,
    cashClosingsState,
    expensesState,
    stockAdjustmentsState,
    customersState,
    customerCampaignsState,
    deliveryState,
    whatsAppInboxState,
    productsState,
    purchaseOrdersState,
  ])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady || !catalogHydratedRef.current || isRemoteApplyGuardActive()) return undefined

    const timeoutId = window.setTimeout(() => {
      if (isRemoteApplyGuardActive()) return
      saveCatalogTables({
        inventory: inventoryState,
        products: productsState,
        technicalSheets: technicalSheetsState,
      })
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentUser,
    dataReady,
    inventoryState,
    productsState,
    technicalSheetsState,
  ])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady || !crmHydratedRef.current || isRemoteApplyGuardActive()) return undefined

    const timeoutId = window.setTimeout(() => {
      if (isRemoteApplyGuardActive()) return
      saveCustomerDeliveryTables({
        customers: customersState,
        customerCampaigns: customerCampaignsState,
        deliveries: deliveryState,
      })
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentUser,
    dataReady,
    customersState,
    customerCampaignsState,
    deliveryState,
  ])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady || !financeHydratedRef.current || isRemoteApplyGuardActive()) return undefined

    const timeoutId = window.setTimeout(() => {
      if (isRemoteApplyGuardActive()) return
      lastLocalWriteAtRef.current = Date.now()
      saveFinanceTables({
        payments: paymentsState,
        accountsReceivable: accountsReceivableState,
        expenses: expensesState,
        cashClosings: cashClosingsState,
      })
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentUser,
    dataReady,
    paymentsState,
    accountsReceivableState,
    expensesState,
    cashClosingsState,
  ])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady || !operationHydratedRef.current || isRemoteApplyGuardActive()) return undefined

    const timeoutId = window.setTimeout(() => {
      if (isRemoteApplyGuardActive()) return
      saveOperationTables({
        tables: tablesState,
        kitchen: kitchenState,
      })
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentUser,
    dataReady,
    tablesState,
    kitchenState,
  ])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady) return undefined

    let cancelled = false
    let unsubscribe = null
    setSyncStatus({ mode: 'connecting', label: syncStatusLabels.connecting })

    subscribeToSharedDataChanges({
      onChange: async () => {
        if (cancelled) return
        setSyncStatus({ mode: 'updating', label: syncStatusLabels.updating })
        await refreshSharedDataFromSupabase()
        if (!cancelled) {
          setSyncStatus({ mode: 'online', label: syncStatusLabels.online })
        }
      },
      onStatus: ({ status }) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          setSyncStatus({ mode: 'online', label: syncStatusLabels.online })
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSyncStatus({ mode: 'fallback', label: syncStatusLabels.fallback })
        }
      },
    }).then((result) => {
      if (cancelled) {
        result.unsubscribe?.()
        return
      }

      unsubscribe = result.unsubscribe
      if (!result.ok) {
        setSyncStatus({ mode: 'fallback', label: syncStatusLabels.fallback })
      }
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [currentUser, dataReady])

  hooks.useEffect(() => {
    if (!currentUser || !dataReady) return undefined

    const intervalId = window.setInterval(() => {
      refreshSharedDataFromSupabase()
    }, remoteSyncIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [currentUser, dataReady])

  async function handleResetData() {
    clearAppState()
    const currentState = getCurrentAppState()
    const cleanState = {
      ...currentState,
      tables: createDefaultTablesState(),
      kitchen: [],
      payments: [],
      accountsReceivable: [],
      cashClosings: [],
      expenses: [],
      stockAdjustments: [],
      customers: [],
      customerCampaigns: [],
      deliveries: [],
      whatsAppInbox: [],
      purchaseOrders: [],
    }

    return persistMaintenanceState(
      cleanState,
      'Dados de teste limpos. Operacao, clientes de teste, delivery, financeiro e DRE foram zerados no sistema.',
      { activePage: 'dashboard' },
    )
  }

  async function handleResetOperationData() {
    const currentState = getCurrentAppState()
    const cleanState = {
      ...currentState,
      tables: createDefaultTablesState(),
      kitchen: [],
      deliveries: [],
      whatsAppInbox: [],
    }

    return persistMaintenanceState(
      cleanState,
      'Operacao limpa. Mesas, comandas, delivery e fila da cozinha foram zerados.',
      { activePage: 'mesas' },
    )
  }

  async function handleResetFinancialData() {
    const currentState = getCurrentAppState()
    const cleanState = {
      ...currentState,
      payments: [],
      accountsReceivable: [],
      cashClosings: [],
      expenses: [],
      stockAdjustments: [],
    }

    return persistMaintenanceState(
      cleanState,
      'Financeiro limpo. Faturamento, lucro, DRE, recebiveis e fechamentos foram zerados.',
      { activePage: 'financeiro' },
    )
  }

  async function handleResetInventoryStock() {
    const currentState = getCurrentAppState()
    const cleanState = {
      ...currentState,
      inventory: currentState.inventory.map((item) => ({
        ...item,
        currentStock: 0,
      })),
      stockAdjustments: [],
    }

    return persistMaintenanceState(
      cleanState,
      'Estoque zerado. Os insumos continuam cadastrados, mas todas as quantidades ficaram em 0.',
      { activePage: 'estoque' },
    )
  }

  async function handleSaveProduct(product) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentProducts = currentState.products ?? productsState
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const shouldCreateSheet = product.recipeId === 'new-sheet'
    const productId = product.id ? Number(product.id) : Date.now()
    let nextTechnicalSheets = currentSheets
    let nextRecipeId = product.recipeId

    if (shouldCreateSheet) {
      const newSheet = createEmptyTechnicalSheet({ currentSheets, productId })
      nextRecipeId = newSheet.id
      nextTechnicalSheets = [newSheet, ...currentSheets]
    }

    const nextProducts = saveProduct({
      currentProducts,
      product: {
        ...product,
        id: productId,
        recipeId: nextRecipeId,
      },
    })

    const nextState = {
      ...currentState,
      products: nextProducts,
      technicalSheets: nextTechnicalSheets,
    }

    return persistMaintenanceState(
      nextState,
      `${product.name || 'Produto'} salvo no cardapio e sincronizado com pedidos.`,
      { activePage: 'produtos' },
    )
  }

  async function handleToggleProduct(productId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentProducts = currentState.products ?? productsState
    const product = currentProducts.find((item) => item.id === productId)
    const nextProducts = toggleProductStatus(currentProducts, productId)
    const nextProduct = nextProducts.find((item) => item.id === productId)

    return persistMaintenanceState(
      { ...currentState, products: nextProducts },
      `${product?.name ?? 'Produto'} ${nextProduct?.active ? 'ativado' : 'inativado'} no cardapio.`,
      { activePage: 'produtos' },
    )
  }

  async function handleDeleteProduct(productId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentProducts = currentState.products ?? productsState
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const product = currentProducts.find((item) => item.id === productId)

    if (!product) return { ok: false, message: 'Produto nao encontrado.' }

    const nextProducts = currentProducts.filter((item) => item.id !== productId)
    const nextTechnicalSheets = currentSheets.filter((sheet) => sheet.productId !== productId)

    return persistMaintenanceState(
      {
        ...currentState,
        products: nextProducts,
        technicalSheets: nextTechnicalSheets,
      },
      `${product.name} excluido do cardapio.`,
      { activePage: 'produtos' },
    )
  }

  async function handleSaveInventoryItem(item) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const nextInventory = saveInventoryItem({ currentItems: currentState.inventory ?? inventoryState, item })
    const nextState = {
      ...currentState,
      inventory: nextInventory,
    }

    return persistMaintenanceState(nextState, `${item.name} salvo no estoque.`)
  }

  function handleStockEntry(entry) {
    setInventoryState((currentItems) =>
      currentItems.map((item) => (item.id === entry.inventoryItemId ? applyStockEntry(item, entry) : item)),
    )
  }

  function handleStockAdjustment(adjustment) {
    const newAdjustment = createStockAdjustment({
      adjustment,
      currentAdjustments: stockAdjustmentsState,
      inventoryItems: inventoryState,
    })
    if (!newAdjustment) return null

    setInventoryState((currentItems) =>
      currentItems.map((item) =>
        item.id === newAdjustment.inventoryItemId ? applyStockAdjustment(item, newAdjustment) : item,
      ),
    )
    setStockAdjustmentsState((currentAdjustments) => [newAdjustment, ...currentAdjustments])
    return newAdjustment
  }

  function handleCreatePurchaseOrder(order) {
    const newOrder = createPurchaseOrder({ currentOrders: purchaseOrdersState, inventoryItems: inventoryState, order })
    if (!newOrder) return null

    setPurchaseOrdersState((currentOrders) => [newOrder, ...currentOrders])
    return newOrder
  }

  function handleReceivePurchaseOrder(orderId) {
    const order = purchaseOrdersState.find((item) => item.id === orderId)
    const receipt = receivePurchaseOrder(order)
    if (!receipt) return

    handleStockEntry(receipt.stockEntry)

    setPurchaseOrdersState((currentOrders) =>
      currentOrders.map((item) => (item.id === orderId ? receipt.receivedOrder : item)),
    )
  }

  function handleCancelPurchaseOrder(orderId) {
    setPurchaseOrdersState((currentOrders) =>
      currentOrders.filter((order) => !(order.id === orderId && order.status === 'aberto')),
    )
  }

  function handleImportFiscalCoupon(importData) {
    importData.items.forEach((item) => {
      handleStockEntry({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        supplier: importData.supplier,
      })
    })

    setPurchaseOrdersState((currentOrders) => [
      createFiscalCouponReceipt({ currentOrders, importData }),
      ...currentOrders,
    ])
  }

  async function handleAddIngredient(sheetId, ingredient) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const nextSheets = currentSheets.map((sheet) =>
      sheet.id === sheetId ? addIngredientToSheet(sheet, ingredient) : sheet,
    )

    return persistMaintenanceState(
      { ...currentState, technicalSheets: nextSheets },
      'Ingrediente adicionado na ficha tecnica.',
    )
  }

  async function handleRemoveIngredient(sheetId, inventoryItemId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const nextSheets = currentSheets.map((sheet) =>
      sheet.id === sheetId ? removeIngredientFromSheet(sheet, inventoryItemId) : sheet,
    )

    return persistMaintenanceState(
      { ...currentState, technicalSheets: nextSheets },
      'Ingrediente removido da ficha tecnica.',
    )
  }

  async function handleUpdateTechnicalSheet(sheetId, details) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const nextSheets = currentSheets.map((sheet) =>
      sheet.id === sheetId ? updateTechnicalSheetDetails(sheet, details) : sheet,
    )

    return persistMaintenanceState(
      { ...currentState, technicalSheets: nextSheets },
      'Ficha tecnica salva.',
    )
  }

  async function handleCreateTechnicalSheet(productId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentProducts = currentState.products ?? productsState
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const product = currentProducts.find((item) => item.id === productId)
    if (!product) return { ok: false, message: 'Produto nao encontrado para criar ficha tecnica.' }
    if (product.recipeId) return { ok: true, message: `${product.name} ja possui ficha tecnica.` }

    const newSheet = createEmptyTechnicalSheet({ currentSheets, productId })
    const nextProducts = currentProducts.map((item) =>
      item.id === productId ? { ...item, recipeId: newSheet.id } : item,
    )
    const nextSheets = [newSheet, ...currentSheets]

    return persistMaintenanceState(
      { ...currentState, products: nextProducts, technicalSheets: nextSheets },
      `Ficha tecnica criada para ${product.name}. Agora cadastre os insumos.`,
      { activePage: 'ficha-tecnica' },
    )
  }

  async function handleDeleteTechnicalSheet(sheetId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentProducts = currentState.products ?? productsState
    const currentSheets = currentState.technicalSheets ?? technicalSheetsState
    const sheet = currentSheets.find((item) => item.id === sheetId)
    if (!sheet) return { ok: false, message: 'Ficha tecnica nao encontrada.' }

    const product = currentProducts.find((item) => item.id === sheet.productId)
    const nextSheets = currentSheets.filter((item) => item.id !== sheetId)
    const nextProducts = currentProducts.map((item) =>
      item.recipeId === sheetId ? { ...item, recipeId: null } : item,
    )

    return persistMaintenanceState(
      { ...currentState, products: nextProducts, technicalSheets: nextSheets },
      `Ficha tecnica de ${product?.name ?? 'produto'} excluida. O produto ficou sem baixa automatica ate receber nova ficha.`,
      { activePage: 'ficha-tecnica' },
    )
  }

  function commitTablesState(nextTables, successMessage) {
    const nextState = normalizeAppState({
      ...(appStateRef.current ?? getCurrentAppState()),
      tables: nextTables,
      kitchen: kitchenState,
    })

    appStateRef.current = nextState
    setTablesState(nextState.tables)
    lastLocalWriteAtRef.current = Date.now()
    setSaveStatus('saving')

    const saveJobs = [saveAppState(nextState)]
    if (currentUser) {
      saveJobs.push(saveOperationTables({ tables: nextState.tables, kitchen: nextState.kitchen ?? [] }))
    }

    Promise.all(saveJobs)
      .then((results) => {
        const failedResult = results.find((result) => result && result.ok === false)
        setSaveStatus(failedResult ? 'error' : 'saved')
        if (failedResult) {
          setAuthMessage({ type: 'error', text: failedResult.message ?? 'Operacao da mesa atualizada localmente, mas ainda nao sincronizou.' })
        }
      })
      .catch((error) => {
        setSaveStatus('error')
        setAuthMessage({ type: 'error', text: error?.message ?? 'Operacao da mesa atualizada localmente, mas ainda nao sincronizou.' })
      })

    return { ok: true, message: successMessage, tables: nextState.tables }
  }

  function handleOpenTable(tableId, metadata = {}) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const nextTables = currentTables.map((table) =>
      table.id === tableId && table.status === 'livre'
        ? applyTableSessionMetadata({
            ...table,
            status: 'ocupada',
            guests: Math.max(1, table.guests || 1),
            attendant: metadata.attendant || 'Balcao',
            tabs: table.tabs?.length
              ? table.tabs
              : [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: table.orderItems ?? [] }],
          }, metadata)
        : table,
    )

    commitTablesState(nextTables, 'Mesa aberta para atendimento.')
  }

  function handleCreateTableSession(session = {}) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const tableNumber = String(session.tableNumber ?? '').trim()
    const customerName = String(session.customerName ?? '').trim()
    const customerPhone = String(session.customerPhone ?? session.phone ?? '').trim()
    const attendant = String(session.attendant ?? '').trim() || 'Balcao'

    if (!tableNumber && !customerName) return null

    const existingTable = tableNumber
      ? currentTables.find((table) => {
          const mainTab = getTableMainTab(table)
          const currentNumber = String(table.tableNumber ?? mainTab?.tableNumber ?? table.id).trim()
          return currentNumber === tableNumber && table.status === 'livre'
        })
      : null
    const tableId = existingTable?.id ?? Date.now()
    const tableLabel = tableNumber && customerName
      ? `Mesa ${tableNumber} - ${customerName}`
      : tableNumber
        ? `Mesa ${tableNumber}`
        : `Comanda ${customerName}`
    const metadata = {
      tableNumber,
      customerName,
      customerPhone,
      tableLabel,
      dynamic: !existingTable,
    }
    const nextTable = applyTableSessionMetadata({
      ...(existingTable ?? {
        id: tableId,
        guests: 0,
        status: 'livre',
        attendant: '-',
        total: 0,
        orderItems: [],
        tabs: [createMainTableTab(tableId, metadata)],
      }),
      id: tableId,
      status: 'ocupada',
      guests: 1,
      attendant,
      total: existingTable?.total ?? 0,
      orderItems: existingTable?.orderItems ?? [],
    }, metadata)

    const nextTables = existingTable
      ? currentTables.map((table) => (table.id === existingTable.id ? nextTable : table))
      : [nextTable, ...currentTables]

    commitTablesState(nextTables, `${tableLabel} aberta para atendimento.`)

    return nextTable
  }

  function handleCreateFixedQrTable(tableNumberValue) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const tableNumber = String(tableNumberValue ?? '').trim()

    if (!tableNumber) return { ok: false, message: 'Informe o numero da mesa fixa para gerar o QR Code.' }

    const tableAlreadyExists = currentTables.some((table) => {
      const mainTab = getTableMainTab(table)
      const currentNumber = String(table.tableNumber ?? mainTab?.tableNumber ?? '').trim()
      return currentNumber === tableNumber || String(table.id) === tableNumber
    })

    if (tableAlreadyExists) return { ok: false, message: `A mesa ${tableNumber} ja existe.` }

    const numericId = Number(tableNumber)
    const tableId = Number.isInteger(numericId) && numericId > 0 && !currentTables.some((table) => table.id === numericId)
      ? numericId
      : Date.now()
    const tableLabel = `Mesa ${tableNumber}`
    const metadata = {
      tableNumber,
      tableLabel,
      customerName: '',
      customerPhone: '',
      dynamic: false,
      fixedQr: true,
    }
    const newTable = applyTableSessionMetadata({
      id: tableId,
      guests: 0,
      status: 'livre',
      attendant: '-',
      total: 0,
      customerName: '',
      tableNumber,
      tableLabel,
      dynamic: false,
      fixedQr: true,
      orderItems: [],
      tabs: [createMainTableTab(tableId, metadata)],
    }, metadata)

    const nextTables = normalizeTablesState([...currentTables, newTable])
    commitTablesState(nextTables, `${tableLabel} criada. O QR Code aponta para /mesa/${tableNumber}.`)

    return {
      ok: true,
      table: newTable,
      message: `${tableLabel} criada. O QR Code aponta para /mesa/${tableNumber}.`,
    }
  }

  function handleAddTableGuest(tableId, guestName) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const guestPayload = typeof guestName === 'object' && guestName !== null
      ? guestName
      : { name: guestName, phone: '' }
    const guestLabel = String(guestPayload.name ?? '').trim()
    const guestPhone = String(guestPayload.phone ?? '').trim()
    const guestSessionId = String(guestPayload.sessionId ?? '').trim()
    const newTab = {
      id: `${tableId}-${Date.now()}`,
      name: guestLabel,
      customerName: guestLabel,
      customerPhone: guestPhone,
      sessionId: guestSessionId,
      orderItems: [],
    }

    if (!newTab.name) return null

    const nextTables = currentTables.map((table) =>
      table.id === tableId
        ? {
            ...table,
            status: table.status === 'livre' ? 'ocupada' : table.status,
            guests: (table.tabs?.filter((tab) => tab.name !== 'Mesa').length ?? 0) + 1,
            attendant: table.attendant === '-' ? 'Balcao' : table.attendant,
            tabs: [
              ...(table.tabs?.length
                ? table.tabs
                : [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: table.orderItems ?? [] }]),
              newTab,
            ],
          }
        : table,
    )

    commitTablesState(nextTables, `Comanda de ${newTab.name} adicionada.`)

    return newTab
  }

  function resetTableForNewService(table) {
    const mainTab = getTableMainTab(table)
    const fixedQr = Boolean(table.fixedQr)
    const tableNumber = fixedQr ? String(table.tableNumber ?? mainTab?.tableNumber ?? table.id).trim() : ''
    const tableLabel = fixedQr && tableNumber ? `Mesa ${tableNumber}` : ''
    const metadata = {
      tableNumber,
      tableLabel,
      customerName: '',
      customerPhone: '',
      dynamic: false,
      fixedQr,
    }

    return {
      ...table,
      status: 'livre',
      guests: 0,
      attendant: '-',
      total: 0,
      orderItems: [],
      customerName: '',
      customerPhone: '',
      tableNumber,
      tableLabel,
      dynamic: false,
      fixedQr,
      tabs: [createMainTableTab(table.id, metadata, [])],
    }
  }

  function handleRequestTableClose(tableId, options = {}) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const table = currentTables.find((currentTable) => currentTable.id === tableId)
    if (!table) return { ok: false, message: 'Mesa nao encontrada.' }

    const tableTabs = getTableTabs(table)
    const requestedTabId = options.tabId && options.tabId !== 'all' ? options.tabId : null

    if (requestedTabId) {
      const targetTab = tableTabs.find((tab) => tab.id === requestedTabId)
      if (!targetTab) return { ok: false, message: 'Comanda nao encontrada nesta mesa.' }

      const targetTotal = getTableTabTotal(targetTab)
      if (targetTotal <= 0) {
        return {
          ok: true,
          message: `Comanda de ${targetTab.name} esta sem consumo para fechar.`,
        }
      }

      const nextTables = currentTables.map((currentTable) => {
        if (currentTable.id !== tableId) return currentTable

        const nextTabs = getTableTabs(currentTable).map((tab) =>
          tab.id === requestedTabId
            ? {
                ...tab,
                closingRequestedAt: new Date().toISOString(),
                closingRequestedBy: options.customerName ?? targetTab.name,
                status: 'fechamento',
              }
            : tab,
        )
        const hasOpenConsumption = nextTabs.some((tab) => getTableTabTotal(tab) > 0 && tab.status !== 'fechamento')

        return {
          ...currentTable,
          status: hasOpenConsumption ? 'ocupada' : 'fechamento',
          tabs: nextTabs,
        }
      })

      commitTablesState(nextTables, `Comanda de ${targetTab.name} enviada para fechamento no caixa.`)

      return {
        ok: true,
        message: `Comanda de ${targetTab.name} enviada para fechamento no caixa.`,
        tabId: requestedTabId,
      }
    }

    if (Number(table.total || 0) <= 0) {
      if (table.status === 'livre') {
        return { ok: true, message: `${getTableSessionLabel(table)} ja esta livre e sem consumo.` }
      }

      const nextTables = currentTables.flatMap((currentTable) => {
        if (currentTable.id !== tableId) return [currentTable]
        return currentTable.dynamic ? [] : [resetTableForNewService(currentTable)]
      })
      commitTablesState(nextTables, `${getTableSessionLabel(table)} estava sem consumo e foi liberada sem passar pelo caixa.`)

      return {
        ok: true,
        message: `${getTableSessionLabel(table)} estava sem consumo e foi liberada sem passar pelo caixa.`,
      }
    }

    if (options.reset) {
      const nextTables = currentTables.flatMap((currentTable) => {
        if (currentTable.id !== tableId) return [currentTable]
        return currentTable.dynamic ? [] : [resetTableForNewService(currentTable)]
      })
      commitTablesState(nextTables, `${getTableSessionLabel(table)} fechada e resetada.`)
      return { ok: true, message: `${getTableSessionLabel(table)} fechada e resetada.` }
    }

    const nextTables = currentTables.map((currentTable) =>
      currentTable.id === tableId && currentTable.status !== 'livre'
        ? { ...currentTable, status: 'fechamento' }
        : currentTable,
    )
    commitTablesState(nextTables, `${getTableSessionLabel(table)} enviada para fechamento.`)

    return { ok: true, message: `${getTableSessionLabel(table)} enviada para fechamento.` }
  }

  function handleReopenTableClose(tableId, options = {}) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const table = currentTables.find((currentTable) => currentTable.id === tableId)
    if (!table) return { ok: false, message: 'Mesa nao encontrada.' }

    const requestedTabId = options.tabId && options.tabId !== 'all' ? options.tabId : null
    const reopenTab = (tab) => {
      const { closingRequestedAt, closingRequestedBy, ...safeTab } = tab
      return {
        ...safeTab,
        status: tab.status === 'fechamento' ? 'ocupada' : tab.status,
      }
    }
    const getStatusFromTabs = (tabs) => {
      const total = tabs.reduce((sum, tab) => sum + getTableTabTotal(tab), 0)
      if (total <= 0) return 'livre'

      const hasClosingConsumption = tabs.some((tab) => getTableTabTotal(tab) > 0 && tab.status === 'fechamento')
      const hasOpenConsumption = tabs.some((tab) => getTableTabTotal(tab) > 0 && tab.status !== 'fechamento')

      if (hasClosingConsumption && !hasOpenConsumption) return 'fechamento'
      return 'ocupada'
    }

    let reopenedLabel = getTableSessionLabel(table)
    const nextTables = currentTables.map((currentTable) => {
      if (currentTable.id !== tableId) return currentTable

      const currentTabs = getTableTabs(currentTable)
      let nextTabs = currentTabs

      if (requestedTabId) {
        const targetTab = currentTabs.find((tab) => tab.id === requestedTabId)
        if (targetTab) reopenedLabel = `Comanda de ${targetTab.name}`
        nextTabs = currentTabs.map((tab) => (tab.id === requestedTabId ? reopenTab(tab) : tab))
      } else {
        nextTabs = currentTabs.map(reopenTab)
      }

      const nextTotal = nextTabs.reduce((sum, tab) => sum + getTableTabTotal(tab), 0)

      return {
        ...currentTable,
        status: getStatusFromTabs(nextTabs),
        total: nextTotal,
        orderItems: nextTabs.flatMap((tab) => tab.orderItems ?? []),
        tabs: nextTabs,
      }
    })

    if (requestedTabId && JSON.stringify(nextTables) === JSON.stringify(currentTables)) {
      return { ok: false, message: 'Comanda nao encontrada para reabrir.' }
    }

    commitTablesState(nextTables, `${reopenedLabel} reaberta para atendimento.`)

    return { ok: true, message: `${reopenedLabel} reaberta para atendimento.` }
  }

  function updateStoredClientQrOrders(updater) {
    const currentOrders = loadClientQrOrders()
    const nextOrders = typeof updater === 'function' ? updater(currentOrders) : currentOrders
    const savedOrders = saveClientQrOrders(nextOrders)
    const currentOrdersById = new Map(currentOrders.map((order) => [order.id, order]))
    savedOrders
      .filter((order) => JSON.stringify(order) !== JSON.stringify(currentOrdersById.get(order.id)))
      .forEach((order) => saveClientQrOrderToSupabase(order).catch(() => {}))
    setClientQrOrdersState(savedOrders)
    publishClientQrOrders(savedOrders).catch(() => {})
    return savedOrders
  }

  function markClientQrOrder(orderId, patch) {
    let updatedOrder = null
    updateStoredClientQrOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) return order

        updatedOrder = {
          ...order,
          ...(typeof patch === 'function' ? patch(order) : patch),
        }
        return updatedOrder
      }),
    )

    return updatedOrder
  }

  function closeClientQrSessionForTable(table) {
    const mainTab = getTableMainTab(table)
    const tableNumber = String(table?.tableNumber ?? mainTab?.tableNumber ?? '').trim()
    if (!tableNumber) return

    const nowIso = new Date().toISOString()
    clearClientQrSession(tableNumber)
    updateStoredClientQrOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (String(order.tableNumber ?? '').trim() !== tableNumber) return order
        if (['recusado', 'erro', 'pago', 'fechado', 'cancelado'].includes(order.status)) return order

        return {
          ...order,
          status: order.type === 'fechamento' ? 'pago' : 'fechado',
          paidAt: nowIso,
          adminMessage: 'Comanda paga e mesa liberada. O proximo cliente abre uma nova sessao.',
        }
      }),
    )
  }

  function closeClientQrSessionForTableTab(table, tabId) {
    const mainTab = getTableMainTab(table)
    const tableNumber = String(table?.tableNumber ?? mainTab?.tableNumber ?? '').trim()
    const targetTab = getTableTabs(table).find((tab) => tab.id === tabId)
    if (!tableNumber || !targetTab) return

    const nowIso = new Date().toISOString()
    const targetName = normalizeComparableText(targetTab.customerName ?? targetTab.name)
    const targetPhone = normalizeComparableText(targetTab.customerPhone ?? targetTab.phone)
    const targetSessionId = normalizeComparableText(targetTab.sessionId)

    clearClientQrSession(tableNumber, {
      customerName: targetTab.customerName ?? targetTab.name,
      phone: targetTab.customerPhone ?? targetTab.phone,
    })

    updateStoredClientQrOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (String(order.tableNumber ?? '').trim() !== tableNumber) return order
        if (['recusado', 'erro', 'pago', 'fechado', 'cancelado'].includes(order.status)) return order

        const sameTab = order.tabId === tabId
        const sameSession = targetSessionId && normalizeComparableText(order.sessionId) === targetSessionId
        const samePhone = targetPhone && normalizeComparableText(order.phone) === targetPhone
        const sameName = targetName && normalizeComparableText(order.customerName) === targetName

        if (!sameTab && !sameSession && !samePhone && !sameName) return order

        return {
          ...order,
          status: order.type === 'fechamento' ? 'pago' : 'fechado',
          paidAt: nowIso,
          adminMessage: `Comanda de ${targetTab.name} paga no caixa.`,
        }
      }),
    )
  }

  function findTableForClientQrOrder(order) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const tableNumber = String(order?.tableNumber ?? '').trim()
    if (!tableNumber) return null

    return currentTables.find((table) => {
      const mainTab = getTableMainTab(table)
      const currentNumber = String(table.tableNumber ?? mainTab?.tableNumber ?? table.id).trim()
      return currentNumber === tableNumber || String(table.id) === tableNumber
    })
  }

  function ensureTableForClientQrOrder(order) {
    const tableNumber = String(order.tableNumber ?? '').trim()
    const existingTable = findTableForClientQrOrder(order)

    if (existingTable) {
      if (existingTable.status === 'livre') {
        handleOpenTable(existingTable.id, {
          tableNumber,
          tableLabel: `Mesa ${tableNumber}`,
          attendant: 'QR Code',
        })
      }

      return (appStateRef.current?.tables ?? tablesState).find((table) => table.id === existingTable.id) ?? existingTable
    }

    return handleCreateTableSession({
      tableNumber,
      customerName: order.customerName,
      customerPhone: order.phone,
      attendant: 'QR Code',
    })
  }

  async function handleApproveClientQrOrder(orderId, options = {}) {
    const order = clientQrOrdersState.find((item) => item.id === orderId) ?? loadClientQrOrders().find((item) => item.id === orderId)
    if (!order) return { ok: false, message: 'Pedido QR nao encontrado.' }
    if (order.status !== 'novo') return { ok: false, message: 'Este pedido QR ja foi processado.' }

    const table = ensureTableForClientQrOrder(order)
    if (!table) return { ok: false, message: 'Nao foi possivel localizar ou abrir a mesa do QR.' }
    const latestTable = (appStateRef.current?.tables ?? tablesState).find((item) => item.id === table.id) ?? table

    if (order.type === 'fechamento') {
      const tableForClose = (appStateRef.current?.tables ?? tablesState).find((item) => item.id === latestTable.id) ?? latestTable
      const targetTab = findTableTabForClient(tableForClose, order)

      if (!targetTab) {
        markClientQrOrder(orderId, {
          status: 'aprovado',
          processedAt: new Date().toISOString(),
          adminMessage: `Fechamento recebido, mas ${order.customerName} nao tem consumo aberto nesta mesa.`,
        })

        return { ok: true, message: `${order.customerName} nao tem consumo aberto para enviar ao caixa.` }
      }

      const closeResult = handleRequestTableClose(tableForClose.id, {
        customerName: order.customerName,
        sessionId: order.sessionId,
        tabId: targetTab.id,
      })
      if (!closeResult.ok) return closeResult

      markClientQrOrder(orderId, {
        status: 'aprovado',
        tabId: targetTab.id,
        processedAt: new Date().toISOString(),
        adminMessage: closeResult.message,
      })

      return { ok: true, message: `${order.customerName} solicitou fechamento da comanda na mesa ${order.tableNumber}.` }
    }

    const existingClientTab = findTableTabForClient(latestTable, order)
    const clientTab = existingClientTab ?? handleAddTableGuest(latestTable.id, {
      name: order.customerName,
      phone: order.phone,
      sessionId: order.sessionId,
    })
    const tableAfterGuest = (appStateRef.current?.tables ?? tablesState).find((item) => item.id === latestTable.id) ?? latestTable
    const tabId = clientTab?.id ?? `${latestTable.id}-mesa`
    const tableSnapshot = existingClientTab
      ? latestTable
      : {
          ...tableAfterGuest,
          status: tableAfterGuest.status === 'livre' ? 'ocupada' : tableAfterGuest.status,
          guests: getTableTabs(tableAfterGuest).filter((tab) => tab.name !== 'Mesa').length,
          attendant: tableAfterGuest.attendant === '-' ? 'QR Code' : tableAfterGuest.attendant,
          tabs: getTableTabs(tableAfterGuest),
        }

    if (!options.forceStock) {
      const stockIssue = (order.items ?? [])
        .map((item) => checkProductStockAvailability({
          inventoryItems: inventoryState,
          productId: Number(item.productId),
          products: productsState,
          quantity: Number(item.quantity),
          technicalSheets: technicalSheetsState,
        }))
        .find((availability) => !availability.available)

      if (stockIssue) {
        return {
          ok: false,
          needsOverride: true,
          message: `${stockIssue.message} Se quiser seguir mesmo assim, clique em "Enviar sem estoque".`,
        }
      }
    }

    for (const item of order.items ?? []) {
      const result = await handleAddTableItem(latestTable.id, Number(item.productId), Number(item.quantity), tabId, item.notes ?? order.notes ?? '', {
        forceStock: Boolean(options.forceStock),
        manualNotes: order.notes ?? '',
        modifiers: item.modifiers ?? null,
        tableSnapshot,
        unitPrice: Number(item.unitPrice || 0),
      })

      if (!result?.ok) {
        if (!result?.needsOverride) {
          markClientQrOrder(orderId, {
            status: 'erro',
            processedAt: new Date().toISOString(),
            adminMessage: result?.message ?? 'Nao foi possivel aprovar este pedido.',
          })
        }
        return result
      }
    }

    markClientQrOrder(orderId, {
      status: 'aprovado',
      tabId,
      processedAt: new Date().toISOString(),
      adminMessage: `Pedido aprovado e enviado para a cozinha na mesa ${order.tableNumber}.`,
    })

    return { ok: true, message: `Pedido de ${order.customerName} aprovado e enviado para a cozinha.` }
  }

  function handleRejectClientQrOrder(orderId) {
    const updatedOrder = markClientQrOrder(orderId, {
      status: 'recusado',
      processedAt: new Date().toISOString(),
      adminMessage: 'Pedido recusado pelo atendimento.',
    })

    if (!updatedOrder) return { ok: false, message: 'Pedido QR nao encontrado.' }
    return { ok: true, message: `Pedido de ${updatedOrder.customerName} recusado.` }
  }

  function handleDeleteTable(tableId) {
    const currentTables = appStateRef.current?.tables ?? tablesState
    const table = currentTables.find((currentTable) => currentTable.id === tableId)
    if (!table) return { ok: false, message: 'Mesa nao encontrada.' }
    if (currentTables.length <= 1) return { ok: false, message: 'Mantenha ao menos uma mesa cadastrada.' }

    const nextTables = normalizeTablesState(currentTables.filter((currentTable) => currentTable.id !== tableId))
    commitTablesState(nextTables, `${getTableSessionLabel(table)} excluida.`)

    return { ok: true, message: `${getTableSessionLabel(table)} excluida.` }
  }

  function consumeProductStock(productId, quantity, modifiers = null) {
    setInventoryState((currentItems) =>
      applyModifierStockConsumption(applyProductStockConsumption({
        inventoryItems: currentItems,
        productId,
        products: productsState,
        quantity,
        technicalSheets: technicalSheetsState,
      }), modifiers ?? { additions: [] }, quantity),
    )
  }

  function getInventoryAfterProductStockConsumption(baseInventory, productId, quantity, modifiers = null) {
    return applyModifierStockConsumption(applyProductStockConsumption({
      inventoryItems: baseInventory,
      productId,
      products: productsState,
      quantity,
      technicalSheets: technicalSheetsState,
    }), modifiers ?? { additions: [] }, quantity)
  }

  function findEditableKitchenTicketForTableItem(item, tableId, kitchenOrders = kitchenState) {
    const directTicket = item.kitchenTicketId
      ? kitchenOrders.find((order) => order.id === item.kitchenTicketId)
      : null

    if (directTicket) return directTicket

    const table = (appStateRef.current?.tables ?? tablesState).find((currentTable) => currentTable.id === tableId)
    const tableSource = getTableSessionLabel(table)

    return kitchenOrders.find((order) =>
      (order.source === `Mesa ${tableId}` || order.source === tableSource) &&
      String(order.item ?? '').includes(item.name),
    )
  }

  function getTableItemEditContext(tableId, itemId) {
    const table = (appStateRef.current?.tables ?? tablesState).find((currentTable) => currentTable.id === tableId)
    const tableItems = table?.orderItems ?? []
    const item = tableItems.find((orderItem) => orderItem.id === itemId)

    if (!table || !item) return { ok: false, message: 'Item nao encontrado na mesa.' }

    const kitchenTicket = findEditableKitchenTicketForTableItem(item, tableId)
    if (kitchenTicket?.status === 'finalizado') {
      return { ok: false, message: 'Este item ja foi finalizado pela cozinha e nao pode ser alterado pela comanda.' }
    }

    return { ok: true, item, kitchenTicket, table }
  }

  function getTableTabs(table) {
    return table.tabs?.length
      ? table.tabs
      : [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: table.orderItems ?? [] }]
  }

  function buildKitchenTicket({ kitchenTicketId = null, modifiers = null, notes = '', orderItemId = null, source, productId, quantity }) {
    const product = productsState.find((item) => item.id === productId)
    const sheet = technicalSheetsState.find((item) => item.id === product?.recipeId)

    if (!product || !sheet) return null

    const ticketId = kitchenTicketId ?? `#P-${Date.now()}-${productId}`

    return {
      id: ticketId,
      source,
      item: `${quantity}x ${product.name}`,
      orderItemId,
      modifiers,
      notes,
      status: 'em preparo',
      priority: quantity > 2 ? 'alta' : 'normal',
      createdAt: Date.now(),
      startedAt: Date.now(),
      finalizedAt: null,
      completedAt: null,
      deliveredAt: null,
      targetMinutes: sheet.prepTime,
    }
  }

  function createKitchenTicket(ticketPayload) {
    const ticket = buildKitchenTicket(ticketPayload)

    if (!ticket) return null

    setKitchenState((currentQueue) => [ticket, ...currentQueue])

    return ticket.id
  }

  async function handleAddTableItem(tableId, productId, quantity, tabId = null, notes = '', options = {}) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentTables = currentState.tables ?? tablesState
    const currentInventory = currentState.inventory ?? inventoryState
    const currentKitchen = currentState.kitchen ?? kitchenState
    const currentProducts = currentState.products ?? productsState
    const currentTechnicalSheets = currentState.technicalSheets ?? technicalSheetsState
    const product = currentProducts.find((item) => item.id === productId)
    const sheet = currentTechnicalSheets.find((item) => item.id === product?.recipeId)
    const tableFromState = currentTables.find((item) => item.id === tableId)
    const tableSnapshot = options.tableSnapshot ?? null
    const stateHasTargetTab = tableFromState && (!tabId || getTableTabs(tableFromState).some((tab) => tab.id === tabId))
    const shouldUseTableSnapshot = Boolean(tableSnapshot && !stateHasTargetTab)
    const table = shouldUseTableSnapshot ? tableSnapshot : tableFromState ?? tableSnapshot
    const stockAvailability = checkProductStockAvailability({
      inventoryItems: currentInventory,
      productId,
      products: currentProducts,
      quantity,
      technicalSheets: currentTechnicalSheets,
    })

    if (!product || !sheet || !table || quantity <= 0) return { ok: false, message: 'Nao foi possivel lancar este item.' }
    if (!stockAvailability.available && !options.forceStock) {
      return { ok: false, needsOverride: true, message: stockAvailability.message }
    }

    const unitPrice = Number(options.unitPrice ?? product.price)
    const now = Date.now()
    const orderItemId = `${now}-${productId}-${Math.random().toString(16).slice(2, 8)}`
    const kitchenTicketId = `#P-${now}-${productId}`
    const orderItem = {
      id: orderItemId,
      productId,
      name: product.name,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
      tabId,
      kitchenTicketId,
      notes: notes.trim(),
      modifiers: options.modifiers ?? null,
    }
    const tableSource = getTableSessionLabel(table)
    const ticket = buildKitchenTicket({
      kitchenTicketId,
      modifiers: options.modifiers,
      notes: options.manualNotes ?? orderItem.notes,
      orderItemId,
      source: tableSource,
      productId,
      quantity,
    })

    if (!ticket) return { ok: false, message: 'Nao foi possivel criar o ticket da cozinha.' }

    const baseTables = shouldUseTableSnapshot
      ? (
          tableFromState
            ? currentTables.map((currentTable) => (currentTable.id === tableId ? tableSnapshot : currentTable))
            : normalizeTablesState([...currentTables, tableSnapshot])
        )
      : tableFromState
        ? currentTables
        : normalizeTablesState([...currentTables, table])
    const nextTables = baseTables.map((currentTable) =>
      currentTable.id === tableId
        ? (() => {
            const tableTabs = getTableTabs(currentTable)
            const targetTab = tableTabs.find((tab) => tab.id === tabId) ?? tableTabs[0]
            const itemWithTab = { ...orderItem, tabId: targetTab.id, tabName: targetTab.name }

            return {
              ...currentTable,
              status: currentTable.status === 'livre' ? 'ocupada' : currentTable.status,
              guests: currentTable.guests || 1,
              attendant: currentTable.attendant === '-' ? 'Balcao' : currentTable.attendant,
              total: Number(currentTable.total || 0) + itemWithTab.total,
              orderItems: [...(currentTable.orderItems ?? []), itemWithTab],
              tabs: tableTabs.map((tab) =>
                tab.id === targetTab.id ? { ...tab, orderItems: [...(tab.orderItems ?? []), itemWithTab] } : tab,
              ),
            }
          })()
        : currentTable,
    )
    const nextInventory = getInventoryAfterProductStockConsumption(currentInventory, productId, quantity, options.modifiers)
    const nextKitchen = [ticket, ...currentKitchen]
    const nextState = {
      ...currentState,
      inventory: nextInventory,
      tables: nextTables,
      kitchen: nextKitchen,
    }
    const successMessage = options.forceStock
      ? 'Item lancado com alerta de estoque. Mesa, cozinha e estoque foram atualizados.'
      : 'Item lancado e enviado para a cozinha. Mesa, cozinha e estoque foram atualizados.'

    const result = await persistCheckoutState(nextState, successMessage)
    return result.ok ? { ok: true, message: successMessage } : result
  }

  async function handleQuickSale(sale = {}) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentProducts = currentState.products ?? productsState
    const currentInventory = currentState.inventory ?? inventoryState
    const currentTechnicalSheets = currentState.technicalSheets ?? technicalSheetsState
    const currentPayments = currentState.payments ?? paymentsState
    const productId = Number(sale.productId)
    const quantity = Number(sale.quantity || 1)
    const product = currentProducts.find((item) => item.id === productId)

    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, message: 'Escolha um produto e uma quantidade valida para a venda rapida.' }
    }

    const unitPrice = Number(sale.unitPrice ?? product.price)
    const total = unitPrice * quantity
    const now = new Date()
    const saleId = `VR-${Date.now()}-${productId}`
    const paymentMethod = sale.paymentMethod || 'pix'
    const quickSaleItem = {
      id: `${saleId}-item`,
      productId,
      name: product.name,
      quantity,
      unitPrice,
      total,
      notes: sale.notes ?? '',
    }

    const paymentRecord = {
      id: saleId,
      source: 'venda-rapida',
      customerName: sale.customerName || 'Balcao',
      method: paymentMethod,
      amount: total,
      grossAmount: total,
      netAmount: total,
      discount: 0,
      serviceCharge: 0,
      receivedAmount: total,
      change: 0,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      paidAt: now.toLocaleDateString('pt-BR'),
      paidAtIso: now.toISOString(),
      items: [quickSaleItem],
    }
    const nextInventory = applyModifierStockConsumption(applyProductStockConsumption({
      inventoryItems: currentInventory,
      productId,
      products: currentProducts,
      quantity,
      technicalSheets: currentTechnicalSheets,
    }), { additions: [] }, quantity)
    const nextPayments = [paymentRecord, ...currentPayments]
    const nextState = {
      ...currentState,
      inventory: nextInventory,
      payments: nextPayments,
    }

    return persistCheckoutState(
      nextState,
      `Venda rapida registrada: ${quantity}x ${product.name} (${appCurrency.format(total)}). Estoque, caixa e financeiro atualizados.`,
    )
  }

  async function handleRemoveTableItem(tableId, itemId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentTables = currentState.tables ?? tablesState
    const currentKitchen = currentState.kitchen ?? kitchenState
    const currentInventory = currentState.inventory ?? inventoryState
    const table = currentTables.find((currentTable) => currentTable.id === tableId)
    const tableItems = table?.orderItems ?? []
    const item = tableItems.find((orderItem) => orderItem.id === itemId)

    if (!table || !item) return { ok: false, message: 'Item nao encontrado na mesa.' }

    const kitchenTicket = item.kitchenTicketId
      ? currentKitchen.find((order) => order.id === item.kitchenTicketId)
      : findEditableKitchenTicketForTableItem(item, tableId, currentKitchen)
    if (kitchenTicket?.status === 'finalizado') {
      return { ok: false, message: 'Este item ja foi finalizado pela cozinha e nao pode ser alterado pela comanda.' }
    }

    const nextTables = currentTables.map((currentTable) => {
      if (currentTable.id !== tableId) return currentTable

      const nextOrderItems = (currentTable.orderItems ?? []).filter((orderItem) => orderItem.id !== itemId)
      const nextTabs = getTableTabs(currentTable).map((tab) => ({
        ...tab,
        orderItems: (tab.orderItems ?? []).filter((orderItem) => orderItem.id !== itemId),
      }))
      const nextTotal = nextOrderItems.reduce((total, orderItem) => total + Number(orderItem.total || 0), 0)

      return {
        ...currentTable,
        total: nextTotal,
        orderItems: nextOrderItems,
        tabs: nextTabs,
      }
    })
    const nextKitchen = kitchenTicket
      ? currentKitchen.filter((order) => order.id !== kitchenTicket.id)
      : currentKitchen
    const nextInventory = getInventoryAfterProductStockConsumption(
      currentInventory,
      item.productId,
      -Number(item.quantity || 0),
      item.modifiers,
    )
    const nextState = {
      ...currentState,
      inventory: nextInventory,
      kitchen: nextKitchen,
      tables: nextTables,
    }

    return persistCheckoutState(nextState, 'Item excluido da comanda, cozinha e estoque recalculados.')
  }

  async function handleUpdateTableItemQuantity(tableId, itemId, nextQuantity, options = {}) {
    const quantity = Number(nextQuantity)
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentTables = currentState.tables ?? tablesState
    const currentKitchen = currentState.kitchen ?? kitchenState
    const currentInventory = currentState.inventory ?? inventoryState
    const currentProducts = currentState.products ?? productsState
    const currentTechnicalSheets = currentState.technicalSheets ?? technicalSheetsState
    const table = currentTables.find((currentTable) => currentTable.id === tableId)
    const tableItems = table?.orderItems ?? []
    const item = tableItems.find((orderItem) => orderItem.id === itemId)

    if (!table || !item) return { ok: false, message: 'Item nao encontrado na mesa.' }
    if (!Number.isFinite(quantity) || quantity <= 0) return handleRemoveTableItem(tableId, itemId)

    const kitchenTicket = item.kitchenTicketId
      ? currentKitchen.find((order) => order.id === item.kitchenTicketId)
      : findEditableKitchenTicketForTableItem(item, tableId, currentKitchen)
    if (kitchenTicket?.status === 'finalizado') {
      return { ok: false, message: 'Este item ja foi finalizado pela cozinha e nao pode ser alterado pela comanda.' }
    }

    const previousQuantity = Number(item.quantity || 0)
    const quantityDiff = quantity - previousQuantity

    if (quantityDiff === 0) return { ok: true, message: 'Quantidade mantida.' }

    if (quantityDiff > 0) {
      const stockAvailability = checkProductStockAvailability({
        inventoryItems: currentInventory,
        productId: item.productId,
        products: currentProducts,
        quantity: quantityDiff,
        technicalSheets: currentTechnicalSheets,
      })

      if (!stockAvailability.available && !options.forceStock) {
        return { ok: false, needsOverride: true, message: stockAvailability.message }
      }
    }

    const updateItem = (orderItem) => (
      orderItem.id === itemId
        ? {
            ...orderItem,
            quantity,
            total: Number(orderItem.unitPrice || 0) * quantity,
          }
        : orderItem
    )
    const nextTables = currentTables.map((currentTable) => {
      if (currentTable.id !== tableId) return currentTable

      const nextOrderItems = (currentTable.orderItems ?? []).map(updateItem)
      const nextTabs = getTableTabs(currentTable).map((tab) => ({
        ...tab,
        orderItems: (tab.orderItems ?? []).map(updateItem),
      }))
      const nextTotal = nextOrderItems.reduce((total, orderItem) => total + Number(orderItem.total || 0), 0)

      return {
        ...currentTable,
        total: nextTotal,
        orderItems: nextOrderItems,
        tabs: nextTabs,
      }
    })
    const nextKitchen = kitchenTicket
      ? currentKitchen.map((order) =>
          order.id === kitchenTicket.id
            ? {
                ...order,
                item: `${quantity}x ${item.name}`,
                priority: quantity > 2 ? 'alta' : 'normal',
              }
            : order,
        )
      : currentKitchen
    const nextInventory = getInventoryAfterProductStockConsumption(
      currentInventory,
      item.productId,
      quantityDiff,
      item.modifiers,
    )
    const nextState = {
      ...currentState,
      inventory: nextInventory,
      kitchen: nextKitchen,
      tables: nextTables,
    }

    return persistCheckoutState(
      nextState,
      options.forceStock
        ? 'Quantidade ajustada com alerta de estoque. Mesa, cozinha e estoque foram atualizados.'
        : 'Quantidade do item atualizada. Mesa, cozinha e estoque foram atualizados.',
    )
  }

  async function handleAdvanceKitchenOrder(orderId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentKitchen = currentState.kitchen ?? kitchenState
    let nextOrder = null
    const nextKitchen = currentKitchen.map((order) => {
      if (order.id !== orderId) return order

      const currentIndex = kitchenStatusFlow.indexOf(order.status)
      const nextStatus = kitchenStatusFlow[Math.min(currentIndex + 1, kitchenStatusFlow.length - 1)]
      const now = Date.now()

      nextOrder = {
        ...order,
        status: nextStatus,
        startedAt: order.startedAt ?? now,
        finalizedAt: nextStatus === 'finalizado' && !order.finalizedAt ? now : order.finalizedAt,
        completedAt: nextStatus === 'finalizado' && !order.completedAt ? now : order.completedAt,
        deliveredAt: nextStatus === 'finalizado' && !order.deliveredAt ? now : order.deliveredAt,
      }

      return nextOrder
    })

    if (!nextOrder) return { ok: false, message: 'Pedido da cozinha nao encontrado.' }

    return persistCheckoutState(
      { ...currentState, kitchen: nextKitchen },
      nextOrder.status === 'finalizado'
        ? `${nextOrder.item} finalizado na cozinha.`
        : `${nextOrder.item} atualizado para ${nextOrder.status}.`,
    )
  }

  async function handlePrioritizeKitchenOrder(orderId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentKitchen = currentState.kitchen ?? kitchenState
    const now = Date.now()
    let nextOrder = null
    const nextKitchen = currentKitchen.map((order) => {
      if (order.id !== orderId || order.status === 'finalizado') return order

      nextOrder = { ...order, priority: 'alta', prioritizedAt: now }
      return nextOrder
    })

    if (!nextOrder) return { ok: false, message: 'Pedido nao encontrado ou ja finalizado.' }

    return persistCheckoutState(
      { ...currentState, kitchen: nextKitchen },
      `${nextOrder.item} marcado como prioridade na cozinha.`,
    )
  }

  async function handleCloseTablePayment(tableId, paymentMethod, tabId = 'all', options = {}) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentTables = currentState.tables ?? tablesState
    const currentPayments = currentState.payments ?? paymentsState
    const currentCustomers = currentState.customers ?? customersState
    const currentReceivables = currentState.accountsReceivable ?? accountsReceivableState
    const table = currentTables.find((item) => item.id === tableId)
    if (!table || table.total <= 0) {
      return { ok: false, message: 'Mesa sem saldo para fechar.' }
    }

    const tableTabs = table.tabs?.length
      ? table.tabs
      : [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: table.orderItems ?? [] }]
    const selectedTab = tableTabs.find((tab) => tab.id === tabId)
    const tableItems = table.orderItems?.length
      ? table.orderItems
      : tableTabs.flatMap((tab) => tab.orderItems ?? [])
    const paidItems = tabId === 'all' ? tableItems : selectedTab?.orderItems ?? []
    const paidAmount = tabId === 'all'
      ? Number(table.total || paidItems.reduce((total, item) => total + item.total, 0))
      : paidItems.reduce((total, item) => total + item.total, 0)

    if (paidAmount <= 0) {
      return { ok: false, message: 'Nao existe valor nesta comanda para registrar pagamento.' }
    }

    const discount = Math.max(0, Number(options.discount || 0))
    const serviceCharge = Math.max(0, Number(options.serviceCharge || 0))
    const netAmount = Math.max(0, paidAmount - discount + serviceCharge)
    const paymentParts = Array.isArray(options.payments) && options.payments.length > 0
      ? options.payments.filter((payment) => Number(payment.amount) > 0)
      : [{ method: paymentMethod, amount: netAmount, customerId: options.customerId }]
    const partsTotal = paymentParts.reduce((total, payment) => total + Number(payment.amount || 0), 0)

    if (Math.abs(partsTotal - netAmount) > 0.01) {
      return { ok: false, message: 'A soma dos pagamentos nao fecha com o total liquido.' }
    }

    const missingNotebookCustomer = paymentParts.some((payment) =>
      payment.method === 'caderneta' && !currentCustomers.some((customer) => customer.id === Number(payment.customerId)),
    )

    if (missingNotebookCustomer) {
      return { ok: false, message: 'Selecione um cliente cadastrado para lancar na caderneta.' }
    }

    const itemCarrierIndex = paymentParts.findIndex((payment) => payment.method !== 'caderneta')
    const paidItemsIndex = itemCarrierIndex >= 0 ? itemCarrierIndex : 0
    const now = new Date()
    const paymentTimestamp = now.getTime()
    const paidItemIds = new Set(paidItems.map((paidItem) => paidItem.id))
    const nextPaymentRecords = paymentParts.map((payment, index) => {
      const isNotebook = payment.method === 'caderneta'
      const notebookCustomer = currentCustomers.find((customer) => customer.id === Number(payment.customerId))

      return {
        id: `${paymentTimestamp}-${tableId}-${tabId}-${index}`,
        source: 'mesa',
        tableId,
        tabId,
        tabName: tabId === 'all' ? 'Mesa inteira' : selectedTab?.name,
        method: payment.method,
        amount: isNotebook ? 0 : Number(payment.amount),
        grossAmount: index === paidItemsIndex ? paidAmount : 0,
        netAmount: Number(payment.amount),
        customerId: notebookCustomer?.id ?? null,
        customerName: notebookCustomer?.name ?? null,
        discount: index === paidItemsIndex ? discount : 0,
        serviceCharge: index === paidItemsIndex ? serviceCharge : 0,
        receivedAmount: isNotebook ? 0 : Number(options.receivedAmount || payment.amount),
        change: payment.method === 'dinheiro' ? Math.max(0, Number(options.receivedAmount || payment.amount) - Number(payment.amount)) : 0,
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        paidAt: now.toLocaleDateString('pt-BR'),
        paidAtIso: now.toISOString(),
        items: index === paidItemsIndex ? paidItems : [],
      }
    })
    const nextReceivableRecords = paymentParts
      .filter((payment) => payment.method === 'caderneta')
      .map((payment, index) => {
        const notebookCustomer = currentCustomers.find((customer) => customer.id === Number(payment.customerId))

        return {
          id: `${paymentTimestamp}-${payment.customerId}-${index}`,
          code: `CR-${String(currentReceivables.length + index + 1).padStart(4, '0')}`,
          customerId: notebookCustomer.id,
          customerName: notebookCustomer.name,
          description: `Caderneta ${getTableSessionLabel(table)}${tabId === 'all' ? '' : ` - ${selectedTab?.name ?? ''}`}`,
          amount: Number(payment.amount),
          grossAmount: Number(payment.amount),
          discount: 0,
          serviceCharge: 0,
          status: 'aberto',
          createdAt: now.toLocaleDateString('pt-BR'),
          createdAtIso: getLocalDateKey(now),
          dueDate: now.toLocaleDateString('pt-BR'),
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          tableId,
          tabId,
          items: paidItems,
        }
      })
    const nextPayments = [...nextPaymentRecords, ...currentPayments]
    const nextReceivables = [...nextReceivableRecords, ...currentReceivables]
    const nextTables = currentTables.flatMap((item) => {
      if (item.id !== tableId) return [item]

      if (tabId === 'all') {
        if (item.dynamic) return []

        return [resetTableForNewService(item)]
      }

      const itemTabs = item.tabs?.length
        ? item.tabs
        : [{ id: `${item.id}-mesa`, name: 'Mesa', orderItems: item.orderItems ?? [] }]
      const remainingTabs = itemTabs
        .map((tab) =>
          tab.id === tabId
            ? { ...tab, orderItems: [] }
            : { ...tab, orderItems: (tab.orderItems ?? []).filter((orderItem) => !paidItemIds.has(orderItem.id)) },
        )
        .filter((tab) => tab.name === 'Mesa' || (tab.orderItems ?? []).length > 0)
      const remainingItems = remainingTabs.flatMap((tab) => tab.orderItems ?? [])
      const nextTotal = remainingItems.reduce((total, orderItem) => total + Number(orderItem.total || 0), 0)

      if (nextTotal <= 0) {
        return item.dynamic ? [] : [resetTableForNewService(item)]
      }

      return [{
        ...item,
        status: item.status === 'livre' ? 'ocupada' : item.status,
        guests: Math.max(1, remainingTabs.filter((tab) => tab.name !== 'Mesa').length),
        total: nextTotal,
        orderItems: remainingItems,
        tabs: remainingTabs,
      }]
    })
    const nextState = {
      ...currentState,
      tables: nextTables,
      payments: nextPayments,
      accountsReceivable: nextReceivables,
    }
    const successMessage = tabId === 'all'
      ? `${getTableSessionLabel(table)} fechada e zerada no caixa.`
      : `Comanda de ${selectedTab?.name ?? 'cliente'} fechada no caixa. A mesa continua aberta se houver outros clientes.`

    const result = await persistCheckoutState(nextState, successMessage)
    if (result.ok) {
      if (tabId === 'all') {
        closeClientQrSessionForTable(table)
      } else {
        closeClientQrSessionForTableTab(table, tabId)
      }
    }

    return result
  }

  async function handleCloseDeliveryPayment(deliveryId, paymentMethod, options = {}) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentDeliveries = currentState.deliveries ?? deliveryState
    const currentPayments = currentState.payments ?? paymentsState
    const currentCustomers = currentState.customers ?? customersState
    const currentReceivables = currentState.accountsReceivable ?? accountsReceivableState
    const deliveryOrder = currentDeliveries.find((order) => order.id === deliveryId)
    if (!deliveryOrder || Number(deliveryOrder.total || 0) <= 0) {
      return { ok: false, message: 'Delivery sem saldo para fechar.' }
    }
    if (deliveryOrder.paymentStatus === 'pago' || currentPayments.some((payment) => payment.source === 'delivery' && payment.deliveryId === deliveryId)) {
      return { ok: false, message: `Delivery ${deliveryId} ja foi pago e nao precisa voltar ao caixa.` }
    }

    const paidItems = deliveryOrder.items ?? []
    const paidAmount = Number(deliveryOrder.total || 0)
    const discount = Math.max(0, Number(options.discount || 0))
    const serviceCharge = Math.max(0, Number(options.serviceCharge || 0))
    const netAmount = Math.max(0, paidAmount - discount + serviceCharge)
    const paymentParts = Array.isArray(options.payments) && options.payments.length > 0
      ? options.payments.filter((payment) => Number(payment.amount) > 0)
      : [{ method: paymentMethod, amount: netAmount, customerId: options.customerId }]
    const partsTotal = paymentParts.reduce((total, payment) => total + Number(payment.amount || 0), 0)

    if (Math.abs(partsTotal - netAmount) > 0.01) {
      return { ok: false, message: 'A soma dos pagamentos nao fecha com o total liquido.' }
    }

    const missingNotebookCustomer = paymentParts.some((payment) =>
      payment.method === 'caderneta' && !currentCustomers.some((customer) => customer.id === Number(payment.customerId)),
    )

    if (missingNotebookCustomer) {
      return { ok: false, message: 'Selecione um cliente cadastrado para lancar na caderneta.' }
    }

    const itemCarrierIndex = paymentParts.findIndex((payment) => payment.method !== 'caderneta')
    const paidItemsIndex = itemCarrierIndex >= 0 ? itemCarrierIndex : 0
    const now = new Date()
    const paymentTimestamp = now.getTime()
    const nextPaymentRecords = paymentParts.map((payment, index) => {
      const isNotebook = payment.method === 'caderneta'
      const notebookCustomer = currentCustomers.find((customer) => customer.id === Number(payment.customerId))

      return {
        id: `${paymentTimestamp}-${deliveryId}-${index}`,
        source: 'delivery',
        deliveryId,
        customerId: notebookCustomer?.id ?? deliveryOrder.customerId ?? null,
        customerName: notebookCustomer?.name ?? deliveryOrder.customer ?? null,
        customerPhone: deliveryOrder.phone ?? '',
        customerAddress: deliveryOrder.address ?? '',
        method: payment.method,
        amount: isNotebook ? 0 : Number(payment.amount),
        grossAmount: index === paidItemsIndex ? paidAmount : 0,
        netAmount: Number(payment.amount),
        discount: index === paidItemsIndex ? discount : 0,
        serviceCharge: index === paidItemsIndex ? serviceCharge : 0,
        receivedAmount: isNotebook ? 0 : Number(options.receivedAmount || payment.amount),
        change: payment.method === 'dinheiro' ? Math.max(0, Number(options.receivedAmount || payment.amount) - Number(payment.amount)) : 0,
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        paidAt: now.toLocaleDateString('pt-BR'),
        paidAtIso: now.toISOString(),
        items: index === paidItemsIndex ? paidItems : [],
      }
    })
    const nextReceivableRecords = paymentParts
      .filter((payment) => payment.method === 'caderneta')
      .map((payment, index) => {
        const notebookCustomer = currentCustomers.find((customer) => customer.id === Number(payment.customerId))

        return {
          id: `${paymentTimestamp}-${payment.customerId}-${index}`,
          code: `CR-${String(currentReceivables.length + index + 1).padStart(4, '0')}`,
          customerId: notebookCustomer.id,
          customerName: notebookCustomer.name,
          description: `Caderneta Delivery ${deliveryId}`,
          amount: Number(payment.amount),
          grossAmount: Number(payment.amount),
          discount: 0,
          serviceCharge: 0,
          status: 'aberto',
          createdAt: now.toLocaleDateString('pt-BR'),
          createdAtIso: getLocalDateKey(now),
          dueDate: now.toLocaleDateString('pt-BR'),
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          deliveryId,
          items: paidItems,
        }
      })
    const nextPayments = [...nextPaymentRecords, ...currentPayments]
    const nextReceivables = [...nextReceivableRecords, ...currentReceivables]
    const nextDeliveries = currentDeliveries.map((order) =>
        order.id === deliveryId
          ? {
              ...order,
              paymentStatus: 'pago',
              paymentMethod: paymentParts.length > 1 ? 'dividido' : paymentParts[0]?.method ?? paymentMethod,
              paidAt: now.toISOString(),
            }
          : order,
      )
    const nextState = {
      ...currentState,
      deliveries: nextDeliveries,
      payments: nextPayments,
      accountsReceivable: nextReceivables,
    }
    const successMessage = `Delivery ${deliveryId} pago e atualizado no caixa.`

    const result = await persistCheckoutState(nextState, successMessage)
    if (result.ok) {
      const linkedClientOrder = findLinkedClientDeliveryOrder(deliveryOrder, loadClientDeliveryOrders())
      if (linkedClientOrder) {
        markClientDeliveryOrder(linkedClientOrder.id, {
          paymentStatus: 'pago',
          paidAt: now.toISOString(),
          adminMessage: 'Pagamento confirmado pela loja. Pedido atualizado no caixa.',
        })
      }
    }

    return result
  }

  function handleAddExpense(expense) {
    setExpensesState((currentExpenses) => [
      {
        id: Date.now(),
        ...expense,
        amount: Number(expense.amount),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...currentExpenses,
    ])
  }

  function handleToggleExpenseStatus(expenseId) {
    setExpensesState((currentExpenses) =>
      currentExpenses.map((expense) =>
        expense.id === expenseId
          ? { ...expense, status: expense.status === 'pago' ? 'pendente' : 'pago' }
          : expense,
      ),
    )
  }

  function handleReceiveReceivable(receivableId, paymentMethod) {
    const receivable = accountsReceivableState.find((item) => item.id === receivableId)
    if (!receivable) return { ok: false, message: 'Conta a receber nao encontrada.' }
    if (receivable.status !== 'aberto') return { ok: false, message: 'Esta conta ja foi baixada.' }

    const now = new Date()
    const paymentId = `${Date.now()}-${receivableId}`
    const paidAt = now.toLocaleDateString('pt-BR')
    const paidAtIso = getLocalDateKey(now)
    const paidTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    setPaymentsState((currentPayments) => [
      {
        id: paymentId,
        source: 'caderneta',
        receivableId,
        tableId: receivable.tableId ?? null,
        tabId: receivable.tabId ?? null,
        deliveryId: receivable.deliveryId ?? null,
        customerId: receivable.customerId ?? null,
        customerName: receivable.customerName ?? null,
        method: paymentMethod,
        amount: Number(receivable.amount || 0),
        grossAmount: Number(receivable.grossAmount || receivable.amount || 0),
        netAmount: Number(receivable.amount || 0),
        discount: Number(receivable.discount || 0),
        serviceCharge: Number(receivable.serviceCharge || 0),
        receivedAmount: Number(receivable.amount || 0),
        change: 0,
        time: paidTime,
        paidAt,
        paidAtIso,
        items: [],
      },
      ...currentPayments,
    ])

    setAccountsReceivableState((currentReceivables) =>
      currentReceivables.map((item) =>
        item.id === receivableId
          ? {
              ...item,
              status: 'recebido',
              paidAt,
              paidAtIso,
              paidTime,
              paidMethod: paymentMethod,
              paymentId,
            }
          : item,
      ),
    )

    return { ok: true }
  }

  async function handleCloseCashierShift(closing) {
    const now = new Date()
    const closingRecord = {
      id: Date.now(),
      code: `FC-${String(cashClosingsState.length + 1).padStart(4, '0')}`,
      ...closing,
      createdAt: now.toLocaleDateString('pt-BR'),
      createdAtIso: getLocalDateKey(now),
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    const nextState = {
      ...getCurrentAppState(),
      cashClosings: [closingRecord, ...cashClosingsState],
    }

    return persistCheckoutState(nextState, 'Fechamento registrado no historico do caixa.')
  }

  function handleAddDeliveryCustomer(customer) {
    const newCustomer = createDeliveryCustomer(customer)

    setCustomersState((currentCustomers) => [newCustomer, ...currentCustomers])
    return newCustomer
  }

  function handleSaveCustomer(customer) {
    const result = saveCustomer({ currentCustomers: customersState, customer })
    if (!result) return null

    setCustomersState(result.customers)
    return result.customer
  }

  function handleCreateCustomerCampaign(campaign) {
    const newCampaign = createCustomerCampaign({
      campaign,
      currentCampaigns: customerCampaignsState,
      customers: customersState,
      deliveries: deliveryState,
    })
    if (!newCampaign) return null

    setCustomerCampaignsState((currentCampaigns) => [newCampaign, ...currentCampaigns])
    return newCampaign
  }

  async function handleCreateDeliveryOrder(order, options = {}) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentInventory = currentState.inventory ?? inventoryState
    const currentKitchen = currentState.kitchen ?? kitchenState
    const currentDeliveries = currentState.deliveries ?? deliveryState
    const currentCustomers = currentState.customers ?? customersState
    const currentProducts = currentState.products ?? productsState
    const currentTechnicalSheets = currentState.technicalSheets ?? technicalSheetsState
    const newOrder = createDeliveryOrder({ order, customers: currentCustomers, deliveries: currentDeliveries, products: currentProducts })

    if (!newOrder || !newOrder.items?.length) return { ok: false, message: 'Nao foi possivel criar o pedido.' }

    const stockIssue = newOrder.items
      .map((item) => checkProductStockAvailability({
        inventoryItems: currentInventory,
        productId: item.productId,
        products: currentProducts,
        quantity: item.quantity,
        technicalSheets: currentTechnicalSheets,
      }))
      .find((availability) => !availability.available)

    if (stockIssue && !options.forceStock) {
      return { ok: false, needsOverride: true, message: stockIssue.message }
    }

    const nextInventory = newOrder.items.reduce(
      (currentInventory, item) =>
        getInventoryAfterProductStockConsumption(currentInventory, item.productId, item.quantity, item.modifiers),
      currentInventory,
    )
    const newKitchenTickets = newOrder.items
      .map((item) => buildKitchenTicket({
        modifiers: item.modifiers,
        notes: item.manualNotes ?? item.notes,
        source: `Delivery ${newOrder.id}${newOrder.customer ? ` - ${newOrder.customer}` : ''}`,
        productId: item.productId,
        quantity: item.quantity,
      }))
      .filter(Boolean)
    const nextState = {
      ...currentState,
      inventory: nextInventory,
      deliveries: [newOrder, ...currentDeliveries],
      kitchen: [...newKitchenTickets, ...currentKitchen],
    }
    const successMessage = options.forceStock
      ? 'Pedido criado com alerta de estoque. Delivery, cozinha e estoque foram atualizados.'
      : 'Pedido criado e enviado para a cozinha. Delivery, cozinha e estoque foram atualizados.'
    const result = await persistCheckoutState(nextState, successMessage)

    return result.ok ? { ok: true, message: successMessage } : result
  }

  function markClientDeliveryOrder(orderId, patch) {
    const updatedOrder = updateClientDeliveryOrder(orderId, patch)
    setClientDeliveryOrdersState(loadClientDeliveryOrders())
    return updatedOrder
  }

  function findCustomerByPhone(phone, sourceCustomers = customersState) {
    const normalizedPhone = String(phone ?? '').replace(/\D/g, '')
    if (normalizedPhone.length < 8) return null

    return sourceCustomers.find((customer) => {
      const customerPhone = String(customer.phone ?? '').replace(/\D/g, '')
      if (customerPhone.length < 8) return false
      return customerPhone.endsWith(normalizedPhone.slice(-8))
    })
  }

  async function handleApproveClientDeliveryOrder(orderId, options = {}) {
    const clientOrder = clientDeliveryOrdersState.find((order) => order.id === orderId) ??
      loadClientDeliveryOrders().find((order) => order.id === orderId)

    if (!clientOrder) return { ok: false, message: 'Pedido delivery do site nao encontrado.' }
    if (clientOrder.status !== 'novo') return { ok: false, message: 'Este pedido delivery ja foi processado.' }

    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentInventory = currentState.inventory ?? inventoryState
    const currentKitchen = currentState.kitchen ?? kitchenState
    const currentDeliveries = currentState.deliveries ?? deliveryState
    const currentCustomers = currentState.customers ?? customersState
    const currentProducts = currentState.products ?? productsState
    const currentTechnicalSheets = currentState.technicalSheets ?? technicalSheetsState
    const isGuestDeliveryOrder = clientOrder.accountType === 'guest'
    const existingCustomer = isGuestDeliveryOrder ? null : findCustomerByPhone(clientOrder.phone, currentCustomers)
    const deliveryCustomer = existingCustomer ?? createDeliveryCustomer({
      name: clientOrder.customerName,
      email: clientOrder.customerEmail ?? '',
      phone: clientOrder.phone,
      address: clientOrder.address,
      notes: [
        isGuestDeliveryOrder ? 'Pedido convidado do delivery online.' : 'Cliente criado pelo delivery online.',
        clientOrder.complement ? `Complemento: ${clientOrder.complement}` : '',
      ].filter(Boolean).join(' '),
      tags: isGuestDeliveryOrder ? ['Convidado'] : ['Novo', 'Conta delivery'],
    })
    const nextCustomers = existingCustomer || isGuestDeliveryOrder ? currentCustomers : [deliveryCustomer, ...currentCustomers]
    const orderCustomers = existingCustomer ? currentCustomers : [deliveryCustomer, ...currentCustomers]
    const deliveryOrder = createDeliveryOrder({
      order: {
        customerId: deliveryCustomer.id,
        channel: 'Site Delivery',
        campaign: 'Sem campanha',
        discount: 0,
        deliveryFee: Number(clientOrder.deliveryFee || 0),
        paymentMethod: clientOrder.paymentMethod,
        paymentStatus: clientOrder.paymentStatus,
        paymentLabel: clientOrder.paymentLabel,
        payOnDelivery: clientOrder.payOnDelivery,
        cashChangeFor: clientOrder.cashChangeFor,
        clientDeliveryOrderId: clientOrder.id,
        notes: clientOrder.notes,
        items: clientOrder.items ?? [],
      },
      customers: orderCustomers,
      deliveries: currentDeliveries,
      products: currentProducts,
    })

    if (!deliveryOrder || !deliveryOrder.items?.length) {
      return { ok: false, message: 'Nao foi possivel montar este pedido delivery.' }
    }

    const stockIssue = deliveryOrder.items
      .map((item) => checkProductStockAvailability({
        inventoryItems: currentInventory,
        productId: item.productId,
        products: currentProducts,
        quantity: item.quantity,
        technicalSheets: currentTechnicalSheets,
      }))
      .find((availability) => !availability.available)

    if (stockIssue && !options.forceStock) {
      return {
        ok: false,
        needsOverride: true,
        message: `${stockIssue.message} Se quiser seguir mesmo assim, aprove sem estoque.`,
      }
    }

    const nextInventory = deliveryOrder.items.reduce(
      (currentInventory, item) =>
        getInventoryAfterProductStockConsumption(currentInventory, item.productId, item.quantity, item.modifiers),
      currentInventory,
    )
    const newKitchenTickets = deliveryOrder.items
      .map((item) => buildKitchenTicket({
        modifiers: item.modifiers,
        notes: item.manualNotes ?? item.notes ?? clientOrder.notes,
        source: `Delivery ${deliveryOrder.id}${deliveryOrder.customer ? ` - ${deliveryOrder.customer}` : ''}`,
        productId: item.productId,
        quantity: item.quantity,
      }))
      .filter(Boolean)
    const nextState = {
      ...currentState,
      customers: nextCustomers,
      inventory: nextInventory,
      deliveries: [deliveryOrder, ...currentDeliveries],
      kitchen: [...newKitchenTickets, ...currentKitchen],
    }
    const successMessage = options.forceStock
      ? `Pedido ${deliveryOrder.id} aprovado com alerta de estoque.`
      : `Pedido ${deliveryOrder.id} aprovado e enviado para a cozinha.`
    const result = await persistCheckoutState(nextState, successMessage)

    if (!result.ok) return result

    markClientDeliveryOrder(orderId, {
      status: 'aprovado',
      eta: '35 min',
      adminDeliveryId: deliveryOrder.id,
      processedAt: new Date().toISOString(),
      adminMessage: options.forceStock
        ? 'A loja aceitou seu pedido com alerta de estoque e vai confirmar os itens.'
        : 'A loja aceitou seu pedido. Ele ja foi enviado para a cozinha.',
    })

    return { ok: true, message: successMessage }
  }

  function handleRejectClientDeliveryOrder(orderId) {
    const updatedOrder = markClientDeliveryOrder(orderId, {
      status: 'recusado',
      processedAt: new Date().toISOString(),
      adminMessage: 'Pedido recusado pelo atendimento.',
    })

    if (!updatedOrder) return { ok: false, message: 'Pedido delivery do site nao encontrado.' }
    return { ok: true, message: `Pedido de ${updatedOrder.customerName} recusado.` }
  }

  function normalizeDeliveryPaymentMethodForCashier(order) {
    const method = String(order?.paymentMethod ?? '').replace('_entrega', '')
    if (['pix', 'credito', 'debito', 'dinheiro'].includes(method)) return method
    if (method === 'link') return 'pix'
    return 'dinheiro'
  }

  function shouldAutoRegisterDeliveryPayment(order, payments = []) {
    if (!order || order.status === 'entregue') return false
    if (order.paymentStatus === 'pago') return false
    if (payments.some((payment) => payment.source === 'delivery' && payment.deliveryId === order.id)) return false
    if (order.paymentMethod === 'link') return false

    return order.payOnDelivery || order.paymentStatus === 'pagar_na_entrega' || ['pix', 'credito', 'debito', 'dinheiro', 'entrega'].includes(order.paymentMethod)
  }

  function createDeliveryAutoPaymentRecord(order, now = new Date()) {
    const method = normalizeDeliveryPaymentMethodForCashier(order)
    const receivedAmount = method === 'dinheiro' && Number(order.cashChangeFor || 0) > 0
      ? Number(order.cashChangeFor)
      : Number(order.total || 0)

    return {
      id: `${now.getTime()}-${order.id}-entrega`,
      source: 'delivery',
      deliveryId: order.id,
      customerId: order.customerId ?? null,
      customerName: order.customer ?? null,
      customerPhone: order.phone ?? '',
      customerAddress: order.address ?? '',
      method,
      amount: Number(order.total || 0),
      grossAmount: Number(order.total || 0),
      netAmount: Number(order.total || 0),
      discount: Number(order.discount || 0),
      serviceCharge: 0,
      receivedAmount,
      change: method === 'dinheiro' ? Math.max(0, receivedAmount - Number(order.total || 0)) : 0,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      paidAt: now.toLocaleDateString('pt-BR'),
      paidAtIso: now.toISOString(),
      items: order.items ?? [],
    }
  }

  async function handleAdvanceDeliveryOrder(orderId) {
    const currentState = appStateRef.current ?? getCurrentAppState()
    const currentDeliveries = currentState.deliveries ?? deliveryState
    const currentPayments = currentState.payments ?? paymentsState
    const currentOrder = currentDeliveries.find((order) => order.id === orderId)
    const linkedClientOrder = findLinkedClientDeliveryOrder(currentOrder, loadClientDeliveryOrders())
    const rawNextOrder = currentOrder ? advanceDeliveryOrder(currentOrder) : null
    const willRegisterPayment = rawNextOrder?.status === 'entregue' && shouldAutoRegisterDeliveryPayment(currentOrder, currentPayments)
    const paidAt = willRegisterPayment ? new Date() : null
    const orderWithPayment = willRegisterPayment
      ? {
          ...rawNextOrder,
          paymentStatus: 'pago',
          paymentMethod: normalizeDeliveryPaymentMethodForCashier(rawNextOrder),
          paidAt: paidAt.toISOString(),
        }
      : rawNextOrder
    const nextOrder = orderWithPayment && linkedClientOrder && !orderWithPayment.clientDeliveryOrderId
      ? { ...orderWithPayment, clientDeliveryOrderId: linkedClientOrder.id }
      : orderWithPayment

    if (!nextOrder) {
      return { ok: false, message: 'Pedido delivery nao encontrado.' }
    }

    const nextDeliveries = currentDeliveries.map((order) => (order.id === orderId ? nextOrder : order))
    const nextPayments = willRegisterPayment
      ? [createDeliveryAutoPaymentRecord(nextOrder, paidAt), ...currentPayments]
      : currentPayments
    const nextState = {
      ...currentState,
      deliveries: nextDeliveries,
      payments: nextPayments,
    }
    const result = await persistCheckoutState(
      nextState,
      willRegisterPayment
        ? `Delivery ${orderId} entregue e creditado no caixa.`
        : `Delivery ${orderId} atualizado para ${nextOrder.status}.`,
    )

    if (result.ok && nextOrder.clientDeliveryOrderId) {
      const now = Date.now()
      markClientDeliveryOrder(nextOrder.clientDeliveryOrderId, getClientDeliveryPatchFromAdminOrder(nextOrder, now))
    }

    return result
  }

  async function handleClearDeliveryQueue(options = {}) {
    const { dateKey = '', status = 'entregue' } = options
    const shouldRemoveOrder = (order) => {
      const matchesStatus = status === 'todos' ? true : order.status === status
      const matchesDate = dateKey ? getLocalDateKey(order.createdAt) === dateKey : true
      return matchesStatus && matchesDate
    }
    const nextDeliveries = deliveryState.filter((order) => !shouldRemoveOrder(order))
    const removedCount = deliveryState.length - nextDeliveries.length

    if (removedCount <= 0) {
      return { ok: true, message: 'Nenhum pedido encontrado para limpar.' }
    }

    const nextState = {
      ...getCurrentAppState(),
      deliveries: nextDeliveries,
    }

    return persistMaintenanceState(
      nextState,
      `${removedCount} pedido(s) removido(s) da fila de delivery.`,
      { skipBackup: true },
    )
  }

  function handleClearClientDeliveryHistory(options = {}) {
    const { dateKey = '' } = options
    const currentOrders = loadClientDeliveryOrders()
    const nextOrders = currentOrders.filter((order) => {
      if (order.status === 'novo') return true
      if (!dateKey) return false
      const orderDate = order.createdAt ? getLocalDateKey(new Date(order.createdAt).getTime()) : ''
      return orderDate !== dateKey
    })
    const removedCount = currentOrders.length - nextOrders.length
    const savedOrders = saveClientDeliveryOrders(nextOrders)
    setClientDeliveryOrdersState(savedOrders)

    return {
      ok: true,
      message: removedCount > 0
        ? `${removedCount} registro(s) removido(s) do historico do site.`
        : 'Nenhum historico do site para limpar.',
    }
  }

  async function handleUpdateWhatsAppMessageStatus(messageId, status) {
    setWhatsAppInboxState((currentMessages) =>
      currentMessages.map((message) => (message.id === messageId ? { ...message, status } : message)),
    )

    const result = await updateWhatsAppMessageStatus(messageId, status)
    if (!result.ok) {
      await refreshSharedDataFromSupabase()
    }

    return result
  }

  const computedDashboard = hooks.useMemo(() => buildDashboardSnapshot({
    clientDeliveryOrders: clientDeliveryOrdersState,
    clientQrOrders: clientQrOrdersState,
    deliveries: deliveryState,
    inventoryItems: inventoryState,
    kitchenOrders: kitchenState,
    payments: paymentsState,
    products: productsState,
    tables: tablesState,
  }), [
    clientDeliveryOrdersState,
    clientQrOrdersState,
    deliveryState,
    inventoryState,
    kitchenState,
    paymentsState,
    productsState,
    tablesState,
  ])

  const pages = {
    dashboard: <Dashboard data={computedDashboard} icons={icons} />,
    'operacao-dia': (
      <DailyOperation
        deliveries={deliveryState}
        expenses={expensesState}
        inventoryItems={inventoryState}
        payments={paymentsState}
        products={productsState}
        stockAdjustments={stockAdjustmentsState}
        tables={tablesState}
        technicalSheets={technicalSheetsState}
      />
    ),
    mesas: (
      <Tables
        clientQrOrders={clientQrOrdersState}
        onAddTableItem={handleAddTableItem}
        onAddTableGuest={handleAddTableGuest}
        onApproveClientQrOrder={handleApproveClientQrOrder}
        onCreateFixedQrTable={handleCreateFixedQrTable}
        onCreateTableSession={handleCreateTableSession}
        onDeleteTable={handleDeleteTable}
        onOpenTable={handleOpenTable}
        onRejectClientQrOrder={handleRejectClientQrOrder}
        onReopenTableClose={handleReopenTableClose}
        onRemoveTableItem={handleRemoveTableItem}
        onRequestTableClose={handleRequestTableClose}
        onQuickSale={handleQuickSale}
        onUpdateTableItemQuantity={handleUpdateTableItemQuantity}
        inventoryItems={inventoryState}
        kitchenOrders={kitchenState}
        payments={paymentsState}
        products={productsState}
        tables={tablesState}
        technicalSheets={technicalSheetsState}
      />
    ),
    delivery: (
      <Delivery
        clientDeliveryOrders={clientDeliveryOrdersState}
        customers={customersState}
        deliveries={deliveryState}
        onAddCustomer={handleAddDeliveryCustomer}
        onAdvanceOrder={handleAdvanceDeliveryOrder}
        onApproveClientDeliveryOrder={handleApproveClientDeliveryOrder}
        onClearClientDeliveryHistory={handleClearClientDeliveryHistory}
        onClearDeliveryQueue={handleClearDeliveryQueue}
        onCreateOrder={handleCreateDeliveryOrder}
        onRejectClientDeliveryOrder={handleRejectClientDeliveryOrder}
        onUpdateWhatsAppMessageStatus={handleUpdateWhatsAppMessageStatus}
        inventoryItems={inventoryState}
        products={productsState}
        technicalSheets={technicalSheetsState}
        whatsAppMessages={whatsAppInboxState}
      />
    ),
    clientes: (
      <Customers
        campaignHistory={customerCampaignsState}
        cashbackRate={5}
        customers={customersState}
        deliveries={deliveryState}
        onCreateCampaign={handleCreateCustomerCampaign}
        onSaveCustomer={handleSaveCustomer}
      />
    ),
    cozinha: <Kitchen onAdvanceOrder={handleAdvanceKitchenOrder} onPrioritizeOrder={handlePrioritizeKitchenOrder} orders={kitchenState} />,
    produtos: (
      <Products
        inventoryItems={inventoryState}
        onCreateSheet={handleCreateTechnicalSheet}
        onDeleteProduct={handleDeleteProduct}
        onSaveProduct={handleSaveProduct}
        onToggleProduct={handleToggleProduct}
        products={productsState}
        technicalSheets={technicalSheetsState}
      />
    ),
    caixa: (
      <Cashier
        cashClosings={cashClosingsState}
        customers={customersState}
        deliveries={deliveryState}
        onCloseCashierShift={handleCloseCashierShift}
        onCloseDeliveryPayment={handleCloseDeliveryPayment}
        onCloseTablePayment={handleCloseTablePayment}
        onReopenTableClose={handleReopenTableClose}
        payments={paymentsState}
        tables={tablesState}
      />
    ),
    estoque: (
      <Inventory
        inventoryItems={inventoryState}
        onResetInventory={handleResetInventoryStock}
        onSaveInventoryItem={handleSaveInventoryItem}
        onStockAdjustment={handleStockAdjustment}
        onStockEntry={handleStockEntry}
        stockAdjustments={stockAdjustmentsState}
      />
    ),
    compras: (
      <Purchases
        inventoryItems={inventoryState}
        onCreatePurchaseOrder={handleCreatePurchaseOrder}
        onCancelPurchaseOrder={handleCancelPurchaseOrder}
        onImportFiscalCoupon={handleImportFiscalCoupon}
        onReceivePurchaseOrder={handleReceivePurchaseOrder}
        purchaseOrders={purchaseOrdersState}
      />
    ),
    'ficha-tecnica': (
      <TechnicalSheet
        inventoryItems={inventoryState}
        onAddIngredient={handleAddIngredient}
        onCreateSheet={handleCreateTechnicalSheet}
        onDeleteSheet={handleDeleteTechnicalSheet}
        onRemoveIngredient={handleRemoveIngredient}
        onUpdateSheet={handleUpdateTechnicalSheet}
        products={productsState}
        technicalSheets={technicalSheetsState}
      />
    ),
    financeiro: (
      <Financial
        accountsReceivable={accountsReceivableState}
        expenses={expensesState}
        onAddExpense={handleAddExpense}
        onReceiveReceivable={handleReceiveReceivable}
        onToggleExpenseStatus={handleToggleExpenseStatus}
        payments={paymentsState}
      />
    ),
    dre: (
      <Dre
        expenses={expensesState}
        inventoryItems={inventoryState}
        payments={paymentsState}
        products={productsState}
        stockAdjustments={stockAdjustmentsState}
        technicalSheets={technicalSheetsState}
      />
    ),
    usuarios: <UserPermissions canManageUsers={userProfile?.role === 'admin'} currentUser={currentUser} />,
  }

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-panel auth-loading-panel">
          <BrandLogo />
          <p className="eyebrow">LoccoBurger Gestao</p>
          <h1>Carregando dados...</h1>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <AuthPage
        authMode={authMode}
        authStatus={authStatus}
        email={authEmail}
        message={authMessage}
        onEmailChange={setAuthEmail}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onPasswordReset={handlePasswordReset}
        onStoreCodeChange={setAuthStoreCode}
        onSubmit={handleAuthSubmit}
        password={authPassword}
        storeCode={authStoreCode}
      />
    )
  }

  if (!dataReady) {
    return (
      <main className="auth-shell">
        <section className="auth-panel auth-loading-panel">
          <BrandLogo />
          <p className="eyebrow">LoccoBurger Gestao</p>
          <h1>Carregando dados...</h1>
        </section>
      </main>
    )
  }

  return (
    <Layout
      activePage={activePage}
      accessProfiles={accessProfiles}
      activeProfile={activeProfile}
      deviceView={deviceView}
      deviceViewOptions={deviceViewOptions}
      navigation={visibleNavigation}
      onDeviceViewChange={handleDeviceViewChange}
      onNavigate={handleNavigate}
      onProfileChange={handleProfileChange}
      pageTitle={pageTitle}
      icons={icons}
      notifications={adminNotificationsState}
      onClearNotifications={handleClearAdminNotifications}
      onResetData={handleResetData}
      onResetFinancialData={handleResetFinancialData}
      onResetInventoryStock={handleResetInventoryStock}
      onResetOperationData={handleResetOperationData}
      onLogout={handleLogout}
      repositoryStatus={repositoryStatus}
      syncStatus={syncStatus}
      userProfile={userProfile}
      userEmail={currentUser.email}
    >
      {pages[activePage]}
    </Layout>
  )
}
