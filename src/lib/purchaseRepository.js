import { getSuggestedPurchaseMaxPrice, getSuggestedPurchaseQuantity } from './inventoryRepository.js'

export function createPurchaseOrder({ currentOrders, inventoryItems, order }) {
  const item = inventoryItems.find((inventoryItem) => inventoryItem.id === Number(order.inventoryItemId))
  if (!item) return null

  return {
    id: Date.now(),
    code: `PC-${String(currentOrders.length + 1).padStart(4, '0')}`,
    inventoryItemId: item.id,
    itemName: item.name,
    unit: item.unit,
    quantity: Number(order.quantity),
    unitCost: Number(order.unitCost),
    total: Number(order.quantity) * Number(order.unitCost),
    supplier: order.supplier || item.supplier,
    status: 'aberto',
    createdAt: new Date().toLocaleDateString('pt-BR'),
    receivedAt: null,
  }
}

export function receivePurchaseOrder(order) {
  if (!order || order.status === 'recebido') return null

  return {
    receivedOrder: {
      ...order,
      status: 'recebido',
      receivedAt: new Date().toLocaleDateString('pt-BR'),
    },
    stockEntry: {
      inventoryItemId: order.inventoryItemId,
      quantity: order.quantity,
      unitCost: order.unitCost,
      supplier: order.supplier,
    },
  }
}

export function extractFiscalKey(input) {
  return input.replace(/\D/g, '').slice(0, 44)
}

export function simulateFiscalCouponRead(input) {
  const fiscalKey = extractFiscalKey(input) || '35260511222333000199650010000045671234567890'

  return {
    fiscalKey,
    supplier: 'Distribuidora NFC-e Simulada',
    issuedAt: new Date().toLocaleDateString('pt-BR'),
    items: [
      { fiscalName: 'PAO BRIOCHE 60G', quantity: 36, unitCost: 1.72, suggestedInventoryId: 1 },
      { fiscalName: 'CHEDDAR FATIADO KG', quantity: 1800, unitCost: 0.052, suggestedInventoryId: 3 },
      { fiscalName: 'EMBALAGEM HAMBURGUER DELIVERY', quantity: 50, unitCost: 1.08, suggestedInventoryId: 6 },
    ],
  }
}

export function createFiscalCouponReceipt({ currentOrders, importData }) {
  return {
    id: Date.now(),
    code: `NFC-${String(currentOrders.length + 1).padStart(4, '0')}`,
    inventoryItemId: null,
    itemName: `${importData.items.length} itens importados`,
    unit: 'itens',
    quantity: importData.items.length,
    unitCost: importData.total,
    total: importData.total,
    supplier: importData.supplier,
    status: 'recebido',
    createdAt: new Date().toLocaleDateString('pt-BR'),
    receivedAt: new Date().toLocaleDateString('pt-BR'),
    fiscalKey: importData.fiscalKey,
  }
}

export function createPurchaseSuggestion(item) {
  return {
    inventoryItemId: item.id,
    quantity: getSuggestedPurchaseQuantity(item),
    unitCost: getSuggestedPurchaseMaxPrice(item).toFixed(2),
    supplier: item.supplier,
  }
}
