import { getRecipeUnitCost } from './technicalSheetRepository.js'

function parseCost(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback
  if (typeof value === 'number') return value

  const normalizedValue = String(value).includes(',')
    ? String(value).replace(/\./g, '').replace(',', '.')
    : String(value)
  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

export function getProductMarginAnalysis({ inventoryItems, product, simulatedCosts = {}, technicalSheets }) {
  const sheet = technicalSheets.find((item) => item.id === product?.recipeId)
  if (!product || !sheet) {
    return {
      currentCost: 0,
      currentMargin: 0,
      ingredients: [],
      simulatedCost: 0,
      simulatedMargin: 0,
      simulatedGain: 0,
    }
  }

  const currentCost = getRecipeUnitCost(sheet, inventoryItems)
  const recipeYield = Number(sheet.yield || 1)
  const simulatedRecipeCost = sheet.ingredients.reduce((total, ingredient) => {
    const item = inventoryItems.find((inventoryItem) => inventoryItem.id === ingredient.inventoryItemId)
    const unitCost = parseCost(simulatedCosts[ingredient.inventoryItemId], item?.averageCost ?? 0)
    return total + unitCost * ingredient.quantity
  }, 0)
  const simulatedCost = recipeYield > 0 ? simulatedRecipeCost / recipeYield : simulatedRecipeCost
  const currentMargin = product.price ? ((product.price - currentCost) / product.price) * 100 : 0
  const simulatedMargin = product.price ? ((product.price - simulatedCost) / product.price) * 100 : 0

  const ingredients = sheet.ingredients
    .map((ingredient) => {
      const item = inventoryItems.find((inventoryItem) => inventoryItem.id === ingredient.inventoryItemId)
      const averageCost = item?.averageCost ?? 0
      const simulatedUnitCost = parseCost(simulatedCosts[ingredient.inventoryItemId], averageCost)
      const currentContribution = (averageCost * ingredient.quantity) / recipeYield
      const simulatedContribution = (simulatedUnitCost * ingredient.quantity) / recipeYield
      const weight = currentCost ? (currentContribution / currentCost) * 100 : 0

      return {
        inventoryItemId: ingredient.inventoryItemId,
        name: item?.name ?? 'Insumo nao encontrado',
        quantity: ingredient.quantity / recipeYield,
        unit: item?.unit ?? '',
        averageCost,
        simulatedUnitCost,
        currentContribution,
        simulatedContribution,
        weight,
        saving: currentContribution - simulatedContribution,
        maxSuggestedPrice: averageCost,
      }
    })
    .sort((a, b) => b.currentContribution - a.currentContribution)

  return {
    currentCost,
    currentMargin,
    ingredients,
    simulatedCost,
    simulatedMargin,
    simulatedGain: simulatedMargin - currentMargin,
    totalSaving: currentCost - simulatedCost,
  }
}

export function getMarginSuggestion(ingredient) {
  if (ingredient.weight >= 25) {
    return 'Prioridade alta: negociar fornecedor, compra por volume ou substituto equivalente.'
  }

  if (ingredient.weight >= 12) {
    return 'Boa oportunidade: cotar abaixo do custo medio atual para melhorar margem.'
  }

  return 'Acompanhar preco, mas o impacto na margem e menor.'
}

export function getPortfolioMarginRanking({ inventoryItems, products, technicalSheets }) {
  return products
    .filter((product) => product.recipeId)
    .map((product) => {
      const cost = getRecipeUnitCost(technicalSheets.find((sheet) => sheet.id === product.recipeId), inventoryItems)
      const margin = product.price ? ((product.price - cost) / product.price) * 100 : 0
      return { ...product, cost, margin }
    })
    .sort((a, b) => a.margin - b.margin)
}
