export function getInventoryItem(inventoryItems, ingredient) {
  return inventoryItems.find((item) => Number(item.id) === Number(ingredient.inventoryItemId))
}

export function getRecipeCost(sheet, inventoryItems) {
  if (!sheet) return 0

  return sheet.ingredients.reduce((total, ingredient) => {
    const item = getInventoryItem(inventoryItems, ingredient)
    return total + (item ? item.averageCost * ingredient.quantity : 0)
  }, 0)
}

export function getRecipeUnitCost(sheet, inventoryItems) {
  const recipeCost = getRecipeCost(sheet, inventoryItems)
  const recipeYield = Number(sheet?.yield || 1)

  return recipeYield > 0 ? recipeCost / recipeYield : recipeCost
}

export function getRecipeStockCapacity(sheet, inventoryItems) {
  if (!sheet?.ingredients?.length) {
    return {
      capacity: 0,
      limitingItem: null,
      missingIngredients: [],
    }
  }

  const recipeYield = Math.max(1, Number(sheet.yield || 1))
  const capacities = sheet.ingredients.map((ingredient) => {
    const item = getInventoryItem(inventoryItems, ingredient)
    const requiredQuantity = Number(ingredient.quantity || 0)
    const currentStock = Number(item?.currentStock ?? 0)
    const capacity = requiredQuantity > 0
      ? Math.floor((currentStock / requiredQuantity) * recipeYield)
      : 0

    return {
      inventoryItemId: ingredient.inventoryItemId,
      item,
      requiredQuantity,
      currentStock,
      capacity: Math.max(0, capacity),
    }
  })

  const limitingItem = capacities.reduce((lowest, current) => {
    if (!lowest) return current
    return current.capacity < lowest.capacity ? current : lowest
  }, null)

  return {
    capacity: limitingItem?.capacity ?? 0,
    limitingItem,
    missingIngredients: capacities.filter((entry) => !entry.item),
  }
}

export function updateTechnicalSheetDetails(sheet, details) {
  const prepTime = Number(details.prepTime)
  const recipeYield = Number(details.yield)

  if (prepTime <= 0 || recipeYield <= 0) return sheet

  return {
    ...sheet,
    prepTime,
    yield: recipeYield,
  }
}

export function addIngredientToSheet(sheet, ingredient) {
  const existingIngredient = sheet.ingredients.find((item) => Number(item.inventoryItemId) === Number(ingredient.inventoryItemId))

  if (existingIngredient) {
    return {
      ...sheet,
      ingredients: sheet.ingredients.map((item) =>
        Number(item.inventoryItemId) === Number(ingredient.inventoryItemId)
          ? { ...item, quantity: item.quantity + ingredient.quantity }
          : item,
      ),
    }
  }

  return {
    ...sheet,
    ingredients: [...sheet.ingredients, ingredient],
  }
}

export function removeIngredientFromSheet(sheet, inventoryItemId) {
  return {
    ...sheet,
    ingredients: sheet.ingredients.filter((item) => Number(item.inventoryItemId) !== Number(inventoryItemId)),
  }
}

export function createEmptyTechnicalSheet({ currentSheets, productId }) {
  const nextId = Math.max(0, ...currentSheets.map((sheet) => Number(sheet.id))) + 1

  return {
    id: nextId,
    productId,
    prepTime: 10,
    yield: 1,
    ingredients: [],
  }
}
