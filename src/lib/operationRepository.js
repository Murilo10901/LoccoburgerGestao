import { getRecipeUnitCost } from './technicalSheetRepository.js'

const paymentMethods = ['pix', 'credito', 'debito', 'dinheiro']
const dayInMilliseconds = 24 * 60 * 60 * 1000

function getProductUnitCost(productId, products, technicalSheets, inventoryItems) {
  const product = products.find((item) => item.id === productId)
  const sheet = technicalSheets.find((item) => item.id === product?.recipeId)

  return getRecipeUnitCost(sheet, inventoryItems)
}

function getItemCogs(item, products, technicalSheets, inventoryItems) {
  const productCost = getProductUnitCost(item.productId, products, technicalSheets, inventoryItems) * item.quantity
  const modifiersCost = (item.modifiers?.additions ?? []).reduce((total, addition) => {
    const inventoryItem = inventoryItems.find((stockItem) => stockItem.id === addition.inventoryItemId)
    return total + (inventoryItem ? inventoryItem.averageCost * addition.quantity * item.quantity : 0)
  }, 0)

  return productCost + modifiersCost
}

function getStockLossTotal(stockAdjustments = [], isoDate = null) {
  return stockAdjustments
    .filter((adjustment) => adjustment.type === 'perda')
    .filter((adjustment) => !isoDate || adjustment.createdAtIso === isoDate)
    .reduce((total, adjustment) => total + Number(adjustment.totalCost || 0), 0)
}

function normalizeSaleItems(payments, deliveredOrders) {
  const tableItems = payments.flatMap((payment) =>
    payment.items.map((item) => ({
      ...item,
      channel: 'Mesa',
      saleId: payment.id,
      saleTotal: payment.amount,
    })),
  )
  const deliveryItems = deliveredOrders.flatMap((order) =>
    order.items.map((item) => ({
      ...item,
      channel: order.channel,
      saleId: order.id,
      saleTotal: order.total,
    })),
  )

  return [...tableItems, ...deliveryItems]
}

export function getDailyOperationSummary({
  deliveries,
  expenses,
  inventoryItems,
  payments,
  products,
  stockAdjustments = [],
  tables,
  technicalSheets,
}) {
  const deliveredOrders = deliveries.filter((order) => order.status === 'entregue')
  const activeDeliveryOrders = deliveries.filter((order) => order.status !== 'entregue')
  const paidExpenses = expenses.filter((expense) => expense.status === 'pago')
  const paidExpenseTotal = paidExpenses.reduce((total, expense) => total + expense.amount, 0)
  const revenueTables = payments.reduce((total, payment) => total + payment.amount, 0)
  const revenueDelivery = deliveredOrders.reduce((total, order) => total + order.total, 0)
  const receivedRevenue = revenueTables + revenueDelivery
  const openTablesTotal = tables.reduce((total, table) => total + table.total, 0)
  const activeDeliveryTotal = activeDeliveryOrders.reduce((total, order) => total + order.total, 0)
  const openRevenue = openTablesTotal + activeDeliveryTotal
  const soldItems = normalizeSaleItems(payments, deliveredOrders)
  const productCogs = soldItems.reduce((total, item) => {
    return total + getItemCogs(item, products, technicalSheets, inventoryItems)
  }, 0)
  const todayIsoDate = formatIsoDate(new Date())
  const stockLossTotal = getStockLossTotal(stockAdjustments, todayIsoDate)
  const cogs = productCogs + stockLossTotal
  const grossProfit = receivedRevenue - cogs
  const netResult = grossProfit - paidExpenseTotal

  const productsSold = Object.values(
    soldItems.reduce((accumulator, item) => {
      if (!accumulator[item.productId]) {
        accumulator[item.productId] = {
          productId: item.productId,
          name: item.name,
          quantity: 0,
          revenue: 0,
          cogs: 0,
        }
      }

      const itemRevenue = item.total ?? item.unitPrice * item.quantity
      accumulator[item.productId].quantity += item.quantity
      accumulator[item.productId].revenue += itemRevenue
      accumulator[item.productId].cogs += getItemCogs(item, products, technicalSheets, inventoryItems)
      return accumulator
    }, {}),
  ).sort((a, b) => b.revenue - a.revenue)

  const paymentsByMethod = paymentMethods.map((method) => ({
    method,
    amount: payments.filter((payment) => payment.method === method).reduce((total, payment) => total + payment.amount, 0),
  }))

  return {
    activeDeliveryOrders,
    activeDeliveryTotal,
    cogs,
    deliveredOrders,
    grossProfit,
    netResult,
    openRevenue,
    openTables: tables.filter((table) => table.total > 0),
    openTablesTotal,
    paidExpenseTotal,
    paymentsByMethod,
    productsSold,
    stockLossTotal,
    receivedRevenue,
    revenueDelivery,
    revenueTables,
    salesCount: payments.length + deliveredOrders.length,
  }
}

function shiftDate(daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date
}

