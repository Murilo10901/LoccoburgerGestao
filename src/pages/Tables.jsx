import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { formatLocalDateLabel, getLocalDateKey, getTodayLocalDateKey } from '../lib/dateUtils.js'
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
const allCategoriesLabel = 'Todos'
const quickPaymentMethods = [
  { id: 'pix', label: 'Pix' },
  { id: 'debito', label: 'Debito' },
  { id: 'credito', label: 'Credito' },
  { id: 'dinheiro', label: 'Dinheiro' },
]
const tablesDraftStorageKey = 'loccoburger_admin_tables_draft_v1'

function loadTablesDraft() {
  if (typeof window === 'undefined') return {}

  try {
    const parsedDraft = JSON.parse(window.localStorage.getItem(tablesDraftStorageKey) ?? '{}')
    return parsedDraft && typeof parsedDraft === 'object' ? parsedDraft : {}
  } catch {
    return {}
  }
}

function saveTablesDraft(draft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(tablesDraftStorageKey, JSON.stringify(draft))
}

function CollapsibleSection({ badge, children, expandedSections, id, onToggle, title }) {
  const isExpanded = expandedSections[id]

  return (
    <section className={`collapsible-panel ${isExpanded ? 'expanded' : ''}`}>
      <button
        aria-expanded={isExpanded}
        className="collapsible-header"
        type="button"
        onClick={() => onToggle(id)}
      >
        <span>{title}</span>
        <strong>{badge}</strong>
        <b>{isExpanded ? 'Recolher' : 'Abrir'}</b>
      </button>
      {isExpanded && <div className="collapsible-content">{children}</div>}
    </section>
  )
}

function getModifierSummary(selectedModifiers) {
  const totalSelections = [
    selectedModifiers.meatPoint,
    ...selectedModifiers.removals,
    ...selectedModifiers.additions.map((addition) => addition.label),
  ].filter(Boolean)

  if (totalSelections.length === 0) return 'Sem personalizacao'
  if (totalSelections.length === 1) return totalSelections[0]
  return `${totalSelections.length} ajustes`
}

function getTableMainTab(table) {
  return table?.tabs?.find((tab) => String(tab.id).endsWith('-mesa')) ?? table?.tabs?.[0] ?? null
}

