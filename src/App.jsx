import { useEffect, useRef, useState } from 'react'
import './loccoburger-public.css'
import './loccoburger-landing-final.css'
import { customers, dashboard, deliveries, inventoryItems, kitchenQueue, products, tables, technicalSheets } from './data/mockData.js'
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
import { loadUserProfile } from './lib/userProfileRepository.js'
import { loadWhatsAppMessages, updateWhatsAppMessageStatus } from './lib/whatsappRepository.js'
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
import { applyModifierStockConsumption } from './lib/orderModifiers.js'


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
      element.style.setProperty('--locco-reveal-delay', `${Math.min(index * 65, 520)}ms`)
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
      { rootMargin: '0px 0px -8% 0px', threshold: 0.14 },
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
      if (cursorDot) {
        cursorDot.style.opacity = '0'
      }
    }

    const updatePointer = (event) => {
      currentPoint = { x: event.clientX, y: event.clientY }
      if (cursorDot) {
        cursorDot.style.opacity = '1'
        cursorDot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`
      }
    }

    const paint = () => {
      context.globalCompositeOperation = 'destination-out'
      context.fillStyle = 'rgba(0, 0, 0, 0.09)'
      context.fillRect(0, 0, width, height)

      if (currentPoint) {
        const previousPoint = lastPoint ?? currentPoint
        const gradient = context.createLinearGradient(previousPoint.x, previousPoint.y, currentPoint.x, currentPoint.y)
        gradient.addColorStop(0, 'rgba(255, 198, 47, 0.04)')
        gradient.addColorStop(0.72, 'rgba(255, 198, 47, 0.52)')
        gradient.addColorStop(1, 'rgba(255, 248, 210, 0.92)')

        context.globalCompositeOperation = 'source-over'
        context.beginPath()
        context.moveTo(previousPoint.x, previousPoint.y)
        context.lineTo(currentPoint.x, currentPoint.y)
        context.lineCap = 'round'
        context.lineWidth = 2.4
        context.strokeStyle = gradient
        context.shadowBlur = 13
        context.shadowColor = 'rgba(255, 183, 24, 0.55)'
        context.stroke()
        context.shadowBlur = 0
        lastPoint = currentPoint
      }

      animationFrame = window.requestAnimationFrame(paint)
    }

    resizeCanvas()
    paint()
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
          o garçom aprova e a cozinha recebe na gestão.
        </p>

        <div className="locco-premium-order-flow" aria-label="Fluxo do pedido digital">
          <span>QR Code</span>
          <span>Cliente escolhe</span>
          <span>Garçom aprova</span>
          <span>Cozinha recebe</span>
        </div>

        <div className="locco-premium-actions">
          <a className="locco-premium-primary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Enviar teste pelo WhatsApp
          </a>
          <button className="locco-premium-secondary locco-premium-ghost-button" type="button" onClick={closeOrderScreen}>
            Voltar ao site
          </button>
        </div>
      </div>

      <div className="locco-premium-order-ui">
        <article className="locco-premium-phone locco-premium-phone-menu" aria-label="Tela de cardápio mobile LoccoBurger">
          <header>
            <button type="button" aria-label="Menu">☰</button>
            <strong>Locco Menu</strong>
            <button type="button" aria-label="Carrinho">🛒</button>
          </header>

          <div className="locco-premium-phone-search">
            <span>Encontre seu burger</span>
            <small>Mesa 04 • pedido digital</small>
          </div>

          <div className="locco-premium-order-tabs" role="tablist" aria-label="Categorias do cardápio">
            {orderCategories.map((category) => (
              <button
                className={selectedOrderCategory === category ? 'is-active' : ''}
                key={category}
                type="button"
                role="tab"
                aria-selected={selectedOrderCategory === category}
                onClick={() => setSelectedOrderCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="locco-premium-order-products">
            {visibleOrderProducts.map((product) => (
              <button
                className={selectedOrderProduct.id === product.id ? 'is-active' : ''}
                key={product.id}
                type="button"
                onClick={() => setSelectedOrderProduct(product)}
              >
                <img src={product.image} alt="" />
                <span>{product.name}</span>
                <small>{product.price}</small>
                <b>+</b>
              </button>
            ))}
          </div>

          <footer>
            <span>Subtotal visual</span>
            <strong>{selectedOrderProduct.price}</strong>
          </footer>
        </article>

        <article className="locco-premium-phone locco-premium-phone-detail" aria-label="Tela de produto selecionado">
          <header>
            <button type="button" aria-label="Voltar" onClick={closeOrderScreen}>‹</button>
            <strong>Pedido</strong>
            <button type="button" aria-label="Favorito">♡</button>
          </header>

          <div className="locco-premium-order-burst">
            <img src="/locco-site/order-burger-drip-v1.png" alt="Burger com queijo derretido saindo da tela" />
          </div>

          <div className="locco-premium-order-detail-copy">
            <span>{selectedOrderProduct.category}</span>
            <h3>{selectedOrderProduct.name}</h3>
            <p>{selectedOrderProduct.description}</p>
          </div>

          <div className="locco-premium-order-summary">
            <span>Total</span>
            <strong>{selectedOrderProduct.price}</strong>
          </div>

          <a className="locco-premium-order-now" href={whatsappUrl} target="_blank" rel="noreferrer">
            Enviar pedido
          </a>
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
            <a href="#pedido" onClick={openOrderScreen}>Pedido</a>
            <a href="#ponto-da-carne">Ponto da carne</a>
            <a href="#cardapio">Cardápio</a>
            <a href="#localizacao">Localização</a>
          </nav>

          <a className="locco-premium-order-link" href="#pedido" onClick={openOrderScreen}>
            Fazer pedido
          </a>
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
              <a className="locco-premium-primary" href="#pedido" onClick={openOrderScreen}>Fazer pedido agora</a>
              <a className="locco-premium-secondary" href={mapsUrl} target="_blank" rel="noreferrer">Ver localização</a>
            </div>

            <div className="locco-premium-tags" aria-label="Diferenciais LoccoBurger">
              <span>Carne na brasa</span>
              <span>Ingredientes frescos</span>
              <span>Atendimento no local</span>
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
          <a className="locco-premium-secondary" href={whatsappUrl} target="_blank" rel="noreferrer">
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
          <h2>Escolha seu Locco favorito e peça pelo WhatsApp.</h2>
          <p>
            Tem burger clássico, smash, especiais da casa, porção de batata e bebidas. Dá uma olhada
            no cardápio e chama a gente para montar seu pedido.
          </p>
          <div className="locco-premium-menu-highlights" aria-label="Destaques do cardápio">
            {menuHighlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <a className="locco-premium-primary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Ver cardápio e pedir
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
            que combine comida boa, ambiente direto e o estilo LoccoBurger.
          </p>
        </div>
      </section>

      <section className="locco-premium-location" id="localizacao">
        <div>
          <p className="locco-premium-kicker">Localização</p>
          <h2>Estamos em Santo André.</h2>
          <p>Av. Nova Iorque, 304 - Santo André, Brazil</p>
          <div className="locco-premium-actions compact">
            <a className="locco-premium-primary" href={whatsappUrl} target="_blank" rel="noreferrer">Pedir pelo WhatsApp</a>
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
        <span>© {currentYear} LoccoBurger</span>
        <strong>Hamburgueria artesanal na brasa.</strong>
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
const remoteSyncIntervalMs = 3500
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
  return tables.map((table) => ({
    ...table,
    orderItems: [],
    tabs: [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: [] }],
  }))
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

function createMainTableTab(tableId, metadata = {}, orderItems = []) {
  return {
    id: `${tableId}-mesa`,
    name: metadata.customerName || 'Mesa',
    orderItems,
    customerName: metadata.customerName || '',
    tableNumber: metadata.tableNumber || '',
    tableLabel: metadata.tableLabel || '',
    dynamic: Boolean(metadata.dynamic),
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
    tableNumber: metadata.tableNumber || '',
    tableLabel: metadata.tableLabel || '',
    dynamic: Boolean(metadata.dynamic),
    tabs: normalizedTabs.map((tab) =>
      tab.id === mainTabId || tab.name === 'Mesa'
        ? {
            ...tab,
            name: metadata.customerName || tab.name || 'Mesa',
            customerName: metadata.customerName || '',
            tableNumber: metadata.tableNumber || '',
            tableLabel: metadata.tableLabel || '',
            dynamic: Boolean(metadata.dynamic),
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

function mergeOfficialProducts(currentProducts = []) {
  const customProducts = currentProducts.filter((product) => !products.some((defaultProduct) => defaultProduct.id === product.id))

  return [
    ...products.map((product) => {
      const currentProduct = currentProducts.find((item) => item.id === product.id)
      return {
        ...product,
        active: currentProduct?.active ?? product.active,
      }
    }),
    ...customProducts,
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
    kitchen: (state.kitchen ?? []).map(normalizeKitchenOrder),
    products: mergeOfficialProducts(state.products ?? products),
  }
}

function createStateSignature(value) {
  return JSON.stringify(value ?? null)
}

export default function App({ icons, hooks }) {
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
    setSaveStatus('saving')

    const saveJobs = [saveAppState(normalizedState)]

    if (currentUser) {
      saveJobs.push(
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
    const whatsappResult = await loadWhatsAppMessages()

    if (catalogResult.ok && catalogResult.hasData) {
      const catalogState = normalizeCatalogState(catalogResult.catalog)
      nextState = {
        ...nextState,
        inventory: catalogState.inventory,
        products: catalogState.products,
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

  async function refreshSharedDataFromSupabase() {
    if (remoteSyncRunningRef.current || saveStatusRef.current === 'saving') return
    remoteSyncRunningRef.current = true

    try {
      const [appStateResult, catalogResult, crmResult, financeResult, operationResult, whatsappResult] = await Promise.all([
        loadAppState(defaultAppState),
        loadCatalogTables(),
        loadCustomerDeliveryTables(),
        loadFinanceTables(),
        loadOperationTables(),
        loadWhatsAppMessages(),
      ])
      const currentState = appStateRef.current ?? getCurrentAppState()

      if (appStateResult.state && appStateResult.source !== 'local-fallback') {
        const appState = normalizeAppState(appStateResult.state)
        const remoteAuxiliaryState = {
          stockAdjustments: appState.stockAdjustments ?? [],
          purchaseOrders: appState.purchaseOrders ?? [],
        }
        const currentAuxiliaryState = {
          stockAdjustments: currentState.stockAdjustments ?? [],
          purchaseOrders: currentState.purchaseOrders ?? [],
        }

        if (createStateSignature(remoteAuxiliaryState) !== createStateSignature(currentAuxiliaryState)) {
          setStockAdjustmentsState(remoteAuxiliaryState.stockAdjustments)
          setPurchaseOrdersState(remoteAuxiliaryState.purchaseOrders)
        }
      }

      if (catalogResult.ok && catalogResult.hasData) {
        const catalogState = normalizeCatalogState(catalogResult.catalog)
        const remoteCatalog = {
          inventory: catalogState.inventory,
          products: catalogState.products,
          technicalSheets: catalogState.technicalSheets,
        }
        const currentCatalog = {
          inventory: currentState.inventory,
          products: currentState.products,
          technicalSheets: currentState.technicalSheets,
        }

        if (createStateSignature(remoteCatalog) !== createStateSignature(currentCatalog)) {
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

        if (createStateSignature(remoteFinance) !== createStateSignature(currentFinance)) {
          setPaymentsState(remoteFinance.payments)
          setAccountsReceivableState(remoteFinance.accountsReceivable)
          setExpensesState(remoteFinance.expenses)
          setCashClosingsState(remoteFinance.cashClosings)
        }
      }

      if (operationResult.ok && operationResult.hasData) {
        const remoteOperation = {
          tables: operationResult.data.tables,
          kitchen: operationResult.data.kitchen,
        }
        const currentOperation = {
          tables: currentState.tables,
          kitchen: currentState.kitchen,
        }

        if (createStateSignature(remoteOperation) !== createStateSignature(currentOperation)) {
          setTablesState(remoteOperation.tables)
          setKitchenState(remoteOperation.kitchen)
        }
      }

      if (whatsappResult.ok) {
        const remoteWhatsAppInbox = whatsappResult.messages
        const currentWhatsAppInbox = currentState.whatsAppInbox ?? []

        if (createStateSignature(remoteWhatsAppInbox) !== createStateSignature(currentWhatsAppInbox)) {
          setWhatsAppInboxState(remoteWhatsAppInbox)
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
    if (!currentUser || !dataReady) return undefined

    setSaveStatus('saving')
    const timeoutId = window.setTimeout(async () => {
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
    if (!currentUser || !dataReady || !catalogHydratedRef.current) return undefined

    const timeoutId = window.setTimeout(() => {
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
    if (!currentUser || !dataReady || !crmHydratedRef.current) return undefined

    const timeoutId = window.setTimeout(() => {
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
    if (!currentUser || !dataReady || !financeHydratedRef.current) return undefined

    const timeoutId = window.setTimeout(() => {
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
    if (!currentUser || !dataReady || !operationHydratedRef.current) return undefined

    const timeoutId = window.setTimeout(() => {
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

  function handleSaveProduct(product) {
    const shouldCreateSheet = product.recipeId === 'new-sheet'
    const productId = product.id ? Number(product.id) : Date.now()
    let nextRecipeId = product.recipeId

    if (shouldCreateSheet) {
      const newSheet = createEmptyTechnicalSheet({ currentSheets: technicalSheetsState, productId })
      nextRecipeId = newSheet.id
      setTechnicalSheetsState((currentSheets) => [newSheet, ...currentSheets])
    }

    setProductsState((currentProducts) =>
      saveProduct({
        currentProducts,
        product: {
          ...product,
          id: productId,
          recipeId: nextRecipeId,
        },
      }),
    )
  }

  function handleToggleProduct(productId) {
    setProductsState((currentProducts) => toggleProductStatus(currentProducts, productId))
  }

  function handleSaveInventoryItem(item) {
    setInventoryState((currentItems) => saveInventoryItem({ currentItems, item }))
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

  function handleAddIngredient(sheetId, ingredient) {
    setTechnicalSheetsState((currentSheets) =>
      currentSheets.map((sheet) => (sheet.id === sheetId ? addIngredientToSheet(sheet, ingredient) : sheet)),
    )
  }

  function handleRemoveIngredient(sheetId, inventoryItemId) {
    setTechnicalSheetsState((currentSheets) =>
      currentSheets.map((sheet) =>
        sheet.id === sheetId ? removeIngredientFromSheet(sheet, inventoryItemId) : sheet,
      ),
    )
  }

  function handleUpdateTechnicalSheet(sheetId, details) {
    setTechnicalSheetsState((currentSheets) =>
      currentSheets.map((sheet) => (sheet.id === sheetId ? updateTechnicalSheetDetails(sheet, details) : sheet)),
    )
  }

  function handleCreateTechnicalSheet(productId) {
    const product = productsState.find((item) => item.id === productId)
    if (!product || product.recipeId) return null

    const newSheet = createEmptyTechnicalSheet({ currentSheets: technicalSheetsState, productId })
    setTechnicalSheetsState((currentSheets) => [newSheet, ...currentSheets])
    setProductsState((currentProducts) =>
      currentProducts.map((item) => (item.id === productId ? { ...item, recipeId: newSheet.id } : item)),
    )

    return newSheet
  }

  function handleOpenTable(tableId, metadata = {}) {
    setTablesState((currentTables) =>
      currentTables.map((table) =>
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
      ),
    )
  }

  function handleCreateTableSession(session = {}) {
    const tableNumber = String(session.tableNumber ?? '').trim()
    const customerName = String(session.customerName ?? '').trim()
    const attendant = String(session.attendant ?? '').trim() || 'Balcao'

    if (!tableNumber && !customerName) return null

    const existingTable = tableNumber
      ? tablesState.find((table) => {
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

    setTablesState((currentTables) => {
      if (existingTable) {
        return currentTables.map((table) => (table.id === existingTable.id ? nextTable : table))
      }

      return [nextTable, ...currentTables]
    })

    return nextTable
  }

  function handleAddTableGuest(tableId, guestName) {
    const newTab = {
      id: `${tableId}-${Date.now()}`,
      name: guestName.trim(),
      orderItems: [],
    }

    if (!newTab.name) return null

    setTablesState((currentTables) =>
      currentTables.map((table) =>
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
      ),
    )

    return newTab
  }

  function resetTableForNewService(table) {
    return {
      ...table,
      status: 'livre',
      guests: 0,
      attendant: '-',
      total: 0,
      orderItems: [],
      customerName: '',
      tableNumber: '',
      tableLabel: '',
      dynamic: false,
      tabs: [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: [] }],
    }
  }

  function handleRequestTableClose(tableId, options = {}) {
    const table = tablesState.find((currentTable) => currentTable.id === tableId)
    if (!table) return { ok: false, message: 'Mesa nao encontrada.' }

    if (options.reset) {
      setTablesState((currentTables) =>
        currentTables.flatMap((currentTable) => {
          if (currentTable.id !== tableId) return [currentTable]
          return currentTable.dynamic ? [] : [resetTableForNewService(currentTable)]
        }),
      )
      return { ok: true, message: `${getTableSessionLabel(table)} fechada e resetada.` }
    }

    setTablesState((currentTables) =>
      currentTables.map((currentTable) =>
        currentTable.id === tableId && currentTable.status !== 'livre'
          ? { ...currentTable, status: 'fechamento' }
          : currentTable,
      ),
    )

    return { ok: true, message: `${getTableSessionLabel(table)} enviada para fechamento.` }
  }

  function handleDeleteTable(tableId) {
    const table = tablesState.find((currentTable) => currentTable.id === tableId)
    if (!table) return { ok: false, message: 'Mesa nao encontrada.' }
    if (tablesState.length <= 1) return { ok: false, message: 'Mantenha ao menos uma mesa cadastrada.' }

    setTablesState((currentTables) => currentTables.filter((currentTable) => currentTable.id !== tableId))
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

  function findEditableKitchenTicketForTableItem(item, tableId, kitchenOrders = kitchenState) {
    const directTicket = item.kitchenTicketId
      ? kitchenOrders.find((order) => order.id === item.kitchenTicketId)
      : null

    if (directTicket) return directTicket

    const table = tablesState.find((currentTable) => currentTable.id === tableId)
    const tableSource = getTableSessionLabel(table)

    return kitchenOrders.find((order) =>
      (order.source === `Mesa ${tableId}` || order.source === tableSource) &&
      String(order.item ?? '').includes(item.name),
    )
  }

  function getTableItemEditContext(tableId, itemId) {
    const table = tablesState.find((currentTable) => currentTable.id === tableId)
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

  function createKitchenTicket({ kitchenTicketId = null, modifiers = null, notes = '', orderItemId = null, source, productId, quantity }) {
    const product = productsState.find((item) => item.id === productId)
    const sheet = technicalSheetsState.find((item) => item.id === product?.recipeId)

    if (!product || !sheet) return null

    const ticketId = kitchenTicketId ?? `#P-${Date.now()}-${productId}`

    setKitchenState((currentQueue) => [
      {
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
      },
      ...currentQueue,
    ])

    return ticketId
  }

  function handleAddTableItem(tableId, productId, quantity, tabId = null, notes = '', options = {}) {
    const product = productsState.find((item) => item.id === productId)
    const sheet = technicalSheetsState.find((item) => item.id === product?.recipeId)
    const stockAvailability = checkProductStockAvailability({
      inventoryItems: inventoryState,
      productId,
      products: productsState,
      quantity,
      technicalSheets: technicalSheetsState,
    })

    if (!product || !sheet || quantity <= 0) return { ok: false, message: 'Nao foi possivel lancar este item.' }
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

    setTablesState((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId
          ? (() => {
              const tableTabs = getTableTabs(table)
              const targetTab = tableTabs.find((tab) => tab.id === tabId) ?? tableTabs[0]
              const itemWithTab = { ...orderItem, tabId: targetTab.id, tabName: targetTab.name }

              return {
              ...table,
              status: table.status === 'livre' ? 'ocupada' : table.status,
              guests: table.guests || 1,
              attendant: table.attendant === '-' ? 'Balcao' : table.attendant,
              total: table.total + itemWithTab.total,
              orderItems: [...table.orderItems, itemWithTab],
              tabs: tableTabs.map((tab) =>
                tab.id === targetTab.id ? { ...tab, orderItems: [...(tab.orderItems ?? []), itemWithTab] } : tab,
              ),
            }
            })()
          : table,
      ),
    )

    consumeProductStock(productId, quantity, options.modifiers)
    const tableSource = getTableSessionLabel(tablesState.find((table) => table.id === tableId) ?? { id: tableId })

    createKitchenTicket({
      kitchenTicketId,
      modifiers: options.modifiers,
      notes: options.manualNotes ?? orderItem.notes,
      orderItemId,
      source: tableSource,
      productId,
      quantity,
    })
    return {
      ok: true,
      message: options.forceStock
        ? 'Item lancado com alerta de estoque. Corrigir saldo antes das proximas vendas.'
        : 'Item lancado e enviado para a cozinha.',
    }
  }

  function handleRemoveTableItem(tableId, itemId) {
    const editContext = getTableItemEditContext(tableId, itemId)
    if (!editContext.ok) return editContext

    const { item, kitchenTicket } = editContext

    setTablesState((currentTables) =>
      currentTables.map((table) => {
        if (table.id !== tableId) return table

        const nextOrderItems = (table.orderItems ?? []).filter((orderItem) => orderItem.id !== itemId)
        const nextTabs = getTableTabs(table).map((tab) => ({
          ...tab,
          orderItems: (tab.orderItems ?? []).filter((orderItem) => orderItem.id !== itemId),
        }))
        const nextTotal = nextOrderItems.reduce((total, orderItem) => total + Number(orderItem.total || 0), 0)

        return {
          ...table,
          total: nextTotal,
          orderItems: nextOrderItems,
          tabs: nextTabs,
        }
      }),
    )

    if (kitchenTicket) {
      setKitchenState((currentQueue) => currentQueue.filter((order) => order.id !== kitchenTicket.id))
    }

    consumeProductStock(item.productId, -Number(item.quantity || 0), item.modifiers)

    return { ok: true, message: 'Item excluido da comanda e retirado da fila da cozinha.' }
  }

  function handleUpdateTableItemQuantity(tableId, itemId, nextQuantity, options = {}) {
    const quantity = Number(nextQuantity)
    const editContext = getTableItemEditContext(tableId, itemId)
    if (!editContext.ok) return editContext
    if (!Number.isFinite(quantity) || quantity <= 0) return handleRemoveTableItem(tableId, itemId)

    const { item, kitchenTicket } = editContext
    const previousQuantity = Number(item.quantity || 0)
    const quantityDiff = quantity - previousQuantity

    if (quantityDiff === 0) return { ok: true, message: 'Quantidade mantida.' }

    if (quantityDiff > 0) {
      const stockAvailability = checkProductStockAvailability({
        inventoryItems: inventoryState,
        productId: item.productId,
        products: productsState,
        quantity: quantityDiff,
        technicalSheets: technicalSheetsState,
      })

      if (!stockAvailability.available && !options.forceStock) {
        return { ok: false, needsOverride: true, message: stockAvailability.message }
      }
    }

    setTablesState((currentTables) =>
      currentTables.map((table) => {
        if (table.id !== tableId) return table

        const updateItem = (orderItem) => (
          orderItem.id === itemId
            ? {
                ...orderItem,
                quantity,
                total: Number(orderItem.unitPrice || 0) * quantity,
              }
            : orderItem
        )
        const nextOrderItems = (table.orderItems ?? []).map(updateItem)
        const nextTabs = getTableTabs(table).map((tab) => ({
          ...tab,
          orderItems: (tab.orderItems ?? []).map(updateItem),
        }))
        const nextTotal = nextOrderItems.reduce((total, orderItem) => total + Number(orderItem.total || 0), 0)

        return {
          ...table,
          total: nextTotal,
          orderItems: nextOrderItems,
          tabs: nextTabs,
        }
      }),
    )

    if (kitchenTicket) {
      setKitchenState((currentQueue) =>
        currentQueue.map((order) =>
          order.id === kitchenTicket.id
            ? {
                ...order,
                item: `${quantity}x ${item.name}`,
                priority: quantity > 2 ? 'alta' : 'normal',
              }
            : order,
        ),
      )
    }

    consumeProductStock(item.productId, quantityDiff, item.modifiers)

    return {
      ok: true,
      message: options.forceStock
        ? 'Quantidade ajustada com alerta de estoque. Corrigir saldo antes das proximas vendas.'
        : 'Quantidade do item atualizada.',
    }
  }

  function handleAdvanceKitchenOrder(orderId) {
    setKitchenState((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) return order

        const currentIndex = kitchenStatusFlow.indexOf(order.status)
        const nextStatus = kitchenStatusFlow[Math.min(currentIndex + 1, kitchenStatusFlow.length - 1)]
        const now = Date.now()

        return {
          ...order,
          status: nextStatus,
          startedAt: order.startedAt ?? now,
          finalizedAt: nextStatus === 'finalizado' && !order.finalizedAt ? now : order.finalizedAt,
          completedAt: nextStatus === 'finalizado' && !order.completedAt ? now : order.completedAt,
          deliveredAt: nextStatus === 'finalizado' && !order.deliveredAt ? now : order.deliveredAt,
        }
      }),
    )
  }

  function handlePrioritizeKitchenOrder(orderId) {
    const now = Date.now()

    setKitchenState((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId && order.status !== 'finalizado'
          ? { ...order, priority: 'alta', prioritizedAt: now }
          : order,
      ),
    )
  }

  function handleCloseTablePayment(tableId, paymentMethod, tabId = 'all', options = {}) {
    const table = tablesState.find((item) => item.id === tableId)
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
      payment.method === 'caderneta' && !customersState.some((customer) => customer.id === Number(payment.customerId)),
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
      const notebookCustomer = customersState.find((customer) => customer.id === Number(payment.customerId))

      return {
        id: `${paymentTimestamp}-${tableId}-${tabId}-${index}`,
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
        receivedAmount: isNotebook ? 0 : Number(payment.amount),
        change: 0,
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        paidAt: now.toLocaleDateString('pt-BR'),
        paidAtIso: now.toISOString(),
        items: index === paidItemsIndex ? paidItems : [],
      }
    })
    const nextReceivableRecords = paymentParts
      .filter((payment) => payment.method === 'caderneta')
      .map((payment, index) => {
        const notebookCustomer = customersState.find((customer) => customer.id === Number(payment.customerId))

        return {
          id: `${paymentTimestamp}-${payment.customerId}-${index}`,
          code: `CR-${String(accountsReceivableState.length + index + 1).padStart(4, '0')}`,
          customerId: notebookCustomer.id,
          customerName: notebookCustomer.name,
          description: `Caderneta ${getTableSessionLabel(table)}${tabId === 'all' ? '' : ` - ${selectedTab?.name ?? ''}`}`,
          amount: Number(payment.amount),
          grossAmount: Number(payment.amount),
          discount: 0,
          serviceCharge: 0,
          status: 'aberto',
          createdAt: now.toLocaleDateString('pt-BR'),
          createdAtIso: now.toISOString().slice(0, 10),
          dueDate: now.toLocaleDateString('pt-BR'),
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          tableId,
          tabId,
          items: paidItems,
        }
      })
    const nextPayments = [...nextPaymentRecords, ...paymentsState]
    const nextReceivables = [...nextReceivableRecords, ...accountsReceivableState]
    const nextTables = tablesState.flatMap((item) => {
      if (item.id !== tableId) return [item]

      if (tabId === 'all') {
        if (item.dynamic) return []

        return [{
          ...item,
          status: 'livre',
          guests: 0,
          attendant: '-',
          total: 0,
          orderItems: [],
          customerName: '',
          tableNumber: '',
          tableLabel: '',
          dynamic: false,
          tabs: [{ id: `${item.id}-mesa`, name: 'Mesa', orderItems: [] }],
        }]
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
        return [{
          ...item,
          status: 'livre',
          guests: 0,
          attendant: '-',
          total: 0,
          orderItems: [],
          customerName: '',
          tableNumber: '',
          tableLabel: '',
          dynamic: false,
          tabs: [{ id: `${item.id}-mesa`, name: 'Mesa', orderItems: [] }],
        }]
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
      ...getCurrentAppState(),
      tables: nextTables,
      payments: nextPayments,
      accountsReceivable: nextReceivables,
    }
    const successMessage = `${getTableSessionLabel(table)} fechada e zerada no caixa.`

    void persistCheckoutState(nextState, successMessage)

    return { ok: true, message: successMessage }
  }

  function handleCloseDeliveryPayment(deliveryId, paymentMethod, options = {}) {
    const deliveryOrder = deliveryState.find((order) => order.id === deliveryId)
    if (!deliveryOrder || Number(deliveryOrder.total || 0) <= 0) {
      return { ok: false, message: 'Delivery sem saldo para fechar.' }
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
      payment.method === 'caderneta' && !customersState.some((customer) => customer.id === Number(payment.customerId)),
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
      const notebookCustomer = customersState.find((customer) => customer.id === Number(payment.customerId))

      return {
        id: `${paymentTimestamp}-${deliveryId}-${index}`,
        source: 'delivery',
        deliveryId,
        customerId: notebookCustomer?.id ?? deliveryOrder.customerId ?? null,
        customerName: notebookCustomer?.name ?? deliveryOrder.customer ?? null,
        method: payment.method,
        amount: isNotebook ? 0 : Number(payment.amount),
        grossAmount: index === paidItemsIndex ? paidAmount : 0,
        netAmount: Number(payment.amount),
        discount: index === paidItemsIndex ? discount : 0,
        serviceCharge: index === paidItemsIndex ? serviceCharge : 0,
        receivedAmount: isNotebook ? 0 : Number(payment.amount),
        change: 0,
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        paidAt: now.toLocaleDateString('pt-BR'),
        paidAtIso: now.toISOString(),
        items: index === paidItemsIndex ? paidItems : [],
      }
    })
    const nextReceivableRecords = paymentParts
      .filter((payment) => payment.method === 'caderneta')
      .map((payment, index) => {
        const notebookCustomer = customersState.find((customer) => customer.id === Number(payment.customerId))

        return {
          id: `${paymentTimestamp}-${payment.customerId}-${index}`,
          code: `CR-${String(accountsReceivableState.length + index + 1).padStart(4, '0')}`,
          customerId: notebookCustomer.id,
          customerName: notebookCustomer.name,
          description: `Caderneta Delivery ${deliveryId}`,
          amount: Number(payment.amount),
          grossAmount: Number(payment.amount),
          discount: 0,
          serviceCharge: 0,
          status: 'aberto',
          createdAt: now.toLocaleDateString('pt-BR'),
          createdAtIso: now.toISOString().slice(0, 10),
          dueDate: now.toLocaleDateString('pt-BR'),
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          deliveryId,
          items: paidItems,
        }
      })
    const nextPayments = [...nextPaymentRecords, ...paymentsState]
    const nextReceivables = [...nextReceivableRecords, ...accountsReceivableState]
    const nextDeliveries = deliveryState.map((order) =>
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
      ...getCurrentAppState(),
      deliveries: nextDeliveries,
      payments: nextPayments,
      accountsReceivable: nextReceivables,
    }
    const successMessage = `Delivery ${deliveryId} pago e atualizado no caixa.`

    void persistCheckoutState(nextState, successMessage)

    return { ok: true, message: successMessage }
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
    const paidAtIso = now.toISOString().slice(0, 10)
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

  function handleCloseCashierShift(closing) {
    const now = new Date()

    setCashClosingsState((currentClosings) => [
      {
        id: Date.now(),
        code: `FC-${String(currentClosings.length + 1).padStart(4, '0')}`,
        ...closing,
        createdAt: now.toLocaleDateString('pt-BR'),
        createdAtIso: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      ...currentClosings,
    ])

    return { ok: true }
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

  function handleCreateDeliveryOrder(order, options = {}) {
    const newOrder = createDeliveryOrder({ order, customers: customersState, deliveries: deliveryState, products: productsState })

    if (!newOrder || !newOrder.items?.length) return { ok: false, message: 'Nao foi possivel criar o pedido.' }

    const stockIssue = newOrder.items
      .map((item) => checkProductStockAvailability({
        inventoryItems: inventoryState,
        productId: item.productId,
        products: productsState,
        quantity: item.quantity,
        technicalSheets: technicalSheetsState,
      }))
      .find((availability) => !availability.available)

    if (stockIssue && !options.forceStock) {
      return { ok: false, needsOverride: true, message: stockIssue.message }
    }

    setDeliveryState((currentOrders) => [newOrder, ...currentOrders])
    newOrder.items.forEach((item) => {
      consumeProductStock(item.productId, item.quantity, item.modifiers)
      createKitchenTicket({
        modifiers: item.modifiers,
        notes: item.manualNotes ?? item.notes,
        source: `Delivery ${newOrder.id}`,
        productId: item.productId,
        quantity: item.quantity,
      })
    })
    return {
      ok: true,
      message: options.forceStock
        ? 'Pedido criado com alerta de estoque. Corrigir saldo antes das proximas vendas.'
        : 'Pedido criado e enviado para a cozinha.',
    }
  }

  function handleAdvanceDeliveryOrder(orderId) {
    setDeliveryState((currentOrders) =>
      currentOrders.map((order) => (order.id === orderId ? advanceDeliveryOrder(order) : order)),
    )
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

  const pages = {
    dashboard: <Dashboard data={dashboard} icons={icons} />,
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
        onAddTableItem={handleAddTableItem}
        onAddTableGuest={handleAddTableGuest}
        onCreateTableSession={handleCreateTableSession}
        onDeleteTable={handleDeleteTable}
        onOpenTable={handleOpenTable}
        onRemoveTableItem={handleRemoveTableItem}
        onRequestTableClose={handleRequestTableClose}
        onUpdateTableItemQuantity={handleUpdateTableItemQuantity}
        inventoryItems={inventoryState}
        kitchenOrders={kitchenState}
        products={productsState}
        tables={tablesState}
        technicalSheets={technicalSheetsState}
      />
    ),
    delivery: (
      <Delivery
        customers={customersState}
        deliveries={deliveryState}
        onAddCustomer={handleAddDeliveryCustomer}
        onAdvanceOrder={handleAdvanceDeliveryOrder}
        onCreateOrder={handleCreateDeliveryOrder}
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
