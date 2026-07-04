import { getLocalDateKey } from './dateUtils.js'

export function getStockStatus(item) {
  if (item.currentStock <= item.minStock * 0.6) return 'critico'
  if (item.currentStock <= item.minStock) return 'baixo'
  return 'saudavel'
}

export function parseNumericInput(value) {
  if (typeof value === 'number') return value

  const textValue = String(value ?? '').trim()
  if (!textValue) return Number.NaN

  const normalizedValue = textValue.includes(',')
    ? textValue.replace(/\./g, '').replace(',', '.')
    : textValue

  return Number(normalizedValue)
}

export function getSuggestedPurchaseQuantity(item) {
  return Math.max(0, Math.ceil(item.minStock * 1.5 - item.currentStock))
}

export function getSuggestedPurchaseMaxPrice(item) {
  return Number(item.averageCost || 0)
}

export function getSuggestedPurchasePriceStatus(unitCost, item) {
  const suggestedMaxPrice = getSuggestedPurchaseMaxPrice(item)
  const currentUnitCost = Number(unitCost || 0)

  if (!suggestedMaxPrice || !currentUnitCost) return 'neutro'
  if (currentUnitCost < suggestedMaxPrice) return 'melhora'
  if (currentUnitCost === suggestedMaxPrice) return 'limite'
  return 'acima'
}

export function applyStockEntry(item, entry) {
  const quantity = parseNumericInput(entry.quantity)
  const unitCost = parseNumericInput(entry.unitCost)
  const currentValue = item.currentStock * item.averageCost
  const entryValue = quantity * unitCost
  const nextStock = item.currentStock + quantity
  const nextAverageCost = nextStock > 0 ? (currentValue + entryValue) / nextStock : item.averageCost

  return {
    ...item,
    currentStock: nextStock,
    averageCost: nextAverageCost,
    supplier: entry.supplier || item.supplier,
  }
}

export function createStockAdjustment({ adjustment, currentAdjustments, inventoryItems }) {
  const item = inventoryItems.find((inventoryItem) => inventoryItem.id === Number(adjustment.inventoryItemId))
  const quantity = parseNumericInput(adjustment.quantity)

  if (!item || !Number.isFinite(quantity) || quantity <= 0) return null

  const now = new Date()

  return {
    id: Date.now(),
    code: `AJ-${String(currentAdjustments.length + 1).padStart(4, '0')}`,
    inventoryItemId: item.id,
    itemName: item.name,
    quantity,
    unit: item.unit,
    unitCost: item.averageCost,
    totalCost: quantity * item.averageCost,
    reason: adjustment.reason.trim() || 'Perda operacional',
    type: 'perda',
    createdAt: now.toLocaleDateString('pt-BR'),
    createdAtIso: getLocalDateKey(now),
    time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function applyStockAdjustment(item, adjustment) {
  const quantity = parseNumericInput(adjustment.quantity)

  return {
    ...item,
    currentStock: item.currentStock - quantity,
  }
}

export function applyProductStockConsumption({ inventoryItems, productId, products, quantity, technicalSheets }) {
  const product = products.find((item) => item.id === productId)
  const sheet = technicalSheets.find((item) => item.id === product?.recipeId)
  const consumptionFactor = Number(quantity) / Number(sheet?.yield || 1)

  if (!product || !sheet) return inventoryItems

  return inventoryItems.map((item) => {
    const ingredient = sheet.ingredients.find((entry) => entry.inventoryItemId === item.id)
    if (!ingredient) return item

    return {
      ...item,
      currentStock: item.currentStock - ingredient.quantity * consumptionFactor,
    }
  })
}

export function checkProductStockAvailability({ inventoryItems, productId, products, quantity, technicalSheets }) {
  const product = products.find((item) => item.id === productId)
  const sheet = technicalSheets.find((item) => item.id === product?.recipeId)

  if (!product) {
    return { available: false, message: 'Produto nao encontrado.', missingItems: [] }
  }

  if (!sheet) {
    return { available: false, message: `${product.name} esta sem ficha tecnica vinculada.`, missingItems: [] }
  }

  if (sheet.ingredients.length === 0) {
    return { available: false, message: `${product.name} esta com ficha tecnica vazia.`, missingItems: [] }
  }

  const consumptionFactor = Number(quantity) / Number(sheet.yield || 1)
  const missingItems = sheet.ingredients
    .map((ingredient) => {
      const item = inventoryItems.find((inventoryItem) => inventoryItem.id === ingredient.inventoryItemId)
      const required = ingredient.quantity * consumptionFactor
      const available = item?.currentStock ?? 0

      return {
        id: ingredient.inventoryItemId,
        name: item?.name ?? 'Insumo nao encontrado',
        unit: item?.unit ?? '',
        required,
        available,
        missing: Math.max(0, required - available),
      }
    })
    .filter((item) => item.missing > 0)

  if (missingItems.length > 0) {
    const firstMissing = missingItems[0]
    return {
      available: false,
      message: `Estoque insuficiente: falta ${firstMissing.missing.toFixed(2)} ${firstMissing.unit} de ${firstMissing.name}.`,
      missingItems,
    }
  }

  return { available: true, message: 'Estoque disponivel.', missingItems: [] }
}
