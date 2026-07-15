export function saveProduct({ currentProducts, product }) {
  const productId = product.id ? Number(product.id) : Date.now()
  const currentProduct = currentProducts.find((item) => item.id === productId)
  const recipeId = product.recipeId && product.recipeId !== 'new-sheet' ? Number(product.recipeId) : null
  const currentChannels = currentProduct?.availableChannels ?? {}
  const productChannels = product.availableChannels ?? {}
  const payload = {
    id: productId,
    sku: product.sku.trim(),
    name: product.name.trim(),
    category: product.category.trim(),
    type: product.type.trim(),
    description: String(product.description ?? '').trim(),
    price: Number(product.price),
    active: product.active ?? true,
    recipeId,
    imageUrl: String(product.imageUrl ?? currentProduct?.imageUrl ?? '').trim(),
    availableChannels: {
      delivery: productChannels.delivery ?? currentChannels.delivery ?? true,
      qr: productChannels.qr ?? currentChannels.qr ?? true,
    },
  }

  if (!payload.sku || !payload.name || !payload.category || !payload.type || payload.price < 0) return currentProducts

  const exists = currentProducts.some((item) => item.id === productId)
  if (!exists) return [payload, ...currentProducts]

  return currentProducts.map((item) => (item.id === productId ? { ...item, ...payload } : item))
}

export function toggleProductStatus(currentProducts, productId) {
  return currentProducts.map((product) =>
    product.id === productId ? { ...product, active: !product.active } : product,
  )
}

export function saveInventoryItem({ currentItems, item }) {
  const itemId = item.id ? Number(item.id) : Date.now()
  const payload = {
    id: itemId,
    name: item.name.trim(),
    category: item.category.trim(),
    unit: item.unit.trim(),
    currentStock: Number(item.currentStock),
    minStock: Number(item.minStock),
    averageCost: Number(item.averageCost),
    supplier: item.supplier.trim(),
  }

  if (
    !payload.name ||
    !payload.category ||
    !payload.unit ||
    !Number.isFinite(payload.currentStock) ||
    !Number.isFinite(payload.minStock) ||
    !Number.isFinite(payload.averageCost) ||
    payload.minStock < 0 ||
    payload.averageCost < 0
  ) {
    return currentItems
  }

  const exists = currentItems.some((inventoryItem) => inventoryItem.id === itemId)
  if (!exists) return [payload, ...currentItems]

  return currentItems.map((inventoryItem) =>
    inventoryItem.id === itemId ? { ...inventoryItem, ...payload } : inventoryItem,
  )
}
