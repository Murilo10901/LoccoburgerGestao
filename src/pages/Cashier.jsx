import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { formatLocalDateLabel, getLocalDateKey, getTodayLocalDateKey } from '../lib/dateUtils.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const paymentMethods = [
  { id: 'pix', label: 'Pix', shortcut: 'PIX' },
  { id: 'credito', label: 'Credito', shortcut: 'CRE' },
  { id: 'debito', label: 'Debito', shortcut: 'DEB' },
  { id: 'dinheiro', label: 'Dinheiro', shortcut: 'DIN' },
  { id: 'caderneta', label: 'Caderneta', shortcut: 'CAD' },
]

const closeablePaymentMethods = paymentMethods.filter((method) => method.id !== 'caderneta')

function getTableTabs(table) {
  return table.tabs?.length
    ? table.tabs
    : [{ id: `${table.id}-mesa`, name: 'Mesa', orderItems: table.orderItems ?? [] }]
}

function getTabTotal(tab) {
  return (tab.orderItems ?? []).reduce((total, item) => total + item.total, 0)
}

function isWholeTableClosing(table) {
  return table?.status === 'fechamento' && Number(table.total || 0) > 0
}

function getClosingTabs(table) {
  return getTableTabs(table ?? {}).filter((tab) => tab.status === 'fechamento' && getTabTotal(tab) > 0)
}

function isPayableTable(table) {
  return isWholeTableClosing(table) || getClosingTabs(table).length > 0
}

function getInitialPaymentScope(table) {
  if (!table) return 'all'
  if (isWholeTableClosing(table)) return 'all'
  return getClosingTabs(table)[0]?.id ?? 'all'
}

function getPayableTableTotal(table) {
  if (isWholeTableClosing(table)) return Number(table.total || 0)
  return getClosingTabs(table).reduce((total, tab) => total + getTabTotal(tab), 0)
}

function getTableDisplayNumber(table) {
  return table?.tableNumber ?? table?.id ?? ''
}

function getPayableTableTitle(table) {
  const tableLabel = `Mesa ${String(getTableDisplayNumber(table)).padStart(2, '0')}`
  if (isWholeTableClosing(table)) return `${tableLabel} - mesa inteira`

  const closingTabs = getClosingTabs(table)
  if (closingTabs.length === 1) return `${tableLabel} - ${closingTabs[0].name}`

  return `${tableLabel} - ${closingTabs.length} comandas`
}

function getPayableTableSubtitle(table) {
  if (isWholeTableClosing(table)) {
    const customerName = table?.customerName || table?.attendant || 'mesa inteira'
    const customerPhone = table?.customerPhone ? ` • ${table.customerPhone}` : ''
    return `${customerName}${customerPhone} • ${getTableItems(table).length} itens`
  }

  const closingTabs = getClosingTabs(table)
  if (closingTabs.length === 1) {
    const tab = closingTabs[0]
    const phone = tab.customerPhone || tab.phone || table?.customerPhone || 'sem telefone'
    return `${phone} • ${(tab.orderItems ?? []).length} itens`
  }

  return closingTabs
    .map((tab) => `${tab.name}${tab.customerPhone ? ` (${tab.customerPhone})` : ''}`)
    .join(' • ')
}

function getTableItems(table) {
  const directItems = table?.orderItems ?? []
  if (directItems.length > 0) return directItems

  return getTableTabs(table ?? {}).flatMap((tab) => tab.orderItems ?? [])
}

function parseMoney(value) {
  if (typeof value === 'number') return value
  const normalizedValue = String(value ?? '').trim().includes(',')
    ? String(value ?? '').replace(/\./g, '').replace(',', '.')
    : String(value ?? '')
  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function isDateOnlyKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim())
}

function getPaymentDateKey(payment) {
  const rawValue = payment?.paidAtIso || payment?.createdAtIso || payment?.paidAt
  if (isDateOnlyKey(rawValue)) return String(rawValue).trim()
  const dateKey = getLocalDateKey(rawValue)
  return dateKey || 'sem-data'
}

function formatDateFilterLabel(dateKey) {
  if (dateKey === 'sem-data') return 'Sem data'
  return formatLocalDateLabel(dateKey)
}

