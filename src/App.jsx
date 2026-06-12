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

function LandingMaintenancePage() {
  const currentYear = new Date().getFullYear()

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 18px',
        background:
          'radial-gradient(circle at top left, rgba(245, 158, 11, 0.2), transparent 34%), linear-gradient(135deg, #0b1410 0%, #111827 52%, #050505 100%)',
        color: '#fff7ed',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          width: 'min(720px, 100%)',
          padding: 'clamp(28px, 6vw, 56px)',
          borderRadius: '32px',
          border: '1px solid rgba(251, 191, 36, 0.22)',
          background: 'rgba(15, 23, 42, 0.72)',
          boxShadow: '0 28px 90px rgba(0, 0, 0, 0.38)',
          textAlign: 'center',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <BrandLogo />
        </div>

        <p
          style={{
            margin: '0 0 14px',
            color: '#fbbf24',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          LoccoBurger.com
        </p>

        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(34px, 8vw, 66px)',
            lineHeight: 0.95,
            letterSpacing: '-0.06em',
          }}
        >
          Pagina em manutencao
        </h1>

        <p
          style={{
            maxWidth: 520,
            margin: '22px auto 0',
            color: '#fed7aa',
            fontSize: 'clamp(16px, 3vw, 20px)',
            lineHeight: 1.7,
          }}
        >
          Breve teremos mais informacoes sobre o LoccoBurger.com.
        </p>

        <div
          style={{
            width: 84,
            height: 4,
            margin: '34px auto 0',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #f97316, #facc15)',
          }}
        />

        <p style={{ margin: '34px 0 0', color: 'rgba(255, 247, 237, 0.48)', fontSize: 13 }}>
          © {currentYear} LoccoBurger
        </p>
      </section>
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

  function handleResetData() {
    clearAppState()
    const defaultState = normalizeAppState(createDefaultAppState())
    setInventoryState(defaultState.inventory)
    setTechnicalSheetsState(defaultState.technicalSheets)
    setTablesState(defaultState.tables)
    setKitchenState(defaultState.kitchen)
    setPaymentsState(defaultState.payments)
    setAccountsReceivableState(defaultState.accountsReceivable)
    setCashClosingsState(defaultState.cashClosings)
    setExpensesState(defaultState.expenses)
    setStockAdjustmentsState(defaultState.stockAdjustments)
    setCustomersState(defaultState.customers)
    setCustomerCampaignsState(defaultState.customerCampaigns)
    setDeliveryState(defaultState.deliveries)
    setWhatsAppInboxState(defaultState.whatsAppInbox)
    setProductsState(defaultState.products)
    setPurchaseOrdersState(defaultState.purchaseOrders)
    setActivePage('dashboard')
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

  function handleRequestTableClose(tableId) {
    setTablesState((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId && table.status !== 'livre'
          ? { ...table, status: 'fechamento' }
          : table,
      ),
    )
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
    if (!table || table.total <= 0) return
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

    if (paidAmount <= 0) return
    const discount = Math.max(0, Number(options.discount || 0))
    const serviceCharge = Math.max(0, Number(options.serviceCharge || 0))
    const netAmount = Math.max(0, paidAmount - discount + serviceCharge)
    const paymentParts = Array.isArray(options.payments) && options.payments.length > 0
      ? options.payments.filter((payment) => Number(payment.amount) > 0)
      : [{ method: paymentMethod, amount: netAmount, customerId: options.customerId }]
    const partsTotal = paymentParts.reduce((total, payment) => total + Number(payment.amount || 0), 0)

    if (Math.abs(partsTotal - netAmount) > 0.01) return

    const missingNotebookCustomer = paymentParts.some((payment) =>
      payment.method === 'caderneta' && !customersState.some((customer) => customer.id === Number(payment.customerId)),
    )

    if (missingNotebookCustomer) return

    const itemCarrierIndex = paymentParts.findIndex((payment) => payment.method !== 'caderneta')
    const paidItemsIndex = itemCarrierIndex >= 0 ? itemCarrierIndex : 0

    setPaymentsState((currentPayments) => [
      ...paymentParts.map((payment, index) => {
        const isNotebook = payment.method === 'caderneta'
        const notebookCustomer = isNotebook
          ? customersState.find((customer) => customer.id === Number(payment.customerId))
          : null
        const amount = isNotebook ? 0 : Number(payment.amount)

        return {
          id: `${Date.now()}-${tableId}-${tabId}-${index}`,
          tableId,
          tabId,
          tabName: tabId === 'all' ? 'Mesa inteira' : selectedTab?.name,
          method: payment.method,
          amount,
          grossAmount: index === paidItemsIndex ? paidAmount : 0,
          netAmount: Number(payment.amount),
          customerId: notebookCustomer?.id ?? null,
          customerName: notebookCustomer?.name ?? null,
          discount: index === paidItemsIndex ? discount : 0,
          serviceCharge: index === paidItemsIndex ? serviceCharge : 0,
          receivedAmount: isNotebook ? 0 : Number(payment.amount),
          change: 0,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          items: index === paidItemsIndex ? paidItems : [],
        }
      }),
      ...currentPayments,
    ])

    paymentParts
      .filter((payment) => payment.method === 'caderneta')
      .forEach((payment) => {
      const now = new Date()
      const notebookCustomer = customersState.find((customer) => customer.id === Number(payment.customerId))
      setAccountsReceivableState((currentReceivables) => [
        {
          id: `${Date.now()}-${payment.customerId}`,
          code: `CR-${String(currentReceivables.length + 1).padStart(4, '0')}`,
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
        },
        ...currentReceivables,
      ])
    })

    setTablesState((currentTables) =>
      currentTables.flatMap((item) =>
        item.id === tableId && tabId === 'all'
          ? item.dynamic
            ? []
            : [{
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
          : item.id === tableId
            ? (() => {
                const paidItemIds = new Set(paidItems.map((paidItem) => paidItem.id))
                const remainingItems = item.orderItems.filter((orderItem) => !paidItemIds.has(orderItem.id))
                const remainingTabs = tableTabs
                  .map((tab) =>
                    tab.id === tabId
                      ? { ...tab, orderItems: [] }
                      : { ...tab, orderItems: (tab.orderItems ?? []).filter((orderItem) => !paidItemIds.has(orderItem.id)) },
                  )
                  .filter((tab) => tab.name === 'Mesa' || (tab.orderItems ?? []).length > 0)
                const nextTotal = remainingItems.reduce((total, orderItem) => total + orderItem.total, 0)

                return {
                  ...item,
                  status: nextTotal > 0 ? item.status : 'livre',
                  guests: nextTotal > 0 ? Math.max(1, remainingTabs.filter((tab) => tab.name !== 'Mesa').length) : 0,
                  attendant: nextTotal > 0 ? item.attendant : '-',
                  total: nextTotal,
                  orderItems: remainingItems,
                  tabs: nextTotal > 0 ? remainingTabs : [{ id: `${item.id}-mesa`, name: 'Mesa', orderItems: [] }],
                }
              })()
          : [item],
      ),
    )
  }

  function handleCloseDeliveryPayment(deliveryId, paymentMethod, options = {}) {
    const deliveryOrder = deliveryState.find((order) => order.id === deliveryId)
    if (!deliveryOrder || Number(deliveryOrder.total || 0) <= 0) return

    const paidItems = deliveryOrder.items ?? []
    const paidAmount = Number(deliveryOrder.total || 0)
    const discount = Math.max(0, Number(options.discount || 0))
    const serviceCharge = Math.max(0, Number(options.serviceCharge || 0))
    const netAmount = Math.max(0, paidAmount - discount + serviceCharge)
    const paymentParts = Array.isArray(options.payments) && options.payments.length > 0
      ? options.payments.filter((payment) => Number(payment.amount) > 0)
      : [{ method: paymentMethod, amount: netAmount, customerId: options.customerId }]
    const partsTotal = paymentParts.reduce((total, payment) => total + Number(payment.amount || 0), 0)

    if (Math.abs(partsTotal - netAmount) > 0.01) return

    const missingNotebookCustomer = paymentParts.some((payment) =>
      payment.method === 'caderneta' && !customersState.some((customer) => customer.id === Number(payment.customerId)),
    )

    if (missingNotebookCustomer) return

    const itemCarrierIndex = paymentParts.findIndex((payment) => payment.method !== 'caderneta')
    const paidItemsIndex = itemCarrierIndex >= 0 ? itemCarrierIndex : 0

    setPaymentsState((currentPayments) => [
      ...paymentParts.map((payment, index) => {
        const isNotebook = payment.method === 'caderneta'
        const notebookCustomer = isNotebook
          ? customersState.find((customer) => customer.id === Number(payment.customerId))
          : null
        const amount = isNotebook ? 0 : Number(payment.amount)

        return {
          id: `${Date.now()}-${deliveryId}-${index}`,
          source: 'delivery',
          deliveryId,
          customerId: notebookCustomer?.id ?? deliveryOrder.customerId ?? null,
          customerName: notebookCustomer?.name ?? deliveryOrder.customer ?? null,
          method: payment.method,
          amount,
          grossAmount: index === paidItemsIndex ? paidAmount : 0,
          netAmount: Number(payment.amount),
          discount: index === paidItemsIndex ? discount : 0,
          serviceCharge: index === paidItemsIndex ? serviceCharge : 0,
          receivedAmount: isNotebook ? 0 : Number(payment.amount),
          change: 0,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          items: index === paidItemsIndex ? paidItems : [],
        }
      }),
      ...currentPayments,
    ])

    paymentParts
      .filter((payment) => payment.method === 'caderneta')
      .forEach((payment) => {
        const now = new Date()
        const notebookCustomer = customersState.find((customer) => customer.id === Number(payment.customerId))
        setAccountsReceivableState((currentReceivables) => [
          {
            id: `${Date.now()}-${payment.customerId}`,
            code: `CR-${String(currentReceivables.length + 1).padStart(4, '0')}`,
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
          },
          ...currentReceivables,
        ])
      })

    setDeliveryState((currentOrders) =>
      currentOrders.map((order) =>
        order.id === deliveryId
          ? {
              ...order,
              paymentStatus: 'pago',
              paymentMethod: paymentParts.length > 1 ? 'dividido' : paymentParts[0]?.method ?? paymentMethod,
              paidAt: new Date().toISOString(),
            }
          : order,
      ),
    )
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
    usuarios: <UserPermissions currentUser={currentUser} />,
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
