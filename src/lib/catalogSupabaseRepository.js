import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'
import { getDataOwnerId } from './tenantRepository.js'

function mapProductFromSupabase(product) {
  return {
    id: Number(product.app_id),
    sku: product.sku,
    name: product.name,
    category: product.category,
    type: product.type,
    description: product.description ?? '',
    price: Number(product.price),
    active: product.active,
    recipeId: product.recipe_app_id ? Number(product.recipe_app_id) : null,
    imageUrl: product.image_url ?? '',
    availableChannels: {
      delivery: product.available_delivery ?? true,
      qr: product.available_qr ?? true,
    },
  }
}

function mapInventoryFromSupabase(item) {
  return {
    id: Number(item.app_id),
    name: item.name,
    category: item.category,
    unit: item.unit,
    currentStock: Number(item.current_stock),
    minStock: Number(item.min_stock),
    averageCost: Number(item.average_cost),
    supplier: item.supplier ?? '',
  }
}

function mapSheetFromSupabase(sheet, ingredients) {
  return {
    id: Number(sheet.app_id),
    productId: Number(sheet.product_app_id),
    prepTime: Number(sheet.prep_time),
    yield: Number(sheet.yield_quantity),
    ingredients: ingredients
      .filter((ingredient) => Number(ingredient.sheet_app_id) === Number(sheet.app_id))
      .map((ingredient) => ({
        inventoryItemId: Number(ingredient.inventory_app_id),
        quantity: Number(ingredient.quantity),
      })),
  }
}

function getSafeAppIds(items) {
  return Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.id ?? item?.app_id))
      .filter(Number.isFinite),
  ))
}

function buildInList(values) {
  const safeValues = Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite),
  ))

  return safeValues.length ? `(${safeValues.join(',')})` : ''
}

async function deleteRowsOutsideAppIds(tableName, ownerId, columnName, appIds) {
  let query = supabase.from(tableName).delete().eq('user_id', ownerId)
  const inList = buildInList(appIds)
  if (inList) query = query.not(columnName, 'in', inList)

  const { error } = await query
  return error
}

function buildIngredientRows(technicalSheets, ownerId) {
  const ingredientsByKey = new Map()

  ;(Array.isArray(technicalSheets) ? technicalSheets : []).forEach((sheet) => {
    const sheetId = Number(sheet?.id)
    if (!Number.isFinite(sheetId)) return

    ;(Array.isArray(sheet.ingredients) ? sheet.ingredients : []).forEach((ingredient) => {
      const inventoryId = Number(ingredient?.inventoryItemId)
      if (!Number.isFinite(inventoryId)) return

      const key = `${sheetId}:${inventoryId}`
      const quantity = Math.max(0, Number(ingredient?.quantity || 0))

      ingredientsByKey.set(key, {
        user_id: ownerId,
        sheet_app_id: sheetId,
        inventory_app_id: inventoryId,
        quantity,
      })
    })
  })

  return Array.from(ingredientsByKey.values())
}

function isMissingSchemaColumn(error, columnName) {
  const message = String(error?.message ?? '').toLowerCase()
  const safeColumnName = String(columnName ?? '').toLowerCase()
  return Boolean(
    safeColumnName &&
    message.includes(safeColumnName) &&
    message.includes('schema cache'),
  )
}

function removeFieldsFromRows(rows, fields) {
  return rows.map((row) => {
    const nextRow = { ...row }
    fields.forEach((field) => {
      delete nextRow[field]
    })
    return nextRow
  })
}

async function upsertProductRows(rows) {
  let currentRows = rows
  const fallbackGroups = [
    ['available_delivery', 'available_qr'],
    ['image_url'],
    ['description'],
  ]

  for (;;) {
    const { error } = await supabase.from('user_products').upsert(currentRows, { onConflict: 'user_id,app_id' })
    if (!error) return null

    const fallbackFields = fallbackGroups.find((fields) =>
      fields.some((field) => Object.prototype.hasOwnProperty.call(currentRows[0] ?? {}, field)) &&
      fields.some((field) => isMissingSchemaColumn(error, field)),
    )

    if (!fallbackFields) return error
    currentRows = removeFieldsFromRows(currentRows, fallbackFields)
  }
}

export async function loadCatalogTables() {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para carregar catalogo.' }
  const ownerId = await getDataOwnerId()

  const [productsResult, inventoryResult, sheetsResult, ingredientsResult] = await Promise.all([
    supabase.from('user_products').select('*').eq('user_id', ownerId),
    supabase.from('user_inventory_items').select('*').eq('user_id', ownerId),
    supabase.from('user_technical_sheets').select('*').eq('user_id', ownerId),
    supabase.from('user_technical_sheet_ingredients').select('*').eq('user_id', ownerId),
  ])

  const error = productsResult.error ?? inventoryResult.error ?? sheetsResult.error ?? ingredientsResult.error
  if (error) {
    return { ok: false, message: `Catalogo ainda nao disponivel no Supabase: ${error.message}` }
  }

  const hasData =
    productsResult.data.length > 0 ||
    inventoryResult.data.length > 0 ||
    sheetsResult.data.length > 0 ||
    ingredientsResult.data.length > 0

  return {
    ok: true,
    hasData,
    catalog: {
      products: productsResult.data.map(mapProductFromSupabase),
      inventory: inventoryResult.data.map(mapInventoryFromSupabase),
      technicalSheets: sheetsResult.data.map((sheet) => mapSheetFromSupabase(sheet, ingredientsResult.data)),
    },
  }
}

