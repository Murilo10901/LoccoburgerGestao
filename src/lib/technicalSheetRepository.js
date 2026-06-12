export function getInventoryItem(inventoryItems, ingredient) {
  return inventoryItems.find((item) => item.id === ingredient.inventoryItemId)
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
  const existingIngredient = sheet.ingredients.find((item) => item.inventoryItemId === ingredient.inventoryItemId)

  if (existingIngredient) {
    return {
      ...sheet,
      ingredients: sheet.ingredients.map((item) =>
        item.inventoryItemId === ingredient.inventoryItemId
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
    ingredients: sheet.ingredients.filter((item) => item.inventoryItemId !== inventoryItemId),
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