function startOfDay(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function formatBusinessDate(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function scaleCurrency(value, multiplier) {
  return Number((value * multiplier).toFixed(2))
}

function getDateRange(filter) {
  const today = startOfDay(new Date())
  const mode = typeof filter === 'string' ? filter : filter?.mode ?? 'hoje'
  const selectedDate = filter?.selectedDate ? startOfDay(new Date(`${filter.selectedDate}T00:00:00`)) : today

  if (mode === 'ontem') {
    const yesterday = addDays(today, -1)
    return { end: yesterday, mode, start: yesterday }
  }

  if (mode === 'data') {
    return { end: selectedDate, mode, start: selectedDate }
  }

  if (mode === '7-dias') {
    return { end: today, mode, start: addDays(today, -6) }
  }

  if (mode === 'semana') {
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    return { end: today, mode, start: addDays(today, mondayOffset) }
  }

  if (mode === 'mes') {
    return { end: today, mode, start: new Date(today.getFullYear(), today.getMonth(), 1) }
  }

  return { end: today, mode: 'hoje', start: today }
}

function getDateOffset(date) {
  return Math.max(0, Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / dayInMilliseconds))
}

function createDailyBreakdown(baseSummary, filter) {
  const { end, mode, start } = getDateRange(filter)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayInMilliseconds) + 1)
  const multipliers = [1, 0.72, 0.94, 1.08, 0.86, 1.18, 1.32, 0.68, 0.81, 1.05]

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index)
    const isToday = getDateOffset(date) === 0
    const multiplier = isToday ? 1 : multipliers[(getDateOffset(date) + index) % multipliers.length]
    const receivedRevenue = scaleCurrency(baseSummary.receivedRevenue, multiplier)
    const openRevenue = isToday ? baseSummary.openRevenue : 0
    const stockLossTotal = getStockLossTotal(baseSummary.stockAdjustments, formatIsoDate(date))
    const cogs = scaleCurrency(baseSummary.productCogs, multiplier) + stockLossTotal
    const paidExpenseTotal = scaleCurrency(baseSummary.paidExpenseTotal, multiplier * 0.88)
    const grossProfit = receivedRevenue - cogs
    const netResult = grossProfit - paidExpenseTotal

    return {
      date,
      isoDate: formatIsoDate(date),
      label: formatBusinessDate(date),
      receivedRevenue,
      openRevenue,
      cogs,
      paidExpenseTotal,
      grossProfit,
      netResult,
      salesCount: Math.max(0, Math.round(baseSummary.salesCount * multiplier)),
      stockLossTotal,
    }
  })
}

export function getOperationPeriodSummary(data, filter = 'hoje') {
  const currentDay = getDailyOperationSummary(data)
  currentDay.stockAdjustments = data.stockAdjustments ?? []
  currentDay.productCogs = Math.max(0, currentDay.cogs - currentDay.stockLossTotal)
  const mode = typeof filter === 'string' ? filter : filter?.mode ?? 'hoje'
  const dailyBreakdown = createDailyBreakdown(currentDay, filter)
  const isTodayView = mode === 'hoje'
  const consolidated = dailyBreakdown.reduce(
    (accumulator, day) => ({
      receivedRevenue: accumulator.receivedRevenue + day.receivedRevenue,
      openRevenue: accumulator.openRevenue + day.openRevenue,
      cogs: accumulator.cogs + day.cogs,
      paidExpenseTotal: accumulator.paidExpenseTotal + day.paidExpenseTotal,
      grossProfit: accumulator.grossProfit + day.grossProfit,
      netResult: accumulator.netResult + day.netResult,
      salesCount: accumulator.salesCount + day.salesCount,
      stockLossTotal: accumulator.stockLossTotal + day.stockLossTotal,
    }),
    {
      receivedRevenue: 0,
      openRevenue: 0,
      cogs: 0,
      paidExpenseTotal: 0,
      grossProfit: 0,
      netResult: 0,
      salesCount: 0,
      stockLossTotal: 0,
    },
  )

  return {
    ...currentDay,
    ...consolidated,
    activeDeliveryOrders: isTodayView ? currentDay.activeDeliveryOrders : [],
    activeDeliveryTotal: isTodayView ? currentDay.activeDeliveryTotal : 0,
    dailyBreakdown,
    deliveredOrders: currentDay.deliveredOrders,
    openTables: isTodayView ? currentDay.openTables : [],
    openTablesTotal: isTodayView ? currentDay.openTablesTotal : 0,
    paymentsByMethod: currentDay.paymentsByMethod.map((item) => ({
      ...item,
      amount: isTodayView ? item.amount : scaleCurrency(item.amount, consolidated.receivedRevenue / Math.max(currentDay.receivedRevenue, 1)),
    })),
    productsSold: currentDay.productsSold.map((item) => ({
      ...item,
      quantity: isTodayView ? item.quantity : Math.max(0, Math.round(item.quantity * dailyBreakdown.length * 0.92)),
      revenue: isTodayView ? item.revenue : scaleCurrency(item.revenue, consolidated.receivedRevenue / Math.max(currentDay.receivedRevenue, 1)),
      cogs: isTodayView ? item.cogs : scaleCurrency(item.cogs, consolidated.cogs / Math.max(currentDay.cogs, 1)),
    })),
    periodEnd: dailyBreakdown.at(-1)?.date,
    periodMode: mode,
    periodStart: dailyBreakdown[0]?.date,
    revenueDelivery: isTodayView ? currentDay.revenueDelivery : scaleCurrency(currentDay.revenueDelivery, consolidated.receivedRevenue / Math.max(currentDay.receivedRevenue, 1)),
    revenueTables: isTodayView ? currentDay.revenueTables : scaleCurrency(currentDay.revenueTables, consolidated.receivedRevenue / Math.max(currentDay.receivedRevenue, 1)),
  }
}