function getTableDisplayLabel(table) {
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

function getTableSupportLabel(table) {
  const mainTab = getTableMainTab(table)
  const customerName = String(table?.customerName ?? mainTab?.customerName ?? '').trim()
  const tableNumber = String(table?.tableNumber ?? mainTab?.tableNumber ?? '').trim()

  if (customerName && tableNumber) return customerName
  if (customerName) return 'Aguardando mesa'
  if (tableNumber) return 'Mesa aberta'
  if (table?.status === 'livre') return 'Livre'
  return table?.attendant && table.attendant !== '-' ? table.attendant : 'Sem atendimento'
}

function createEmptySelectedModifiers() {
  return { meatPoint: '', removals: [], additions: [] }
}

export function Tables({
  clientQrOrders = [],
  inventoryItems,
  kitchenOrders = [],
  onAddTableItem,
  onAddTableGuest,
  onApproveClientQrOrder,
  onCreateFixedQrTable,
  onCreateTableSession,
  onDeleteTable,
  onOpenTable,
  onRejectClientQrOrder,
  onReopenTableClose,
  onRemoveTableItem,
  onRequestTableClose,
  onQuickSale,
  onUpdateTableItemQuantity,
  payments = [],
  products,
  tables,
  technicalSheets,
}) {
  const savedDraft = useMemo(() => loadTablesDraft(), [])
  const initialOpenTableForm = {
    tableNumber: '',
    customerName: '',
    customerPhone: '',
    attendant: '',
    ...(savedDraft.openTableForm ?? {}),
  }
  const initialQuickSaleForm = {
    productId: products.find((product) => product.active)?.id ?? '',
    quantity: 1,
    paymentMethod: 'pix',
    customerName: '',
    ...(savedDraft.quickSaleForm ?? {}),
  }
  const initialOrderForm = {
    productId: products.find((product) => product.active)?.id ?? '',
    quantity: 1,
    notes: '',
    modifiers: emptyModifiers,
    ...(savedDraft.orderForm ?? {}),
    modifiers: savedDraft.orderForm?.modifiers ?? emptyModifiers,
  }
  const [selectedTableId, setSelectedTableId] = useState(tables.find((table) => table.status !== 'livre')?.id ?? tables[0]?.id ?? 1)
  const [openTableForm, setOpenTableForm] = useState(initialOpenTableForm)
  const [fixedTableNumber, setFixedTableNumber] = useState(savedDraft.fixedTableNumber ?? '')
  const [quickSaleForm, setQuickSaleForm] = useState(initialQuickSaleForm)
  const [orderForm, setOrderForm] = useState(initialOrderForm)
  const [selectedCategory, setSelectedCategory] = useState(savedDraft.selectedCategory ?? allCategoriesLabel)
  const [guestName, setGuestName] = useState(savedDraft.guestName ?? '')
  const [guestPhone, setGuestPhone] = useState(savedDraft.guestPhone ?? '')
  const [selectedTabId, setSelectedTabId] = useState('')
  const [historySearch, setHistorySearch] = useState(savedDraft.historySearch ?? '')
  const [historyDateFilter, setHistoryDateFilter] = useState(savedDraft.historyDateFilter ?? getTodayLocalDateKey())
  const [orderMessage, setOrderMessage] = useState(null)
  const [qrOrderMessage, setQrOrderMessage] = useState(null)
  const [quickSaleMessage, setQuickSaleMessage] = useState(null)
  const [quickSaleLoading, setQuickSaleLoading] = useState(false)
  const [pendingOverride, setPendingOverride] = useState(null)
  const [pendingSentOverride, setPendingSentOverride] = useState(null)
  const [draftItemsByTable, setDraftItemsByTable] = useState(savedDraft.draftItemsByTable ?? {})
  const [quickSelections, setQuickSelections] = useState(savedDraft.quickSelections ?? {})
  const [isSendingToKitchen, setIsSendingToKitchen] = useState(false)
  const [kitchenFeedback, setKitchenFeedback] = useState(null)
  const [expandedSections, setExpandedSections] = useState({
    open: true,
    fixedQr: false,
    quickSale: true,
    qr: true,
    tables: true,
    tabs: true,
    menu: true,
    draft: true,
    sent: false,
    history: false,
  })

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? tables[0],
    [selectedTableId, tables],
  )

  const activeProducts = products.filter((product) => product.active && (product.availableChannels?.qr ?? true))
  const productCategories = [
    allCategoriesLabel,
    ...Array.from(new Set(activeProducts.map((product) => product.category))).filter(Boolean),
  ]
  const filteredProducts = selectedCategory === allCategoriesLabel
    ? activeProducts
    : activeProducts.filter((product) => product.category === selectedCategory)
  const selectedProduct = activeProducts.find((product) => product.id === Number(orderForm.productId))
  const selectedQuickSaleProduct = activeProducts.find((product) => product.id === Number(quickSaleForm.productId))
  const selectedModifiers = getSelectedOrderModifiers(orderForm.modifiers)
  const modifierSummary = getModifierSummary(selectedModifiers)
  const modifiersUnitTotal = getModifiersUnitTotal(selectedModifiers)
  const orderUnitPrice = getOrderUnitPrice(selectedProduct, selectedModifiers)
  const orderPreviewTotal = orderUnitPrice * Number(orderForm.quantity || 0)
  const tableTabs = selectedTable?.tabs?.length
    ? selectedTable.tabs
    : [{ id: `${selectedTable?.id ?? 0}-mesa`, name: 'Mesa', orderItems: selectedTable?.orderItems ?? [] }]
  const selectedTab = tableTabs.find((tab) => tab.id === selectedTabId) ?? tableTabs[0]
  const selectedTabTotal = (selectedTab?.orderItems ?? []).reduce((total, item) => total + Number(item.total || 0), 0)
  const selectedDraftItems = draftItemsByTable[selectedTable?.id] ?? []
  const selectedTableQrNumber = String(selectedTable?.tableNumber ?? selectedTable?.id ?? '').trim()
  const selectedTableQrUrl = selectedTableQrNumber && typeof window !== 'undefined'
    ? `${window.location.origin}/mesa/${selectedTableQrNumber}`
    : ''
  const selectedDraftTotal = selectedDraftItems.reduce((total, item) => total + item.total, 0)
  const selectedQuickEntries = Object.entries(quickSelections)
    .map(([productId, quantity]) => ({
      product: activeProducts.find((product) => product.id === Number(productId)),
      quantity: Number(quantity || 0),
    }))
    .filter((entry) => entry.product && entry.quantity > 0)
  const selectedQuickTotal = selectedQuickEntries.reduce(
    (total, entry) => total + entry.product.price * entry.quantity,
    0,
  )
  const pendingQrOrders = clientQrOrders.filter((order) => order.status === 'novo')
  const processedQrOrders = clientQrOrders.filter((order) => order.status !== 'novo')
  const visibleProcessedQrOrders = processedQrOrders.slice(0, 30)
  const fixedQrTables = tables.filter((table) => table.fixedQr)
  const tableHistoryPayments = useMemo(() => {
    const normalizedSearch = historySearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    return payments
      .filter((payment) => {
        const source = String(payment.source ?? 'mesa')
        return source === 'mesa' || source === 'caderneta' || (!payment.source && payment.tableId)
      })
      .filter((payment) => {
        const dateKey = getLocalDateKey(payment.paidAtIso || payment.createdAtIso || payment.paidAt)
        const matchesDate = historyDateFilter === 'todos' || dateKey === historyDateFilter
        const itemsText = (payment.items ?? []).map((item) => `${item.quantity}x ${item.name}`).join(' ')
        const haystack = `${payment.tableId ?? ''} ${payment.tabName ?? ''} ${payment.customerName ?? ''} ${payment.method ?? ''} ${itemsText}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()

        return matchesDate && (!normalizedSearch || haystack.includes(normalizedSearch))
      })
      .slice(0, 200)
  }, [historyDateFilter, historySearch, payments])
  const tableHistoryDateOptions = useMemo(() => {
    return Array.from(new Set(payments
      .filter((payment) => {
        const source = String(payment.source ?? 'mesa')
        return source === 'mesa' || source === 'caderneta' || (!payment.source && payment.tableId)
      })
      .map((payment) => getLocalDateKey(payment.paidAtIso || payment.createdAtIso || payment.paidAt))
      .filter(Boolean)))
  }, [payments])
  const tabSummaries = tableTabs.map((tab) => ({
    ...tab,
    total: (tab.orderItems ?? []).reduce((sum, item) => sum + item.total, 0),
  }))
  const stockAvailability = checkProductStockAvailability({
    inventoryItems,
    productId: Number(orderForm.productId),
    products,
    quantity: Number(orderForm.quantity || 0),
    technicalSheets,
  })

  useEffect(() => {
    if (activeProducts.length === 0) return

    setOrderForm((currentForm) => {
      const currentProductStillActive = activeProducts.some((product) => product.id === Number(currentForm.productId))
      return currentProductStillActive ? currentForm : { ...currentForm, productId: activeProducts[0].id }
    })
    setQuickSaleForm((currentForm) => {
      const currentProductStillActive = activeProducts.some((product) => product.id === Number(currentForm.productId))
      return currentProductStillActive ? currentForm : { ...currentForm, productId: activeProducts[0].id }
    })
  }, [products])

  useEffect(() => {
    if (tables.some((table) => table.id === selectedTableId)) return
    setSelectedTableId(tables.find((table) => table.status !== 'livre')?.id ?? tables[0]?.id ?? null)
    setSelectedTabId('')
  }, [selectedTableId, tables])

  useEffect(() => {
    if (productCategories.includes(selectedCategory)) return
    setSelectedCategory(allCategoriesLabel)
  }, [productCategories, selectedCategory])

  useEffect(() => {
    if (!kitchenFeedback || kitchenFeedback.type === 'loading') return undefined

    const timer = window.setTimeout(() => {
      setKitchenFeedback(null)
    }, 4200)

    return () => window.clearTimeout(timer)
  }, [kitchenFeedback])

  useEffect(() => {
    saveTablesDraft({
      openTableForm,
      fixedTableNumber,
      quickSaleForm,
      orderForm,
      selectedCategory,
      guestName,
      guestPhone,
      historySearch,
      historyDateFilter,
      draftItemsByTable,
      quickSelections,
    })
  }, [
    openTableForm,
    fixedTableNumber,
    quickSaleForm,
    orderForm,
    selectedCategory,
    guestName,
    guestPhone,
    historySearch,
    historyDateFilter,
    draftItemsByTable,
    quickSelections,
  ])

  function getKitchenCustomerLabel() {
    const tabName = String(selectedTab?.name ?? '').trim()
    const supportName = getTableSupportLabel(selectedTable)

    if (tabName && tabName.toLowerCase() !== 'mesa') return tabName
    if (supportName && !['livre', 'mesa aberta', 'sem atendimento'].includes(supportName.toLowerCase())) return supportName
    return getTableDisplayLabel(selectedTable)
  }

  function toggleSection(sectionId) {
    setExpandedSections((currentSections) => ({
      ...currentSections,
      [sectionId]: !currentSections[sectionId],
    }))
  }

  function addDraftItem(product, quantity, options = {}) {
    if (!selectedTable || !product || quantity <= 0) {
      setOrderMessage({ ok: false, message: 'Escolha um produto e uma quantidade valida.' })
      return false
    }

    const itemModifiers = options.modifiers ?? createEmptySelectedModifiers()
    const unitPrice = Number(options.unitPrice ?? product.price)
    const payload = {
      id: `${Date.now()}-${product.id}-${selectedTab.id}-${Math.random().toString(16).slice(2, 8)}`,
      tableId: selectedTable.id,
      productId: product.id,
      name: product.name,
      quantity,
      tabId: selectedTab.id,
      tabName: selectedTab.name,
      notes: options.notes ?? '',
      manualNotes: options.manualNotes ?? '',
      modifiers: itemModifiers,
      unitPrice,
      total: unitPrice * quantity,
    }

    setDraftItemsByTable((currentDrafts) => ({
      ...currentDrafts,
      [selectedTable.id]: [...(currentDrafts[selectedTable.id] ?? []), payload],
    }))
    return true
  }

  function handleAddItem(event) {
    event.preventDefault()
    const quantity = Number(orderForm.quantity)
    const added = addDraftItem(selectedProduct, quantity, {
      modifiers: selectedModifiers,
      notes: buildOrderNotes(selectedModifiers, orderForm.notes),
      manualNotes: orderForm.notes.trim(),
      unitPrice: orderUnitPrice,
    })

    if (!added) return

    setOrderForm((currentForm) => ({ ...currentForm, notes: '', quantity: 1, modifiers: emptyModifiers }))
    setPendingOverride(null)
    setOrderMessage({ ok: true, message: 'Item personalizado adicionado para conferencia.' })
  }

  function handleOpenTableSession(event) {
    event.preventDefault()

    const table = onCreateTableSession?.(openTableForm)
    if (!table) {
      setOrderMessage({ ok: false, message: 'Informe o nome do cliente ou o numero/referencia da mesa.' })
      return
    }

    setSelectedTableId(table.id)
    setSelectedTabId(`${table.id}-mesa`)
    setOpenTableForm({ tableNumber: '', customerName: '', customerPhone: '', attendant: '' })
    setExpandedSections((currentSections) => ({
      ...currentSections,
      tables: true,
      tabs: true,
      menu: true,
      draft: true,
    }))
    setOrderMessage({ ok: true, message: `${getTableDisplayLabel(table)} aberta para atendimento.` })
  }

  function handleOpenSelectedTable() {
    if (!selectedTable) return
    onOpenTable(selectedTable.id)
    setOrderMessage({ ok: true, message: `${getTableDisplayLabel(selectedTable)} aberta.` })
  }

  function handleRequestSelectedTableClose() {
    if (!selectedTable) return
    const result = onRequestTableClose?.(selectedTable.id, { tabId: 'all' })
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel solicitar fechamento desta mesa.' })
  }

  function handleReopenSelectedTableClose() {
    if (!selectedTable) return
    const result = onReopenTableClose?.(selectedTable.id, { tabId: 'all' })
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel reabrir esta mesa.' })
  }

  function handleRequestSelectedTabClose() {
    if (!selectedTable || !selectedTab) return

    const result = onRequestTableClose?.(selectedTable.id, {
      customerName: selectedTab.customerName ?? selectedTab.name,
      sessionId: selectedTab.sessionId,
      tabId: selectedTab.id,
    })
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel solicitar fechamento desta comanda.' })
  }

  function handleReopenSelectedTabClose() {
    if (!selectedTable || !selectedTab) return

    const result = onReopenTableClose?.(selectedTable.id, {
      tabId: selectedTab.id,
    })
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel reabrir esta comanda.' })
  }

  function handleCreateFixedQrTable(event) {
    event.preventDefault()

    const result = onCreateFixedQrTable?.(fixedTableNumber)
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel criar esta mesa fixa.' })

    if (result?.ok) {
      setFixedTableNumber('')
      if (result.table?.id) setSelectedTableId(result.table.id)
    }
  }

  function handleDeleteSelectedTable() {
    if (!selectedTable || !onDeleteTable) return
    if (!window.confirm(`Excluir ${getTableDisplayLabel(selectedTable)} da lista de mesas/comandas?`)) return

    const result = onDeleteTable(selectedTable.id)
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel excluir esta mesa.' })
  }

  async function handleQuickSaleSubmit(event) {
    event.preventDefault()
    if (quickSaleLoading) return

    const quickSalePayload = {
      ...quickSaleForm,
      productId: Number(quickSaleForm.productId),
      quantity: Number(quickSaleForm.quantity),
    }
    setQuickSaleLoading(true)
    setKitchenFeedback({
      type: 'loading',
      scope: 'Caixa',
      title: 'Registrando venda rapida...',
      message: 'Salvando no caixa, atualizando estoque e financeiro.',
    })

    let result = null
    try {
      ;[result] = await Promise.all([
        Promise.resolve(onQuickSale?.(quickSalePayload)),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
    } catch (error) {
      result = { ok: false, message: error?.message ?? 'Nao foi possivel registrar a venda rapida.' }
    }

    setQuickSaleMessage(result ?? { ok: false, message: 'Nao foi possivel registrar a venda rapida.' })
    setQuickSaleLoading(false)
    setKitchenFeedback({
      type: result?.ok ? 'success' : 'error',
      title: result?.ok ? 'Venda registrada!' : 'Venda nao registrada',
      message: result?.message ?? 'Nao foi possivel registrar a venda rapida.',
    })

    if (result?.ok) {
      setQuickSaleForm((currentForm) => ({
        ...currentForm,
        quantity: 1,
        customerName: '',
      }))
    }
  }

  async function handleApproveQrOrder(orderId, options = {}) {
    setKitchenFeedback({
      type: 'loading',
      scope: 'QR Code',
      title: 'Processando pedido QR...',
      message: 'Salvando mesa, cozinha, estoque e atendimento.',
    })

    try {
      const [result] = await Promise.all([
        Promise.resolve(onApproveClientQrOrder?.(orderId, options)),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      setQrOrderMessage(result ?? { ok: false, message: 'Nao foi possivel aprovar o pedido QR.' })
      setKitchenFeedback({
        type: result?.ok ? 'success' : 'error',
        title: result?.ok ? 'Pedido QR processado!' : 'Pedido QR nao processado',
        message: result?.message ?? 'Nao foi possivel aprovar o pedido QR.',
      })
    } catch (error) {
      const message = error?.message ?? 'Nao foi possivel aprovar o pedido QR.'
      setQrOrderMessage({ ok: false, message })
      setKitchenFeedback({
        type: 'error',
        title: 'Pedido QR nao processado',
        message,
      })
    }
  }

  function handleRejectQrOrder(orderId) {
    const result = onRejectClientQrOrder?.(orderId)
    setQrOrderMessage(result ?? { ok: false, message: 'Nao foi possivel recusar o pedido QR.' })
  }

  function toggleQuickProduct(product) {
    setOrderForm((currentForm) => ({ ...currentForm, productId: product.id }))
    setQuickSelections((currentSelections) => {
      const nextSelections = { ...currentSelections }
      if (nextSelections[product.id]) {
        delete nextSelections[product.id]
      } else {
        nextSelections[product.id] = 1
      }
      return nextSelections
    })
  }

  function updateQuickSelectionQuantity(product, nextQuantity) {
    const quantity = Number(nextQuantity)
    setOrderForm((currentForm) => ({ ...currentForm, productId: product.id }))
    setQuickSelections((currentSelections) => {
      const nextSelections = { ...currentSelections }
      if (quantity <= 0) {
        delete nextSelections[product.id]
      } else {
        nextSelections[product.id] = quantity
      }
      return nextSelections
    })
  }

  function addSelectedProductsToDraft() {
    if (selectedQuickEntries.length === 0) {
      setOrderMessage({ ok: false, message: 'Marque ao menos um produto do cardapio rapido.' })
      return
    }

    let addedCount = 0
    selectedQuickEntries.forEach(({ product, quantity }) => {
      const isPersonalizedProduct = Number(orderForm.productId) === product.id
      const personalizedNotes = isPersonalizedProduct ? buildOrderNotes(selectedModifiers, orderForm.notes) : ''
      const personalizedManualNotes = isPersonalizedProduct ? orderForm.notes.trim() : ''
      const personalizedModifiers = isPersonalizedProduct ? selectedModifiers : createEmptySelectedModifiers()
      const personalizedUnitPrice = isPersonalizedProduct ? getOrderUnitPrice(product, selectedModifiers) : product.price

      if (addDraftItem(product, quantity, {
        modifiers: personalizedModifiers,
        notes: personalizedNotes,
        manualNotes: personalizedManualNotes,
        unitPrice: personalizedUnitPrice,
      })) {
        addedCount += 1
      }
    })

    setQuickSelections({})
    setOrderForm((currentForm) => ({ ...currentForm, notes: '', quantity: 1, modifiers: emptyModifiers }))
    setPendingOverride(null)
    setOrderMessage({
      ok: true,
      message: `${addedCount} produto(s) adicionados para conferencia. Confira antes de enviar para a cozinha.`,
    })
  }

  function removeDraftItem(itemId) {
    setDraftItemsByTable((currentDrafts) => ({
      ...currentDrafts,
      [selectedTable.id]: (currentDrafts[selectedTable.id] ?? []).filter((item) => item.id !== itemId),
    }))
    setPendingOverride(null)
    setOrderMessage({ ok: true, message: 'Item removido da conferencia.' })
  }

  function updateDraftItemQuantity(itemId, nextQuantity) {
    const quantity = Number(nextQuantity)

    if (quantity <= 0) {
      removeDraftItem(itemId)
      return
    }

    setDraftItemsByTable((currentDrafts) => ({
      ...currentDrafts,
      [selectedTable.id]: (currentDrafts[selectedTable.id] ?? []).map((item) =>
        item.id === itemId
          ? { ...item, quantity, total: item.unitPrice * quantity }
          : item,
      ),
    }))
    setPendingOverride(null)
  }

  function clearSentDraftItems(tableId, sentItemIds) {
    setDraftItemsByTable((currentDrafts) => ({
      ...currentDrafts,
      [tableId]: (currentDrafts[tableId] ?? []).filter((item) => !sentItemIds.includes(item.id)),
    }))
  }

  async function sendDraftItems(forceStock = false, itemsToSend = selectedDraftItems) {
    if (itemsToSend.length === 0) {
      setOrderMessage({ ok: false, message: 'Nao ha itens em conferencia para enviar.' })
      return
    }

    if (isSendingToKitchen) return

    const customerLabel = getKitchenCustomerLabel()
    setIsSendingToKitchen(true)
    setKitchenFeedback({
      type: 'loading',
      title: 'Enviando para a cozinha...',
      message: `Preparando pedido de ${customerLabel}. Aguarde um instante.`,
    })

    await new Promise((resolve) => window.setTimeout(resolve, 450))

    const sentItemIds = []

    for (const item of itemsToSend) {
      const result = await Promise.resolve(onAddTableItem(item.tableId, item.productId, item.quantity, item.tabId, item.notes, {
        forceStock,
        manualNotes: item.manualNotes,
        modifiers: item.modifiers,
        unitPrice: item.unitPrice,
      }))

      if (!result?.ok) {
        if (sentItemIds.length > 0) clearSentDraftItems(item.tableId, sentItemIds)

        const remainingItems = itemsToSend.filter((draftItem) => !sentItemIds.includes(draftItem.id))
        setPendingOverride(result?.needsOverride ? { items: remainingItems } : null)
        setOrderMessage(result)
        setIsSendingToKitchen(false)
        setKitchenFeedback({
          type: 'error',
          title: 'Pedido nao enviado',
          message: result?.message ?? 'Nao foi possivel enviar o pedido para a cozinha.',
        })
        return
      }

      sentItemIds.push(item.id)
    }

    clearSentDraftItems(selectedTable.id, sentItemIds)
    setPendingOverride(null)

    const successMessage = `Pedido de ${customerLabel} enviado para a cozinha.`
    setOrderMessage({
      ok: true,
      message: `${sentItemIds.length} item(ns) enviados para a cozinha e lancados na mesa.`,
    })
    setIsSendingToKitchen(false)
    setKitchenFeedback({
      type: 'success',
      title: 'Pedido enviado!',
      message: successMessage,
    })
  }

  function handleForceAddItem() {
    if (!pendingOverride?.items?.length) return
    sendDraftItems(true, pendingOverride.items)
  }

  function handleAddGuest(event) {
    event.preventDefault()

    const newTab = onAddTableGuest(selectedTable.id, { name: guestName, phone: guestPhone })
    if (!newTab) return

    setSelectedTabId(newTab.id)
    setGuestName('')
    setGuestPhone('')
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

  function getKitchenTicketForItem(item) {
    return kitchenOrders.find((order) => order.id === item.kitchenTicketId) ??
      kitchenOrders.find((order) =>
        (order.source === `Mesa ${selectedTable.id}` || order.source === getTableDisplayLabel(selectedTable)) &&
        String(order.item ?? '').includes(item.name),
      )
  }

  function canEditSentItem(item) {
    const kitchenTicket = getKitchenTicketForItem(item)
    return !kitchenTicket || kitchenTicket.status !== 'finalizado'
  }

  async function handleRemoveSentItem(item) {
    if (!window.confirm(`Excluir ${item.quantity}x ${item.name} da comanda? O estoque e a cozinha serao recalculados.`)) return

    setKitchenFeedback({
      type: 'loading',
      scope: 'Mesa',
      title: 'Excluindo item...',
      message: 'Atualizando comanda, cozinha e estoque.',
    })

    let result = null
    try {
      ;[result] = await Promise.all([
        Promise.resolve(onRemoveTableItem?.(selectedTable.id, item.id)),
        new Promise((resolve) => window.setTimeout(resolve, 350)),
      ])
    } catch (error) {
      result = { ok: false, message: error?.message ?? 'Nao foi possivel excluir este item.' }
    }

    setPendingSentOverride(null)
    setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel excluir este item.' })
    setKitchenFeedback({
      type: result?.ok ? 'success' : 'error',
      title: result?.ok ? 'Item excluido' : 'Item nao excluido',
      message: result?.message ?? 'Nao foi possivel excluir este item.',
    })
  }

  async function handleUpdateSentItemQuantity(item, nextQuantity, forceStock = false) {
    setKitchenFeedback({
      type: 'loading',
      scope: 'Mesa',
      title: 'Atualizando item...',
      message: 'Salvando quantidade, cozinha e estoque.',
    })

    let result = null
    try {
      ;[result] = await Promise.all([
        Promise.resolve(onUpdateTableItemQuantity?.(selectedTable.id, item.id, nextQuantity, { forceStock })),
        new Promise((resolve) => window.setTimeout(resolve, 350)),
      ])
    } catch (error) {
      result = { ok: false, message: error?.message ?? 'Nao foi possivel alterar este item.' }
    }

    if (!result?.ok) {
      setPendingSentOverride(result?.needsOverride ? { itemId: item.id, nextQuantity } : null)
      setOrderMessage(result ?? { ok: false, message: 'Nao foi possivel alterar este item.' })
      setKitchenFeedback({
        type: 'error',
        title: 'Item nao atualizado',
        message: result?.message ?? 'Nao foi possivel alterar este item.',
      })
      return
    }

    setPendingSentOverride(null)
    setOrderMessage(result)
    setKitchenFeedback({
      type: 'success',
      title: 'Item atualizado',
      message: result.message ?? 'Comanda atualizada.',
    })
  }

  function handleForceSentQuantity() {
    if (!pendingSentOverride) return
    const item = selectedTable.orderItems.find((orderItem) => orderItem.id === pendingSentOverride.itemId)
    if (!item) return
    handleUpdateSentItemQuantity(item, pendingSentOverride.nextQuantity, true)
  }

  if (!selectedTable) {
    return <p className="empty-state">Nenhuma mesa cadastrada.</p>
  }

  return (
    <div className="tables-workspace waiter-workspace">
      {kitchenFeedback?.type === 'loading' && (
        <div className="kitchen-feedback-overlay" role="status" aria-live="polite">
          <div className="kitchen-feedback-modal">
            <span className="kitchen-feedback-spinner" aria-hidden="true" />
            <p className="eyebrow">{kitchenFeedback.scope ?? 'Cozinha'}</p>
            <h3>{kitchenFeedback.title}</h3>
            <p>{kitchenFeedback.message}</p>
          </div>
        </div>
      )}

      {kitchenFeedback && kitchenFeedback.type !== 'loading' && (
        <div className={`kitchen-feedback-toast ${kitchenFeedback.type}`} role="status" aria-live="polite">
          <span aria-hidden="true">{kitchenFeedback.type === 'success' ? '✓' : '!'}</span>
          <div>
            <strong>{kitchenFeedback.title}</strong>
            <small>{kitchenFeedback.message}</small>
          </div>
          <button type="button" onClick={() => setKitchenFeedback(null)}>×</button>
        </div>
      )}
      <section className="table-board-panel">
        <CollapsibleSection
          badge="Nome ou mesa"
          expandedSections={expandedSections}
          id="open"
          title="Abrir atendimento"
          onToggle={toggleSection}
        >
          <form className="open-table-form" onSubmit={handleOpenTableSession}>
            <label>
              Numero ou referencia
              <input
                value={openTableForm.tableNumber}
                onChange={(event) => setOpenTableForm((currentForm) => ({ ...currentForm, tableNumber: event.target.value }))}
                placeholder="Ex.: 12, Balcao, Fila"
              />
            </label>
            <label>
              Nome do cliente
              <input
                value={openTableForm.customerName}
                onChange={(event) => setOpenTableForm((currentForm) => ({ ...currentForm, customerName: event.target.value }))}
                placeholder="Ex.: Rogerio"
              />
            </label>
            <label>
              Telefone
              <input
                inputMode="tel"
                value={openTableForm.customerPhone}
                onChange={(event) => setOpenTableForm((currentForm) => ({ ...currentForm, customerPhone: event.target.value }))}
                placeholder="Ex.: (11) 99999-9999"
              />
            </label>
            <label>
              Garcom
              <input
                value={openTableForm.attendant}
                onChange={(event) => setOpenTableForm((currentForm) => ({ ...currentForm, attendant: event.target.value }))}
                placeholder="Opcional"
              />
            </label>
            <button className="primary-button" type="submit">Abrir comanda</button>
          </form>
        </CollapsibleSection>

        <CollapsibleSection
          badge={`${fixedQrTables.length} QR`}
          expandedSections={expandedSections}
          id="fixedQr"
          title="Mesa fixa / QR Code"
          onToggle={toggleSection}
        >
          <form className="fixed-qr-form" onSubmit={handleCreateFixedQrTable}>
            <label>
              Nova mesa fixa
              <input
                value={fixedTableNumber}
                onChange={(event) => setFixedTableNumber(event.target.value)}
                placeholder="Ex.: 5"
              />
            </label>
            <button className="secondary-button" type="submit">Criar QR da mesa</button>
          </form>
          <div className="fixed-qr-list">
            {fixedQrTables.map((table) => {
              const tableNumber = String(table.tableNumber ?? table.id).trim()
              const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/mesa/${tableNumber}` : `/mesa/${tableNumber}`

              return (
                <button
                  className={`fixed-qr-row ${selectedTable?.id === table.id ? 'active' : ''}`}
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                >
                  <span>Mesa {tableNumber}</span>
                  <small>{qrUrl}</small>
                  <StatusBadge status={table.status} />
                </button>
              )
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          badge="Sem mesa"
          expandedSections={expandedSections}
          id="quickSale"
          title="Venda rapida / balcao"
          onToggle={toggleSection}
        >
          <form className="quick-sale-form" onSubmit={handleQuickSaleSubmit}>
            <label>
              Produto
              <select
                value={quickSaleForm.productId}
                onChange={(event) => setQuickSaleForm((form) => ({ ...form, productId: Number(event.target.value) }))}
              >
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {currency.format(product.price)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Quantidade
                <input
                  inputMode="numeric"
                  min="1"
                  type="number"
                  value={quickSaleForm.quantity}
                  onChange={(event) => setQuickSaleForm((form) => ({ ...form, quantity: event.target.value }))}
                />
              </label>
              <label>
                Pagamento
                <select
                  value={quickSaleForm.paymentMethod}
                  onChange={(event) => setQuickSaleForm((form) => ({ ...form, paymentMethod: event.target.value }))}
                >
                  {quickPaymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>{method.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Nome opcional
              <input
                value={quickSaleForm.customerName}
                onChange={(event) => setQuickSaleForm((form) => ({ ...form, customerName: event.target.value }))}
                placeholder="Ex.: Balcao, retirada, cliente"
              />
            </label>
            {selectedQuickSaleProduct && (
              <div className="form-hint">
                Total rapido: {currency.format(selectedQuickSaleProduct.price * Number(quickSaleForm.quantity || 0))}. Ideal para agua, refrigerante ou venda avulsa.
              </div>
            )}
            {quickSaleMessage && (
              <div className={quickSaleMessage.ok ? 'form-hint' : 'form-alert'}>{quickSaleMessage.message}</div>
            )}
            <button className="primary-button" disabled={quickSaleLoading} type="submit">
              {quickSaleLoading ? 'Registrando no sistema...' : 'Registrar venda rapida'}
            </button>
          </form>
        </CollapsibleSection>

        <CollapsibleSection
          badge={`${pendingQrOrders.length} novo(s)`}
          expandedSections={expandedSections}
          id="qr"
          title="Pedidos QR aguardando"
          onToggle={toggleSection}
        >
          <div className="qr-orders-panel">
            {qrOrderMessage && (
              <div className={qrOrderMessage.ok ? 'form-hint' : 'form-alert'}>{qrOrderMessage.message}</div>
            )}

            {pendingQrOrders.length === 0 ? (
              <p className="empty-state">Nenhum pedido de cliente aguardando aprovacao.</p>
            ) : pendingQrOrders.map((order) => (
              <article className="qr-order-card" key={order.id}>
                <div className="qr-order-card-top">
                  <div>
                    <span>{order.type === 'fechamento' ? 'Fechamento' : 'Pedido'}</span>
                    <strong>Mesa {order.tableNumber} - {order.customerName}</strong>
                    <small>{order.phone}</small>
                  </div>
                  <b>{currency.format(order.total || 0)}</b>
                </div>

                {order.items?.length > 0 && (
                  <div className="qr-order-items">
                    {order.items.map((item) => (
                      <span key={item.id}>{item.quantity}x {item.name}</span>
                    ))}
                  </div>
                )}
                {order.notes && <small className="qr-order-note">{order.notes}</small>}

                <div className="row-actions">
                  <button className="primary-button" type="button" onClick={() => handleApproveQrOrder(order.id)}>
                    {order.type === 'fechamento' ? 'Enviar para fechamento' : 'Aprovar e enviar'}
                  </button>
                  {order.type !== 'fechamento' && (
                    <button className="ghost-button" type="button" onClick={() => handleApproveQrOrder(order.id, { forceStock: true })}>
                      Enviar sem estoque
                    </button>
                  )}
                  <button className="ghost-button danger-button" type="button" onClick={() => handleRejectQrOrder(order.id)}>
                    Recusar
                  </button>
                </div>
              </article>
            ))}

            {processedQrOrders.length > 0 && (
              <details className="qr-processed-list">
                <summary>
                  <strong>Ultimos processados</strong>
                  <span>{processedQrOrders.length} registro(s)</span>
                </summary>
                <div className="qr-processed-scroll">
                  {visibleProcessedQrOrders.map((order) => (
                    <span key={order.id}>
                      Mesa {order.tableNumber} - {order.customerName}: {order.status}
                    </span>
                  ))}
                </div>
                {processedQrOrders.length > visibleProcessedQrOrders.length && (
                  <small>Mostrando os 30 mais recentes para manter a tela leve.</small>
                )}
              </details>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          badge={`${tables.length} registros`}
          expandedSections={expandedSections}
          id="tables"
          title="Mesas e comandas"
          onToggle={toggleSection}
        >
          <div className="table-board compact-table-board">
            {tables.map((table) => (
              <button
                className={`table-pill table-${table.status} ${selectedTable.id === table.id ? 'selected' : ''}`}
                key={table.id}
                type="button"
                onClick={() => setSelectedTableId(table.id)}
              >
                <span>{getTableDisplayLabel(table)}</span>
                <StatusBadge status={table.status} />
                <strong>{currency.format(table.total)}</strong>
                <small>{getTableSupportLabel(table)} - {table.guests || 0} cliente(s)</small>
              </button>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          badge={`${tableHistoryPayments.length} registro(s)`}
          expandedSections={expandedSections}
          id="history"
          title="Historico de mesas/comandas"
          onToggle={toggleSection}
        >
          <div className="table-history-toolbar">
            <label>
              Buscar
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Mesa, cliente, item ou pagamento"
              />
            </label>
            <label>
              Dia
              <select value={historyDateFilter} onChange={(event) => setHistoryDateFilter(event.target.value)}>
                <option value="todos">Todos os dias</option>
                <option value={getTodayLocalDateKey()}>Hoje</option>
                {tableHistoryDateOptions
                  .filter((dateKey) => dateKey !== getTodayLocalDateKey())
                  .map((dateKey) => (
                    <option key={dateKey} value={dateKey}>{formatLocalDateLabel(dateKey)}</option>
                  ))}
              </select>
            </label>
          </div>

          <div className="responsive-table table-history-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Mesa/comanda</th>
                  <th>Itens</th>
                  <th>Forma</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {tableHistoryPayments.length === 0 ? (
                  <tr>
                    <td colSpan="5">Nenhuma mesa/comanda finalizada nos filtros atuais.</td>
                  </tr>
                ) : tableHistoryPayments.map((payment) => {
                  const dateKey = getLocalDateKey(payment.paidAtIso || payment.createdAtIso || payment.paidAt)
                  const itemsSummary = (payment.items ?? [])
                    .map((item) => `${item.quantity}x ${item.name}`)
                    .join(', ')

                  return (
                    <tr key={payment.id}>
                      <td>
                        <strong>{formatLocalDateLabel(dateKey)}</strong>
                        <span className="muted">{payment.time ?? ''}</span>
                      </td>
                      <td>
                        <strong>{payment.tableId ? `Mesa ${payment.tableId}` : 'Comanda'}</strong>
                        <span className="muted">{payment.tabName ?? payment.customerName ?? 'Mesa inteira'}</span>
                      </td>
                      <td>{itemsSummary || 'Sem itens detalhados'}</td>
                      <td>{payment.method ?? '-'}</td>
                      <td>{currency.format(Number(payment.amount ?? payment.netAmount ?? 0))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {tableHistoryPayments.length >= 200 && (
            <small className="muted">Mostrando os 200 registros mais recentes do filtro para manter a tela leve.</small>
          )}
        </CollapsibleSection>
      </section>

      <Card className="order-panel waiter-order-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Atendimento</p>
            <h2>{getTableDisplayLabel(selectedTable)}</h2>
            <small>{getTableSupportLabel(selectedTable)}</small>
            {selectedTableQrUrl && (
              <a className="table-qr-link" href={selectedTableQrUrl} target="_blank" rel="noreferrer">
                QR da mesa: {selectedTableQrUrl}
              </a>
            )}
          </div>
          <StatusBadge status={selectedTable.status} />
        </div>

        <div className="order-total compact-order-total">
          <span>Total da conta</span>
          <strong>{currency.format(selectedTable.total)}</strong>
        </div>

        {orderMessage && (
          <div className={orderMessage.ok ? 'form-hint' : 'form-alert'}>{orderMessage.message}</div>
        )}

        <div className="order-actions waiter-actions">
          <button className="secondary-button" type="button" onClick={handleOpenSelectedTable}>
            Abrir selecionada
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={
              selectedTable.status === 'fechamento' && Number(selectedTable.total || 0) > 0
                ? handleReopenSelectedTableClose
                : handleRequestSelectedTableClose
            }
          >
            {selectedTable.status === 'fechamento' && Number(selectedTable.total || 0) > 0
              ? 'Reabrir conta'
              : Number(selectedTable.total || 0) <= 0
                ? 'Liberar sem consumo'
                : 'Solicitar fechamento'}
          </button>
          <button className="ghost-button danger-button" type="button" onClick={handleDeleteSelectedTable}>
            Excluir mesa/comanda
          </button>
        </div>

        <CollapsibleSection
          badge={`${tabSummaries.length} comandas`}
          expandedSections={expandedSections}
          id="tabs"
          title="1. Pessoa ou comanda"
          onToggle={toggleSection}
        >
          <div className="table-tab-list">
            {tabSummaries.map((tab) => (
              <button
                className={`table-tab-button ${selectedTab.id === tab.id ? 'active' : ''}`}
                key={tab.id}
                type="button"
                onClick={() => setSelectedTabId(tab.id)}
              >
                <span>{tab.name}</span>
                <strong>{currency.format(tab.total)}</strong>
              </button>
            ))}
          </div>
          <div className="selected-tab-action-card">
            <div>
              <span>Comanda selecionada</span>
              <strong>{selectedTab?.name ?? 'Mesa'}</strong>
              <small>{currency.format(selectedTabTotal)} em aberto nesta pessoa/comanda.</small>
            </div>
            <button
              className="ghost-button"
              disabled={selectedTabTotal <= 0}
              type="button"
              onClick={selectedTab?.status === 'fechamento' ? handleReopenSelectedTabClose : handleRequestSelectedTabClose}
            >
              {selectedTab?.status === 'fechamento'
                ? `Reabrir comanda de ${selectedTab?.name ?? 'Mesa'}`
                : `Fechar comanda de ${selectedTab?.name ?? 'Mesa'}`}
            </button>
          </div>
          <form className="guest-form" onSubmit={handleAddGuest}>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Nome da pessoa"
            />
            <input
              inputMode="tel"
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              placeholder="Telefone opcional"
            />
            <button className="secondary-button" type="submit">Adicionar pessoa</button>
          </form>
        </CollapsibleSection>

        <CollapsibleSection
          badge={selectedQuickEntries.length ? `${selectedQuickEntries.length} selecionado(s)` : `${activeProducts.length} produtos`}
          expandedSections={expandedSections}
          id="menu"
          title="2. Marcar itens"
          onToggle={toggleSection}
        >
          <form className="entry-form compact-entry-form waiter-order-form" onSubmit={handleAddItem}>
            <label>
              Comanda destino
              <select value={selectedTab.id} onChange={(event) => setSelectedTabId(event.target.value)}>
                {tableTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>{tab.name}</option>
                ))}
              </select>
            </label>

            <details className="dropdown-panel menu-dropdown" open>
              <summary>
                <span>Cardapio rapido</span>
                <b>{selectedQuickEntries.length ? currency.format(selectedQuickTotal) : selectedCategory}</b>
              </summary>
              <div className="menu-picker">
                <div className="segmented-control menu-category-tabs" aria-label="Categorias do cardapio">
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
                <div className="menu-product-grid quick-menu-grid">
                  {filteredProducts.map((product) => {
                    const selectedQuantity = Number(quickSelections[product.id] || 0)
                    const isChecked = selectedQuantity > 0
                    const isFocused = Number(orderForm.productId) === product.id

                    return (
                      <div
                        className={`menu-product-button quick-product-card ${isChecked ? 'checked' : ''} ${isFocused ? 'active' : ''}`}
                        key={product.id}
                      >
                        <button
                          className="quick-product-main"
                          type="button"
                          onClick={() => toggleQuickProduct(product)}
                        >
                          <span className="quick-product-category">{product.category}</span>
                          <strong>{product.name}</strong>
                          <b>{currency.format(product.price)}</b>
                          {isChecked && <em>{selectedQuantity} selecionado(s)</em>}
                        </button>

                        <div className="quick-product-actions">
                          <button
                            className={`quick-select-button ${isChecked ? 'active' : ''}`}
                            type="button"
                            onClick={() => toggleQuickProduct(product)}
                          >
                            {isChecked ? 'Selecionado' : 'Selecionar'}
                          </button>

                          <div className="quantity-stepper compact-stepper" aria-label={`Quantidade de ${product.name}`}>
                            <button
                              disabled={selectedQuantity <= 0}
                              type="button"
                              onClick={() => updateQuickSelectionQuantity(product, selectedQuantity - 1)}
                            >
                              -
                            </button>
                            <strong>{selectedQuantity}</strong>
                            <button
                              type="button"
                              onClick={() => updateQuickSelectionQuantity(product, selectedQuantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </details>

            <div className="quick-order-footer">
              <div>
                <span>{selectedQuickEntries.length} produto(s) marcados</span>
                <strong>{currency.format(selectedQuickTotal)}</strong>
              </div>
              <button className="primary-button" disabled={selectedQuickEntries.length === 0} type="button" onClick={addSelectedProductsToDraft}>
                Adicionar marcados
              </button>
            </div>

            <details className="dropdown-panel modifier-dropdown">
              <summary>
                <span>Personalizar item destacado</span>
                <b>{selectedProduct ? `${selectedProduct.name} - ${modifierSummary}` : 'Escolha um item'}</b>
              </summary>
              <div className="modifier-panel compact-modifier-panel">
                <label>
                  Produto destacado
                  <select
                    value={orderForm.productId}
                    onChange={(event) => setOrderForm((currentForm) => ({ ...currentForm, productId: Number(event.target.value) }))}
                  >
                    {activeProducts.length === 0 ? (
                      <option value="">Nenhum produto ativo</option>
                    ) : activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {currency.format(product.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade do item personalizado
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={orderForm.quantity}
                    onChange={(event) => setOrderForm((currentForm) => ({ ...currentForm, quantity: event.target.value }))}
                  />
                </label>
                <label>
                  Ponto da carne
                  <select
                    value={orderForm.modifiers.meatPoint}
                    onChange={(event) =>
                      setOrderForm((currentForm) => ({
                        ...currentForm,
                        modifiers: { ...currentForm.modifiers, meatPoint: event.target.value },
                      }))
                    }
                  >
                    <option value="">Sem ponto definido</option>
                    {meatPointOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <div className="modifier-checklist">
                  <span>Remover</span>
                  {removalOptions.map((option) => (
                    <label key={option}>
                      <input
                        checked={orderForm.modifiers.removals.includes(option)}
                        type="checkbox"
                        onChange={() => toggleRemoval(option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
                <div className="modifier-checklist">
                  <span>Adicionais</span>
                  {additionOptions.map((option) => (
                    <label key={option.id}>
                      <input
                        checked={orderForm.modifiers.additions.includes(option.id)}
                        type="checkbox"
                        onChange={() => toggleAddition(option.id)}
                      />
                      {option.label} +{currency.format(option.price)}
                    </label>
                  ))}
                </div>
                <label>
                  Observacoes do item
                  <textarea
                    rows="3"
                    value={orderForm.notes}
                    onChange={(event) => setOrderForm((currentForm) => ({ ...currentForm, notes: event.target.value }))}
                    placeholder="Ex.: carne ao ponto, sem cebola, sem maionese"
                  />
                </label>
                <div className={stockAvailability.available ? 'form-hint' : 'form-alert'}>
                  {stockAvailability.message}
                </div>
                <div className="form-hint">
                  Unitario: {currency.format(orderUnitPrice)}
                  {modifiersUnitTotal > 0 ? ` (${currency.format(modifiersUnitTotal)} em adicionais)` : ''} - Total: {currency.format(orderPreviewTotal)}
                </div>
                <button className="secondary-button" disabled={activeProducts.length === 0} type="submit">
                  Adicionar personalizado
                </button>
              </div>
            </details>
          </form>
        </CollapsibleSection>

        <CollapsibleSection
          badge={currency.format(selectedDraftTotal)}
          expandedSections={expandedSections}
          id="draft"
          title="3. Conferir antes da cozinha"
          onToggle={toggleSection}
        >
          {selectedDraftItems.length === 0 ? (
            <p className="empty-state">Nenhum item em conferencia.</p>
          ) : (
            <>
              <div className="order-items draft-order-items">
                {selectedDraftItems.map((item) => (
                  <div className="list-row draft-order-row" key={item.id}>
                    <div>
                      <strong>{item.quantity}x {item.name}</strong>
                      <span>{item.tabName ?? 'Mesa'} - {currency.format(item.unitPrice)} cada</span>
                      {item.notes && <small>{item.notes}</small>}
                    </div>
                    <div className="quantity-stepper" aria-label={`Quantidade de ${item.name}`}>
                      <button type="button" onClick={() => updateDraftItemQuantity(item.id, item.quantity - 1)}>-</button>
                      <strong>{item.quantity}</strong>
                      <button type="button" onClick={() => updateDraftItemQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                    <b>{currency.format(item.total)}</b>
                    <button className="ghost-button danger-button" type="button" onClick={() => removeDraftItem(item.id)}>
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
              {pendingOverride && (
                <button className="secondary-button" type="button" onClick={handleForceAddItem}>
                  Continuar mesmo assim
                </button>
              )}
              <button className="primary-button kitchen-send-button" disabled={isSendingToKitchen} type="button" onClick={() => sendDraftItems()}>
                {isSendingToKitchen ? 'Enviando...' : 'Enviar para cozinha'}
              </button>
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          badge={`${selectedTable.orderItems.length} itens`}
          expandedSections={expandedSections}
          id="sent"
          title="4. Itens enviados"
          onToggle={toggleSection}
        >
          <div className="order-items sent-order-items">
            {selectedTable.orderItems.length === 0 ? (
              <p className="empty-state">Nenhum item lancado nesta mesa.</p>
            ) : (
              selectedTable.orderItems.map((item) => {
                const kitchenTicket = getKitchenTicketForItem(item)
                const editable = canEditSentItem(item)

                return (
                  <div className={`list-row sent-order-row ${editable ? '' : 'locked'}`} key={item.id}>
                    <div>
                      <strong>{item.quantity}x {item.name}</strong>
                      <span>{item.tabName ?? 'Mesa'} - {currency.format(item.unitPrice)} cada</span>
                      {item.notes && <small>{item.notes}</small>}
                    </div>
                    <StatusBadge status={kitchenTicket?.status ?? 'em preparo'} />
                    <div className="quantity-stepper" aria-label={`Quantidade de ${item.name}`}>
                      <button
                        disabled={!editable}
                        type="button"
                        onClick={() => handleUpdateSentItemQuantity(item, item.quantity - 1)}
                      >
                        -
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        disabled={!editable}
                        type="button"
                        onClick={() => handleUpdateSentItemQuantity(item, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <b>{currency.format(item.total)}</b>
                    <button
                      className="ghost-button danger-button"
                      disabled={!editable}
                      type="button"
                      onClick={() => handleRemoveSentItem(item)}
                    >
                      Excluir
                    </button>
                    {!editable && <small>Finalizado pela cozinha</small>}
                  </div>
                )
              })
            )}
            {pendingSentOverride && (
              <button className="secondary-button" type="button" onClick={handleForceSentQuantity}>
                Continuar ajuste mesmo assim
              </button>
            )}
          </div>
        </CollapsibleSection>
      </Card>
    </div>
  )
}