export async function saveCatalogTables({ products, inventory, technicalSheets }) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para salvar catalogo.' }
  const ownerId = await getDataOwnerId()
  const safeProducts = Array.isArray(products) ? products : []
  const safeInventory = Array.isArray(inventory) ? inventory : []
  const safeTechnicalSheets = Array.isArray(technicalSheets) ? technicalSheets : []

  if (safeInventory.length > 0) {
    const { error } = await supabase.from('user_inventory_items').upsert(
      safeInventory.map((item) => ({
        user_id: ownerId,
        app_id: Number(item.id),
        name: item.name,
        category: item.category,
        unit: item.unit,
        current_stock: Number(item.currentStock || 0),
        min_stock: Number(item.minStock || 0),
        average_cost: Number(item.averageCost || 0),
        supplier: item.supplier ?? '',
      })),
      { onConflict: 'user_id,app_id' },
    )
    if (error) return { ok: false, message: `Erro ao salvar estoque: ${error.message}` }
  }

  if (safeProducts.length > 0) {
    const error = await upsertProductRows(
      safeProducts.map((product) => ({
        user_id: ownerId,
        app_id: Number(product.id),
        sku: product.sku,
        name: product.name,
        category: product.category,
        type: product.type,
        description: product.description ?? '',
        price: Number(product.price || 0),
        active: product.active ?? true,
        recipe_app_id: product.recipeId ? Number(product.recipeId) : null,
        image_url: product.imageUrl ?? '',
        available_delivery: product.availableChannels?.delivery ?? true,
        available_qr: product.availableChannels?.qr ?? true,
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar produtos: ${error.message}` }
  }

  if (safeTechnicalSheets.length > 0) {
    const { error } = await supabase.from('user_technical_sheets').upsert(
      safeTechnicalSheets.map((sheet) => ({
        user_id: ownerId,
        app_id: Number(sheet.id),
        product_app_id: Number(sheet.productId),
        prep_time: Number(sheet.prepTime || 0),
        yield_quantity: Number(sheet.yield || 1),
      })),
      { onConflict: 'user_id,app_id' },
    )
    if (error) return { ok: false, message: `Erro ao salvar fichas tecnicas: ${error.message}` }
  }

  const ingredients = buildIngredientRows(safeTechnicalSheets, ownerId)

  if (ingredients.length > 0) {
    const { error } = await supabase
      .from('user_technical_sheet_ingredients')
      .upsert(ingredients, { onConflict: 'user_id,sheet_app_id,inventory_app_id' })
    if (error) return { ok: false, message: `Erro ao salvar ingredientes: ${error.message}` }
  }

  const ingredientSheetIds = getSafeAppIds(safeTechnicalSheets)
  const staleIngredientsError = await deleteRowsOutsideAppIds(
    'user_technical_sheet_ingredients',
    ownerId,
    'sheet_app_id',
    ingredientSheetIds,
  )
  if (staleIngredientsError) return { ok: false, message: `Erro ao limpar ingredientes antigos: ${staleIngredientsError.message}` }

  for (const sheet of safeTechnicalSheets) {
    const sheetId = Number(sheet.id)
    if (!Number.isFinite(sheetId)) continue

    const ingredientInventoryIds = ingredients
      .filter((ingredient) => Number(ingredient.sheet_app_id) === sheetId)
      .map((ingredient) => ingredient.inventory_app_id)
    let query = supabase
      .from('user_technical_sheet_ingredients')
      .delete()
      .eq('user_id', ownerId)
      .eq('sheet_app_id', sheetId)
    const ingredientInList = buildInList(ingredientInventoryIds)
    if (ingredientInList) query = query.not('inventory_app_id', 'in', ingredientInList)

    const { error } = await query
    if (error) return { ok: false, message: `Erro ao limpar ingredientes removidos: ${error.message}` }
  }

  const staleSheetsError = await deleteRowsOutsideAppIds('user_technical_sheets', ownerId, 'app_id', getSafeAppIds(safeTechnicalSheets))
  if (staleSheetsError) return { ok: false, message: `Erro ao limpar fichas antigas: ${staleSheetsError.message}` }

  const staleProductsError = await deleteRowsOutsideAppIds('user_products', ownerId, 'app_id', getSafeAppIds(safeProducts))
  if (staleProductsError) return { ok: false, message: `Erro ao limpar produtos antigos: ${staleProductsError.message}` }

  const staleInventoryError = await deleteRowsOutsideAppIds('user_inventory_items', ownerId, 'app_id', getSafeAppIds(safeInventory))
  if (staleInventoryError) return { ok: false, message: `Erro ao limpar estoque antigo: ${staleInventoryError.message}` }

  return { ok: true, message: 'Catalogo salvo em tabelas proprias.' }
}
