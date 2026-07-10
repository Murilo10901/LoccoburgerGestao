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

  const deleteIngredients = await supabase.from('user_technical_sheet_ingredients').delete().eq('user_id', ownerId)
  const deleteSheets = await supabase.from('user_technical_sheets').delete().eq('user_id', ownerId)
  const deleteProducts = await supabase.from('user_products').delete().eq('user_id', ownerId)
  const deleteInventory = await supabase.from('user_inventory_items').delete().eq('user_id', ownerId)
  const deleteError = deleteIngredients.error ?? deleteSheets.error ?? deleteProducts.error ?? deleteInventory.error
  if (deleteError) return { ok: false, message: `Erro ao limpar catalogo antigo: ${deleteError.message}` }

  if (inventory.length > 0) {
    const { error } = await supabase.from('user_inventory_items').insert(
      inventory.map((item) => ({
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
    )
    if (error) return { ok: false, message: `Erro ao salvar estoque: ${error.message}` }
  }

  if (products.length > 0) {
    const { error } = await supabase.from('user_products').insert(
      products.map((product) => ({
        user_id: ownerId,
        app_id: Number(product.id),
        sku: product.sku,
        name: product.name,
        category: product.category,
        type: product.type,
        price: Number(product.price || 0),
        active: product.active ?? true,
        recipe_app_id: product.recipeId ? Number(product.recipeId) : null,
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar produtos: ${error.message}` }
  }

  if (technicalSheets.length > 0) {
    const { error } = await supabase.from('user_technical_sheets').insert(
      technicalSheets.map((sheet) => ({
        user_id: ownerId,
        app_id: Number(sheet.id),
        product_app_id: Number(sheet.productId),
        prep_time: Number(sheet.prepTime || 0),
        yield_quantity: Number(sheet.yield || 1),
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar fichas tecnicas: ${error.message}` }
  }

  const ingredients = technicalSheets.flatMap((sheet) =>
    sheet.ingredients.map((ingredient) => ({
      user_id: ownerId,
      sheet_app_id: Number(sheet.id),
      inventory_app_id: Number(ingredient.inventoryItemId),
      quantity: Number(ingredient.quantity || 0),
    })),
  )

  if (ingredients.length > 0) {
    const { error } = await supabase.from('user_technical_sheet_ingredients').insert(ingredients)
    if (error) return { ok: false, message: `Erro ao salvar ingredientes: ${error.message}` }
  }

  return { ok: true, message: 'Catalogo salvo em tabelas proprias.' }
}
