import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { useState } from 'react'
import { getInventoryItem, getRecipeCost, getRecipeUnitCost } from '../lib/technicalSheetRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

function getIngredientQuantityHint(item) {
  if (!item) return 'Informe a quantidade na mesma unidade cadastrada no estoque.'

  const normalizedName = item.name.toLowerCase()

  if (normalizedName.includes('barril') && normalizedName.includes('20l')) {
    return 'Para vender 400 ml de um barril de 20 L, lance 0,02 un.'
  }

  return `Quantidade em ${item.unit}. Aceita fracao, como 0,5 ou 0,02.`
}

export function TechnicalSheet({
  inventoryItems,
  onAddIngredient,
  onCreateSheet,
  onRemoveIngredient,
  onUpdateSheet,
  products,
  technicalSheets,
}) {
  const [ingredientForms, setIngredientForms] = useState({})
  const [sheetForms, setSheetForms] = useState({})
  const productsWithoutSheet = products.filter((product) => !product.recipeId)

  function getForm(sheet) {
    return ingredientForms[sheet.id] ?? {
      inventoryItemId: inventoryItems[0]?.id ?? '',
      quantity: '',
    }
  }

  function updateForm(sheetId, field, value) {
    setIngredientForms((currentForms) => ({
      ...currentForms,
      [sheetId]: {
        ...(currentForms[sheetId] ?? { inventoryItemId: inventoryItems[0]?.id ?? '', quantity: '' }),
        [field]: value,
      },
    }))
  }

  function getSheetForm(sheet) {
    return sheetForms[sheet.id] ?? {
      prepTime: sheet.prepTime,
      yield: sheet.yield,
    }
  }

  function updateSheetForm(sheetId, field, value) {
    setSheetForms((currentForms) => ({
      ...currentForms,
      [sheetId]: {
        ...(currentForms[sheetId] ?? {}),
        [field]: value,
      },
    }))
  }

  function handleUpdateSheet(event, sheet) {
    event.preventDefault()

    const form = getSheetForm(sheet)
    onUpdateSheet(sheet.id, {
      prepTime: Number(form.prepTime),
      yield: Number(form.yield),
    })
  }

  function handleAddIngredient(event, sheet) {
    event.preventDefault()

    const form = getForm(sheet)
    const quantity = Number(form.quantity)
    const inventoryItemId = Number(form.inventoryItemId)

    if (!inventoryItemId || quantity <= 0) return

    onAddIngredient(sheet.id, { inventoryItemId, quantity })
    setIngredientForms((currentForms) => ({
      ...currentForms,
      [sheet.id]: {
        ...form,
        quantity: '',
      },
    }))
  }

  return (
    <div className="recipe-grid">
      {productsWithoutSheet.length > 0 && (
        <Card className="wide-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pendencias</p>
              <h2>Produtos sem ficha tecnica</h2>
            </div>
            <span className="soft-label">{productsWithoutSheet.length} produtos</span>
          </div>
          <div className="list-stack">
            {productsWithoutSheet.map((product) => (
              <div className="list-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.sku} - {product.category} - {currency.format(product.price)}</span>
                </div>
                <button className="secondary-button" type="button" onClick={() => onCreateSheet(product.id)}>
                  Criar ficha
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {technicalSheets.map((sheet) => {
        const product = products.find((item) => item.id === sheet.productId)
        if (!product) return null
        const cost = getRecipeCost(sheet, inventoryItems)
        const unitCost = getRecipeUnitCost(sheet, inventoryItems)
        const contribution = product.price - unitCost
        const margin = product.price ? (contribution / product.price) * 100 : 0
        const form = getForm(sheet)
        const sheetForm = getSheetForm(sheet)
        const selectedIngredientItem = inventoryItems.find((item) => item.id === Number(form.inventoryItemId))

        return (
          <Card className="recipe-card" key={sheet.id}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{product.category}</p>
                <h2>{product.name}</h2>
              </div>
              <StatusBadge status={product.active ? 'com-ficha' : 'inativo'} />
            </div>

            <div className="recipe-metrics">
              <div>
                <span>Preco</span>
                <strong>{currency.format(product.price)}</strong>
              </div>
              <div>
                <span>Custo</span>
                <strong>{currency.format(unitCost)}</strong>
              </div>
              <div>
                <span>Margem</span>
                <strong>{margin.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Preparo</span>
                <strong>{sheet.prepTime} min</strong>
              </div>
              <div>
                <span>Rendimento</span>
                <strong>{sheet.yield} un</strong>
              </div>
            </div>

            <form className="recipe-settings-form" onSubmit={(event) => handleUpdateSheet(event, sheet)}>
              <label>
                Tempo preparo
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={sheetForm.prepTime}
                  onChange={(event) => updateSheetForm(sheet.id, 'prepTime', event.target.value)}
                />
              </label>
              <label>
                Rendimento
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={sheetForm.yield}
                  onChange={(event) => updateSheetForm(sheet.id, 'yield', event.target.value)}
                />
              </label>
              <button className="ghost-button" type="submit">Salvar ficha</button>
            </form>

            {sheet.yield > 1 && (
              <div className="form-hint">
                Custo do lote: {currency.format(cost)} - custo por unidade: {currency.format(unitCost)}
              </div>
            )}

            <div className="ingredient-list">
              {sheet.ingredients.length === 0 && (
                <p className="empty-state">Ficha sem ingredientes cadastrados.</p>
              )}
              {sheet.ingredients.map((ingredient) => {
                const item = getInventoryItem(inventoryItems, ingredient)
                const ingredientCost = item.averageCost * ingredient.quantity

                return (
                  <div className="ingredient-row" key={ingredient.inventoryItemId}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{ingredient.quantity} {item.unit} x {currency.format(item.averageCost)}</span>
                    </div>
                    <div className="ingredient-actions">
                      <b>{currency.format(ingredientCost)}</b>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onRemoveIngredient(sheet.id, ingredient.inventoryItemId)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <form className="ingredient-form" onSubmit={(event) => handleAddIngredient(event, sheet)}>
              <label>
                Adicionar insumo
                <select
                  value={form.inventoryItemId}
                  onChange={(event) => updateForm(sheet.id, 'inventoryItemId', Number(event.target.value))}
                >
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  value={form.quantity}
                  onChange={(event) => updateForm(sheet.id, 'quantity', event.target.value)}
                  placeholder={selectedIngredientItem ? `0 ${selectedIngredientItem.unit}` : '0'}
                />
              </label>
              <div className="form-hint">
                {getIngredientQuantityHint(selectedIngredientItem)}
                {selectedIngredientItem?.averageCost
                  ? ` Custo base: ${currency.format(selectedIngredientItem.averageCost)} / ${selectedIngredientItem.unit}.`
                  : ''}
              </div>
              {selectedIngredientItem && Number(form.quantity) > 0 && (
                <div className="form-hint">
                  Custo previsto deste insumo: {currency.format(selectedIngredientItem.averageCost * Number(form.quantity))} para {number.format(Number(form.quantity))} {selectedIngredientItem.unit}.
                </div>
              )}
              <button className="secondary-button" type="submit">Adicionar</button>
            </form>
          </Card>
        )
      })}
    </div>
  )
}