function getPaymentTimestamp(payment) {
  const rawValue = payment?.paidAtIso || payment?.createdAtIso || payment?.paidAt
  if (isDateOnlyKey(rawValue)) {
    const [year, month, day] = String(rawValue).split('-').map(Number)
    const timeMatch = String(payment?.time ?? '').match(/^(\d{1,2})(?::(\d{1,2}))?/)
    const hour = timeMatch ? Number(timeMatch[1]) : 0
    const minute = timeMatch ? Number(timeMatch[2] ?? 0) : 0
    return new Date(year, month - 1, day, hour, minute).getTime()
  }
  const parsed = rawValue ? new Date(rawValue).getTime() : 0
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  const idTime = Number(String(payment?.id ?? '').split('-')[0])
  return Number.isFinite(idTime) ? idTime : 0
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getPaymentOriginLabel(payment) {
  if (payment.source === 'caderneta') return `Caderneta ${payment.customerName ?? payment.receivableId}`
  if (payment.source === 'delivery') return `Delivery ${payment.deliveryId}`
  if (payment.source === 'venda-rapida') return `Venda rapida ${payment.customerName ?? 'Balcao'}`
  return `Mesa ${String(payment.tableId).padStart(2, '0')}${payment.tabName ? ` - ${payment.tabName}` : ''}`
}

function getPaymentSourceLabel(source) {
  const labels = {
    'venda-rapida': 'Venda rápida',
    delivery: 'Delivery',
    caderneta: 'Caderneta',
    mesa: 'Mesa',
  }

  return labels[source] ?? 'Mesa'
}

export function Cashier({
  cashClosings = [],
  customers,
  deliveries = [],
  onCloseCashierShift,
  onCloseDeliveryPayment,
  onCloseTablePayment,
  onReopenTableClose,
  payments,
  tables,
}) {
  const payableTables = tables.filter(isPayableTable)
  const closingTablesCount = payableTables.reduce((total, table) => {
    if (isWholeTableClosing(table)) return total + 1
    return total + getClosingTabs(table).length
  }, 0)
  const payableDeliveries = deliveries.filter((order) => {
    const alreadyPaid = order.paymentStatus === 'pago' ||
      payments.some((payment) => payment.source === 'delivery' && payment.deliveryId === order.id)

    return !alreadyPaid && !['recusado', 'cancelado'].includes(order.status)
  })
  const totalPayableAccounts = closingTablesCount + payableDeliveries.length
  const [accountType, setAccountType] = useState(payableTables.length > 0 ? 'mesa' : 'delivery')
  const [selectedTableId, setSelectedTableId] = useState(payableTables[0]?.id ?? '')
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(payableDeliveries[0]?.id ?? '')
  const [paymentScope, setPaymentScope] = useState(() => getInitialPaymentScope(payableTables[0]))
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [discount, setDiscount] = useState('')
  const [serviceCharge, setServiceCharge] = useState('')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '')
  const [splitPayments, setSplitPayments] = useState([])
  const [paymentMessage, setPaymentMessage] = useState(null)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const paymentProcessingRef = useRef(false)
  const [countedAmounts, setCountedAmounts] = useState({})
  const [closingNotes, setClosingNotes] = useState('')
  const [closingMessage, setClosingMessage] = useState(null)
  const [closingProcessing, setClosingProcessing] = useState(false)
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentDateFilter, setPaymentDateFilter] = useState('todos')
  const [paymentSourceFilter, setPaymentSourceFilter] = useState('todos')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos')
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)

  const selectedTable = useMemo(
    () => (accountType === 'mesa' ? payableTables.find((table) => table.id === Number(selectedTableId)) ?? payableTables[0] : null),
    [accountType, payableTables, selectedTableId],
  )
  const selectedDelivery = useMemo(
    () => (accountType === 'delivery' ? payableDeliveries.find((order) => order.id === selectedDeliveryId) ?? payableDeliveries[0] : null),
    [accountType, payableDeliveries, selectedDeliveryId],
  )
  const selectedTabs = selectedTable ? getTableTabs(selectedTable) : []
  const selectedClosingTabs = selectedTable ? getClosingTabs(selectedTable) : []
  const selectedWholeTableClosing = Boolean(selectedTable && isWholeTableClosing(selectedTable))
  const payableSelectedTabs = selectedWholeTableClosing ? selectedTabs : selectedClosingTabs
  const selectedTab = selectedTabs.find((tab) => tab.id === paymentScope)
  const selectedTableItems = selectedTable ? getTableItems(selectedTable) : []
  const selectedItems = selectedDelivery
    ? selectedDelivery.items ?? []
    : paymentScope === 'all'
      ? selectedTableItems
      : selectedTab?.orderItems ?? []
  const selectedAmount = selectedDelivery
    ? Number(selectedDelivery.total || 0)
    : paymentScope === 'all'
      ? Number(selectedTable?.total || selectedItems.reduce((total, item) => total + item.total, 0))
      : selectedItems.reduce((total, item) => total + item.total, 0)
  const discountAmount = Math.max(0, parseMoney(discount))
  const serviceAmount = Math.max(0, parseMoney(serviceCharge))
  const netAmount = Math.max(0, selectedAmount - discountAmount + serviceAmount)
  const paidByCustomer = receivedAmount === '' ? netAmount : parseMoney(receivedAmount)
  const changeAmount = paymentMethod === 'dinheiro' ? Math.max(0, paidByCustomer - netAmount) : 0
  const splitTotal = splitPayments.reduce((total, payment) => total + parseMoney(payment.amount), 0)
  const splitDifference = netAmount - splitTotal

  const paidTotal = payments.reduce((total, payment) => total + payment.amount, 0)
  const paymentsByMethod = paymentMethods.map((method) => ({
    ...method,
    amount: payments.filter((payment) => payment.method === method.id).reduce((total, payment) => total + payment.amount, 0),
  }))
  const closeablePaymentsByMethod = closeablePaymentMethods.map((method) => ({
    ...method,
    expected: payments
      .filter((payment) => payment.method === method.id)
      .reduce((total, payment) => total + Number(payment.amount || 0), 0),
    counted: parseMoney(countedAmounts[method.id]),
  }))
  const expectedCashTotal = closeablePaymentsByMethod.reduce((total, method) => total + method.expected, 0)
  const countedCashTotal = closeablePaymentsByMethod.reduce((total, method) => total + method.counted, 0)
  const closingDifference = countedCashTotal - expectedCashTotal
  const todayDateKey = getTodayLocalDateKey()
  const paymentDateOptions = Array.from(new Set([todayDateKey, ...payments.map(getPaymentDateKey)])).filter(Boolean)
  const normalizedPaymentSearch = normalizeSearch(paymentSearch)
  const filteredPayments = payments
    .filter((payment) => {
      const matchesDate = paymentDateFilter === 'todos' || getPaymentDateKey(payment) === paymentDateFilter
      const matchesSource = paymentSourceFilter === 'todos' || (payment.source ?? 'mesa') === paymentSourceFilter
      const matchesMethod = paymentMethodFilter === 'todos' || payment.method === paymentMethodFilter
      const searchTarget = normalizeSearch([
        payment.id,
        payment.deliveryId,
        payment.tableId,
        payment.customerName,
        payment.customerPhone,
        payment.customerAddress,
        getPaymentOriginLabel(payment),
        ...(payment.items ?? []).map((item) => `${item.quantity}x ${item.name} ${item.notes ?? ''}`),
      ].filter(Boolean).join(' '))
      const matchesSearch = !normalizedPaymentSearch || searchTarget.includes(normalizedPaymentSearch)

      return matchesDate && matchesSource && matchesMethod && matchesSearch
    })
    .sort((first, second) => getPaymentTimestamp(second) - getPaymentTimestamp(first))
  const filteredPaymentsTotal = filteredPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0)
  const selectedPayment = filteredPayments.find((payment) => payment.id === selectedPaymentId) ??
    payments.find((payment) => payment.id === selectedPaymentId)

  useEffect(() => {
    if (selectedDelivery?.customerId) {
      setSelectedCustomerId(selectedDelivery.customerId)
    }
  }, [selectedDelivery?.customerId])

  useEffect(() => {
    if (accountType === 'mesa' && payableTables.length > 0 && !selectedTable) {
      setSelectedTableId(payableTables[0].id)
      setPaymentScope(getInitialPaymentScope(payableTables[0]))
    }

    if (accountType === 'delivery' && payableDeliveries.length > 0 && !selectedDelivery) {
      setSelectedDeliveryId(payableDeliveries[0].id)
      setPaymentScope('all')
    }

    if (accountType === 'delivery' && payableDeliveries.length === 0 && payableTables.length > 0) {
      setAccountType('mesa')
      setSelectedTableId(payableTables[0].id)
      setPaymentScope(getInitialPaymentScope(payableTables[0]))
    }

    if (accountType === 'mesa' && payableTables.length === 0 && payableDeliveries.length > 0) {
      setAccountType('delivery')
      setSelectedDeliveryId(payableDeliveries[0].id)
      setPaymentScope('all')
    }
  }, [accountType, payableDeliveries, payableTables, selectedDelivery, selectedTable])

  useEffect(() => {
    if (!selectedTable || accountType !== 'mesa') return

    const selectedTabExists = selectedTabs.some((tab) => tab.id === paymentScope)
    const currentScopeIsValid = paymentScope === 'all'
      ? isWholeTableClosing(selectedTable)
      : selectedTabExists && (getClosingTabs(selectedTable).some((tab) => tab.id === paymentScope) || isWholeTableClosing(selectedTable))

    if (!currentScopeIsValid) setPaymentScope(getInitialPaymentScope(selectedTable))
  }, [accountType, paymentScope, selectedTable, selectedTabs])

  async function handlePayment(event) {
    event.preventDefault()
    if (paymentProcessingRef.current) return
    if ((!selectedTable && !selectedDelivery) || netAmount <= 0) return
    paymentProcessingRef.current = true
    setPaymentProcessing(true)
    const hasSplit = splitPayments.length > 0
    const paidAccountLabel = selectedDelivery
      ? `delivery ${selectedDelivery.id}`
      : paymentScope === 'all'
        ? `mesa ${String(selectedTable.id).padStart(2, '0')}`
        : `comanda ${selectedTab?.name ?? paymentScope}`

    if (hasSplit && Math.abs(splitDifference) > 0.01) {
      setPaymentMessage({ ok: false, text: `A soma dos pagamentos precisa fechar ${currency.format(netAmount)}. Falta ${currency.format(splitDifference)}.` })
      paymentProcessingRef.current = false
      setPaymentProcessing(false)
      return
    }

    const paymentOptions = {
      customerId: paymentMethod === 'caderneta' ? Number(selectedCustomerId) : null,
      discount: discountAmount,
      payments: hasSplit
        ? splitPayments.map((payment) => ({
          ...payment,
          amount: parseMoney(payment.amount),
          customerId: payment.method === 'caderneta' ? Number(payment.customerId) : null,
        }))
        : null,
      receivedAmount: paidByCustomer,
      serviceCharge: serviceAmount,
    }

    let closeResult = { ok: true, message: `Pagamento registrado para ${paidAccountLabel}. Caixa, faturamento e DRE foram atualizados.` }

    try {
      if (selectedDelivery) {
        closeResult = await Promise.resolve(onCloseDeliveryPayment(selectedDelivery.id, paymentMethod, paymentOptions) ?? closeResult)
        if (closeResult.ok === false) {
          setPaymentMessage({ ok: false, text: closeResult.message ?? 'Nao foi possivel registrar o pagamento.' })
          return
        }

        const nextDelivery = payableDeliveries.find((order) => order.id !== selectedDelivery.id)
        setSelectedDeliveryId(nextDelivery?.id ?? '')
        if (!nextDelivery && payableTables.length > 0) setAccountType('mesa')
      } else {
        closeResult = await Promise.resolve(onCloseTablePayment(selectedTable.id, paymentMethod, paymentScope, paymentOptions) ?? closeResult)
        if (closeResult.ok === false) {
          setPaymentMessage({ ok: false, text: closeResult.message ?? 'Nao foi possivel registrar o pagamento.' })
          return
        }

        const nextTable = payableTables.find((table) => table.id !== selectedTable.id)
        const hasRemainingBalance = paymentScope !== 'all' && selectedTable.total - selectedAmount > 0
        setSelectedTableId(hasRemainingBalance ? selectedTable.id : nextTable?.id ?? '')
        if (!hasRemainingBalance && !nextTable && payableDeliveries.length > 0) setAccountType('delivery')
      }
      setPaymentScope('all')
      setDiscount('')
      setServiceCharge('')
      setReceivedAmount('')
      setSplitPayments([])
      setPaymentMessage({ ok: true, text: closeResult.message ?? `Pagamento registrado para ${paidAccountLabel}. Caixa, faturamento e DRE foram atualizados.` })
    } catch (error) {
      setPaymentMessage({ ok: false, text: error?.message ?? 'Nao foi possivel registrar o pagamento agora. Tente novamente.' })
    } finally {
      paymentProcessingRef.current = false
      setPaymentProcessing(false)
    }
  }

  function setExactCash() {
    setReceivedAmount(netAmount.toFixed(2))
  }

  function addSplitPayment(method = 'pix') {
    setSplitPayments((currentPayments) => [
      ...currentPayments,
      {
        id: Date.now(),
        method,
        amount: Math.max(0, netAmount - currentPayments.reduce((total, payment) => total + parseMoney(payment.amount), 0)).toFixed(2),
        customerId: customers[0]?.id ?? '',
      },
    ])
  }

  function updateSplitPayment(paymentId, field, value) {
    setSplitPayments((currentPayments) =>
      currentPayments.map((payment) => (payment.id === paymentId ? { ...payment, [field]: value } : payment)),
    )
  }

  function removeSplitPayment(paymentId) {
    setSplitPayments((currentPayments) => currentPayments.filter((payment) => payment.id !== paymentId))
  }

  function setExpectedAmounts() {
    setCountedAmounts(
      closeablePaymentsByMethod.reduce((amounts, method) => ({
        ...amounts,
        [method.id]: method.expected.toFixed(2),
      }), {}),
    )
  }

  async function handleCloseShift(event) {
    event.preventDefault()
    if (expectedCashTotal <= 0) {
      setClosingMessage({ ok: false, text: 'Ainda nao existem recebimentos para fechar o caixa.' })
      return
    }

    setClosingProcessing(true)
    setClosingMessage({ ok: true, text: 'Registrando fechamento no banco...' })

    const result = await Promise.resolve(onCloseCashierShift({
        expectedTotal: expectedCashTotal,
        countedTotal: countedCashTotal,
        difference: closingDifference,
        notes: closingNotes.trim(),
        paymentsCount: payments.filter((payment) => Number(payment.amount || 0) > 0).length,
        methods: closeablePaymentsByMethod.map((method) => ({
          id: method.id,
          label: method.label,
          expected: method.expected,
          counted: method.counted,
          difference: method.counted - method.expected,
        })),
      }))
      .catch((error) => ({ ok: false, message: error?.message ?? 'Nao foi possivel registrar o fechamento.' }))
      .finally(() => setClosingProcessing(false))

    if (result?.ok === false) {
      setClosingMessage({ ok: false, text: result.message })
      return
    }

    setClosingMessage({ ok: true, text: result?.message ?? 'Fechamento registrado no historico do caixa.' })
    setClosingNotes('')
  }

  async function handleReopenSelectedTableAccount() {
    if (!selectedTable || paymentProcessing) return

    setPaymentProcessing(true)
    setPaymentMessage({ ok: true, text: 'Reabrindo conta no atendimento...' })

    const result = await Promise.resolve(onReopenTableClose?.(selectedTable.id, {
      tabId: paymentScope === 'all' ? null : paymentScope,
    }) ?? { ok: false, message: 'Acao de reabertura nao configurada.' })
      .catch((error) => ({ ok: false, message: error?.message ?? 'Nao foi possivel reabrir a conta.' }))
      .finally(() => setPaymentProcessing(false))

    if (result?.ok === false) {
      setPaymentMessage({ ok: false, text: result.message })
      return
    }

    const nextTable = payableTables.find((table) => table.id !== selectedTable.id)
    setSelectedTableId(nextTable?.id ?? '')
    setPaymentScope(nextTable ? getInitialPaymentScope(nextTable) : 'all')
    if (!nextTable && payableDeliveries.length > 0) setAccountType('delivery')
    setPaymentMessage({ ok: true, text: result?.message ?? 'Conta reaberta no atendimento.' })
  }

  return (
    <div className="cashier-grid">
      {(paymentProcessing || closingProcessing) && (
        <div className="cashier-action-overlay" role="status" aria-live="polite">
          <div>
            <span className="kitchen-feedback-spinner" aria-hidden="true" />
            <p className="eyebrow">Banco de dados</p>
            <h3>
              {paymentProcessing
                ? 'Registrando pagamento...'
                : 'Fechando caixa...'}
            </h3>
            <small>Atualizando caixa, financeiro e DRE. Aguarde confirmar.</small>
          </div>
        </div>
      )}
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Contas abertas</span>
          <strong>{totalPayableAccounts}</strong>
        </Card>
        <Card className="stat-card">
          <span>Em fechamento</span>
          <strong>{closingTablesCount}</strong>
        </Card>
        <Card className="stat-card">
          <span>Total pendente</span>
          <strong>{currency.format(
            payableTables.reduce((total, table) => total + getPayableTableTotal(table), 0) +
            payableDeliveries.reduce((total, order) => total + Number(order.total || 0), 0),
          )}</strong>
        </Card>
        <Card className="stat-card">
          <span>Recebido no turno</span>
          <strong>{currency.format(paidTotal)}</strong>
        </Card>
      </section>

      <Card className="wide-card cashier-pdv-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PDV</p>
            <h2>Fila de contas</h2>
          </div>
          <span className="soft-label">{payableTables.length} mesas - {payableDeliveries.length} delivery</span>
        </div>

        <div className="cashier-list">
          {totalPayableAccounts === 0 ? (
            <p className="empty-state">Nenhuma conta pendente no momento.</p>
          ) : (
            <>
              {payableTables.map((table) => (
                <button
                  className={`cashier-table-row ${accountType === 'mesa' && selectedTable?.id === table.id ? 'selected' : ''}`}
                  key={`mesa-${table.id}`}
                  type="button"
                  onClick={() => {
                    setAccountType('mesa')
                    setSelectedTableId(table.id)
                    setPaymentScope(getInitialPaymentScope(table))
                  }}
                >
                  <div>
                    <strong>{getPayableTableTitle(table)}</strong>
                    <span>{getPayableTableSubtitle(table)}</span>
                  </div>
                  <StatusBadge status={table.status} />
                  <b>{currency.format(getPayableTableTotal(table))}</b>
                </button>
              ))}
              {payableDeliveries.map((order) => (
                <button
                  className={`cashier-table-row ${accountType === 'delivery' && selectedDelivery?.id === order.id ? 'selected' : ''}`}
                  key={`delivery-${order.id}`}
                  type="button"
                  onClick={() => {
                    setAccountType('delivery')
                    setSelectedDeliveryId(order.id)
                    setSelectedCustomerId(order.customerId)
                    setPaymentScope('all')
                  }}
                >
                  <div>
                    <strong>Delivery {order.id}</strong>
                    <span>{order.customer} - {(order.items ?? []).length} itens</span>
                  </div>
                  <StatusBadge status={order.status} />
                  <b>{currency.format(order.total)}</b>
                </button>
              ))}
            </>
          )}
        </div>
      </Card>

      <Card className="payment-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pagamento</p>
            <h2>
              {selectedDelivery
                ? `Delivery ${selectedDelivery.id}`
                : selectedTable
                  ? getPayableTableTitle(selectedTable)
                  : 'Sem conta'}
            </h2>
            {selectedTable && (
              <small>{getPayableTableSubtitle(selectedTable)}</small>
            )}
          </div>
        </div>

        {selectedTable || selectedDelivery ? (
          <>
            <div className="pdv-display">
              <span>Total PDV</span>
              <strong>{currency.format(netAmount)}</strong>
              <small>{selectedItems.length} itens selecionados</small>
            </div>

            {selectedDelivery ? (
              <div className="tab-summary-list">
                <div className="tab-summary-row selected">
                  <div>
                    <strong>{selectedDelivery.customer}</strong>
                    <span>{selectedDelivery.channel} - {selectedDelivery.address}</span>
                  </div>
                  <b>{currency.format(selectedDelivery.total)}</b>
                </div>
              </div>
            ) : (
            <div className="tab-summary-list">
              {selectedWholeTableClosing && (
                <button
                  className={`tab-summary-row ${paymentScope === 'all' ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setPaymentScope('all')}
                >
                  <div>
                    <strong>Mesa inteira</strong>
                    <span>{selectedTableItems.length} itens</span>
                  </div>
                  <b>{currency.format(selectedTable.total)}</b>
                </button>
              )}
              {payableSelectedTabs.map((tab) => (
                <button
                  className={`tab-summary-row ${paymentScope === tab.id ? 'selected' : ''}`}
                  key={tab.id}
                  type="button"
                  onClick={() => setPaymentScope(tab.id)}
                >
                  <div>
                    <strong>{tab.name}</strong>
                    <span>{(tab.orderItems ?? []).length} itens</span>
                  </div>
                  <b>{currency.format(getTabTotal(tab))}</b>
                </button>
              ))}
            </div>
            )}

            <div className="order-items">
              {selectedItems.map((item, index) => (
                <div className="list-row" key={item.id ?? `${item.productId}-${item.name}-${index}`}>
                  <div>
                    <strong>{item.quantity}x {item.name}</strong>
                    <span>{selectedDelivery ? selectedDelivery.id : item.tabName ?? 'Mesa'} - {currency.format(item.unitPrice)} cada</span>
                    {item.notes && <small>{item.notes}</small>}
                  </div>
                  <b>{currency.format(item.total)}</b>
                </div>
              ))}
            </div>

            <form className="entry-form" onSubmit={handlePayment}>
              {!selectedDelivery && (
              <label>
                Receber
                <select value={paymentScope} onChange={(event) => setPaymentScope(event.target.value)}>
                  {selectedWholeTableClosing && <option value="all">Mesa inteira</option>}
                  {payableSelectedTabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name} - {currency.format(getTabTotal(tab))}
                    </option>
                  ))}
                </select>
              </label>
              )}

              <div className="pdv-method-grid" aria-label="Forma de pagamento">
                {paymentMethods.map((method) => (
                  <button
                    className={paymentMethod === method.id ? 'active' : ''}
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    <strong>{method.shortcut}</strong>
                    <span>{method.label}</span>
                  </button>
                ))}
              </div>

              <div className="form-grid">
                <label>
                  Desconto
                  <input
                    inputMode="decimal"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Taxa servico
                  <input
                    inputMode="decimal"
                    value={serviceCharge}
                    onChange={(event) => setServiceCharge(event.target.value)}
                    placeholder="0,00"
                  />
                </label>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div className="pdv-cash-box">
                  <label>
                    Valor recebido
                    <input
                      inputMode="decimal"
                      value={receivedAmount}
                      onChange={(event) => setReceivedAmount(event.target.value)}
                      placeholder={netAmount.toFixed(2)}
                    />
                  </label>
                  <button className="ghost-button" type="button" onClick={setExactCash}>
                    Valor exato
                  </button>
                  <div>
                    <span>Troco</span>
                    <strong>{currency.format(changeAmount)}</strong>
                  </div>
                </div>
              )}

              {paymentMethod === 'caderneta' && (
                <div className="form-hint">
                  <label>
                    Cliente da caderneta
                    <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(Number(event.target.value))}>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.name} - {customer.phone}</option>
                      ))}
                    </select>
                  </label>
                  O valor sera registrado em Contas a receber e nao entra como dinheiro recebido no caixa.
                </div>
              )}

              <div className="split-payment-panel">
                <div className="section-heading compact-heading">
                  <h2>Pagamento dividido</h2>
                  <button className="ghost-button" type="button" onClick={() => addSplitPayment()}>
                    Adicionar meio
                  </button>
                </div>
                {splitPayments.length === 0 ? (
                  <p className="empty-state">Use quando o cliente pagar com mais de um meio.</p>
                ) : (
                  <div className="split-payment-list">
                    {splitPayments.map((payment) => (
                      <div className="split-payment-row" key={payment.id}>
                        <select
                          value={payment.method}
                          onChange={(event) => updateSplitPayment(payment.id, 'method', event.target.value)}
                        >
                          {paymentMethods.map((method) => (
                            <option key={method.id} value={method.id}>{method.label}</option>
                          ))}
                        </select>
                        <input
                          inputMode="decimal"
                          value={payment.amount}
                          onChange={(event) => updateSplitPayment(payment.id, 'amount', event.target.value)}
                          placeholder="0,00"
                        />
                        {payment.method === 'caderneta' && (
                          <select
                            value={payment.customerId}
                            onChange={(event) => updateSplitPayment(payment.id, 'customerId', Number(event.target.value))}
                          >
                            {customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>{customer.name}</option>
                            ))}
                          </select>
                        )}
                        <button className="ghost-button" type="button" onClick={() => removeSplitPayment(payment.id)}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {splitPayments.length > 0 && (
                  <div className={Math.abs(splitDifference) <= 0.01 ? 'form-hint' : 'form-alert'}>
                    Soma dos meios: {currency.format(splitTotal)}. {Math.abs(splitDifference) <= 0.01 ? 'Pagamento fechado.' : `Diferenca: ${currency.format(splitDifference)}.`}
                  </div>
                )}
              </div>

              <div className="pdv-totals">
                <div><span>Subtotal</span><strong>{currency.format(selectedAmount)}</strong></div>
                <div><span>Desconto</span><strong>{currency.format(discountAmount)}</strong></div>
                <div><span>Servico</span><strong>{currency.format(serviceAmount)}</strong></div>
                <div><span>A receber</span><strong>{currency.format(netAmount)}</strong></div>
              </div>

              {!selectedDelivery && (
                <button className="ghost-button" disabled={paymentProcessing} type="button" onClick={handleReopenSelectedTableAccount}>
                  {paymentScope === 'all' ? 'Reabrir conta no atendimento' : 'Reabrir comanda no atendimento'}
                </button>
              )}

              <button className="primary-button" disabled={paymentProcessing} type="submit">
                {paymentProcessing
                  ? 'Processando pagamento...'
                  : selectedDelivery
                    ? 'Receber pedido delivery'
                    : paymentScope === 'all'
                      ? 'Receber e liberar mesa'
                      : 'Receber comanda'}
              </button>
              {paymentMessage && (
                <div className={paymentMessage.ok ? 'form-hint' : 'form-alert'}>{paymentMessage.text}</div>
              )}
            </form>
          </>
        ) : (
          <p className="empty-state">Selecione uma conta para receber.</p>
        )}
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Turno</p>
            <h2>Pagamentos registrados</h2>
          </div>
          <span className="soft-label">{filteredPayments.length} registro(s) - {currency.format(filteredPaymentsTotal)}</span>
        </div>
        <div className="payment-history-filters">
          <label>
            Buscar
            <input
              value={paymentSearch}
              onChange={(event) => setPaymentSearch(event.target.value)}
              placeholder="Cliente, telefone, pedido, mesa, endereco ou item"
            />
          </label>
          <label>
            Dia
            <select value={paymentDateFilter} onChange={(event) => setPaymentDateFilter(event.target.value)}>
              <option value="todos">Todos os dias</option>
              {paymentDateOptions.map((dateKey) => (
                <option key={dateKey} value={dateKey}>{dateKey === todayDateKey ? `Hoje - ${formatDateFilterLabel(dateKey)}` : formatDateFilterLabel(dateKey)}</option>
              ))}
            </select>
          </label>
          <label>
            Origem
            <select value={paymentSourceFilter} onChange={(event) => setPaymentSourceFilter(event.target.value)}>
              <option value="todos">Todas</option>
              <option value="mesa">Mesa</option>
              <option value="delivery">Delivery</option>
              <option value="venda-rapida">Venda rápida</option>
              <option value="caderneta">Caderneta</option>
            </select>
          </label>
          <label>
            Forma
            <select value={paymentMethodFilter} onChange={(event) => setPaymentMethodFilter(event.target.value)}>
              <option value="todos">Todas</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Hora</th>
                <th>Origem</th>
                <th>Forma</th>
                <th>Bruto</th>
                <th>Desconto</th>
                <th>Troco</th>
                <th>Valor</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="9">Nenhum pagamento encontrado com os filtros atuais.</td>
                </tr>
              ) : filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDateFilterLabel(getPaymentDateKey(payment))}</td>
                  <td>{payment.time}</td>
                  <td>{getPaymentOriginLabel(payment)}</td>
                  <td><StatusBadge status={payment.method} /></td>
                  <td>{currency.format(payment.grossAmount ?? payment.amount)}</td>
                  <td>{currency.format(payment.discount ?? 0)}</td>
                  <td>{currency.format(payment.change ?? 0)}</td>
                  <td>{currency.format(payment.amount)}</td>
                  <td>
                    <button className="ghost-button" type="button" onClick={() => setSelectedPaymentId(payment.id)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedPayment && (
          <div className="cashier-payment-detail-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Detalhes do pagamento</p>
                <h3>{getPaymentOriginLabel(selectedPayment)}</h3>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSelectedPaymentId(null)}>Fechar</button>
            </div>
            <div className="delivery-detail-grid">
              <div><span>Data</span><strong>{formatDateFilterLabel(getPaymentDateKey(selectedPayment))} {selectedPayment.time ?? ''}</strong></div>
              <div><span>Cliente</span><strong>{selectedPayment.customerName ?? 'Nao informado'}</strong></div>
              <div><span>Telefone</span><strong>{selectedPayment.customerPhone ?? '-'}</strong></div>
              <div><span>Endereco</span><strong>{selectedPayment.customerAddress ?? '-'}</strong></div>
              <div><span>Forma</span><strong>{selectedPayment.method}</strong></div>
              <div><span>Total</span><strong>{currency.format(selectedPayment.amount ?? 0)}</strong></div>
            </div>
            <div className="delivery-detail-items">
              {(selectedPayment.items ?? []).length === 0 ? (
                <p className="empty-state">Sem itens detalhados neste registro.</p>
              ) : selectedPayment.items.map((item, index) => (
                <article key={`${selectedPayment.id}-${item.productId ?? item.name}-${index}`}>
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
            <p className="eyebrow">Resumo</p>
            <h2>Recebimentos por forma</h2>
          </div>
        </div>
        <div className="summary-stack">
          {paymentsByMethod.map((method) => (
            <div key={method.id}>
              <span><StatusBadge status={method.id} /></span>
              <strong>{currency.format(method.amount)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fechamento</p>
            <h2>Conferencia do caixa</h2>
          </div>
          <button className="ghost-button" type="button" onClick={setExpectedAmounts}>
            Preencher esperado
          </button>
        </div>
        <form className="entry-form cashier-closing-form" onSubmit={handleCloseShift}>
          <div className="cashier-closing-grid">
            {closeablePaymentsByMethod.map((method) => (
              <label key={method.id}>
                {method.label}
                <span className="soft-label">Esperado {currency.format(method.expected)}</span>
                <input
                  inputMode="decimal"
                  value={countedAmounts[method.id] ?? ''}
                  onChange={(event) =>
                    setCountedAmounts((currentAmounts) => ({
                      ...currentAmounts,
                      [method.id]: event.target.value,
                    }))}
                  placeholder="0,00"
                />
              </label>
            ))}
          </div>
          <div className="pdv-totals">
            <div><span>Esperado</span><strong>{currency.format(expectedCashTotal)}</strong></div>
            <div><span>Contado</span><strong>{currency.format(countedCashTotal)}</strong></div>
            <div><span>Diferenca</span><strong>{currency.format(closingDifference)}</strong></div>
          </div>
          <label>
            Observacao
            <textarea
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              placeholder="Ex: diferenca conferida com o responsavel do turno"
            />
          </label>
          <button className="primary-button" disabled={closingProcessing} type="submit">
            {closingProcessing ? 'Registrando fechamento...' : 'Registrar fechamento'}
          </button>
          {closingMessage && (
            <div className={closingMessage.ok ? 'form-hint' : 'form-alert'}>{closingMessage.text}</div>
          )}
        </form>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historico</p>
            <h2>Fechamentos registrados</h2>
          </div>
          <span className="soft-label">{cashClosings.length} fechamentos</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Hora</th>
                <th>Codigo</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Diferenca</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {cashClosings.length === 0 ? (
                <tr>
                  <td colSpan="7">Nenhum fechamento registrado.</td>
                </tr>
              ) : cashClosings.map((closing) => (
                <tr key={closing.id}>
                  <td>{closing.createdAt}</td>
                  <td>{closing.time}</td>
                  <td>{closing.code}</td>
                  <td>{currency.format(closing.expectedTotal)}</td>
                  <td>{currency.format(closing.countedTotal)}</td>
                  <td>{currency.format(closing.difference)}</td>
                  <td>{closing.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
