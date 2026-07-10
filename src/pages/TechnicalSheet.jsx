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
  onDeleteSheet,
  onRemoveIngredient,
  onUpdateSheet,
  products,
  technicalSheets,
}) {
  const [ingredientForms, setIngredientForms] = useState({})
  const [sheetForms, setSheetForms] = useState({})
  const [savingAction, setSavingAction] = useState(null)
  const [sheetMessage, setSheetMessage] = useState(null)
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

  async function handleUpdateSheet(event, sheet) {
    event.preventDefault()
    if (savingAction) return

    const form = getSheetForm(sheet)
    setSavingAction(`settings-${sheet.id}`)

    try {
      const [result] = await Promise.all([
        Promise.resolve(onUpdateSheet(sheet.id, {
          prepTime: Number(form.prepTime),
          yield: Number(form.yield),
        })),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      setSheetMessage({
        sheetId: sheet.id,
        ok: result?.ok !== false,
        text: result?.message ?? 'Ficha tecnica salva.',
      })
    } catch (error) {
      setSheetMessage({ sheetId: sheet.id, ok: false, text: error?.message ?? 'Nao foi possivel salvar a ficha.' })
    } finally {
      setSavingAction(null)
    }
  }

  async function handleAddIngredient(event, sheet) {
    event.preventDefault()
    if (savingAction) return

    const form = getForm(sheet)
    const quantity = Number(form.quantity)
    const inventoryItemId = Number(form.inventoryItemId)

    if (!inventoryItemId || quantity <= 0) return

    setSavingAction(`ingredient-${sheet.id}`)

    try {
      const [result] = await Promise.all([
        Promise.resolve(onAddIngredient(sheet.id, { inventoryItemId, quantity })),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      const ok = result?.ok !== false
      setSheetMessage({
        sheetId: sheet.id,
        ok,
        text: result?.message ?? 'Ingrediente adicionado na ficha tecnica.',
      })
      if (ok) {
        setIngredientForms((currentForms) => ({
          ...currentForms,
          [sheet.id]: {
            ...form,
            quantity: '',
          },
        }))
      }
    } catch (error) {
      setSheetMessage({ sheetId: sheet.id, ok: false, text: error?.message ?? 'Nao foi possivel adicionar o ingrediente.' })
    } finally {
      setSavingAction(null)
    }
  }

  async function handleRemoveIngredient(sheet, inventoryItemId) {
    if (savingAction) return
    setSavingAction(`remove-${sheet.id}-${inventoryItemId}`)

    try {
      const [result] = await Promise.all([
        Promise.resolve(onRemoveIngredient(sheet.id, inventoryItemId)),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      setSheetMessage({
        sheetId: sheet.id,
        ok: result?.ok !== false,
        text: result?.message ?? 'Ingrediente removido da ficha tecnica.',
      })
    } catch (error) {
      setSheetMessage({ sheetId: sheet.id, ok: false, text: error?.message ?? 'Nao foi possivel remover o ingrediente.' })
    } finally {
      setSavingAction(null)
    }
  }

  async function handleCreateSheet(product) {
    if (savingAction) return
    setSavingAction(`create-${product.id}`)

    try {
      const [result] = await Promise.all([
        Promise.resolve(onCreateSheet(product.id)),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      setSheetMessage({
        sheetId: 'new',
        ok: result?.ok !== false,
        text: result?.message ?? `Ficha tecnica criada para ${product.name}.`,
      })
    } catch (error) {
      setSheetMessage({ sheetId: 'new', ok: false, text: error?.message ?? 'Nao foi possivel criar a ficha tecnica.' })
    } finally {
      setSavingAction(null)
    }
  }

  async function handleDeleteSheet(sheet, product) {
    if (savingAction) return
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a ficha tecnica de ${product?.name ?? 'este produto'}?\n\nEssa acao remove os insumos da ficha e o produto deixa de dar baixa automatica ate receber uma nova ficha. Nao da para reverter automaticamente.`,
    )
    if (!confirmed) return

    setSavingAction(`delete-${sheet.id}`)

    try {
      const [result] = await Promise.all([
        Promise.resolve(onDeleteSheet?.(sheet.id)),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      setSheetMessage({
        sheetId: 'new',
        ok: result?.ok !== false,
        text: result?.message ?? 'Ficha tecnica excluida.',
      })
    } catch (error) {
      setSheetMessage({ sheetId: sheet.id, ok: false, text: error?.message ?? 'Nao foi possivel excluir a ficha tecnica.' })
    } finally {
      setSavingAction(null)
    }
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
          {sheetMessage?.sheetId === 'new' && (
            <div className={sheetMessage.ok ? 'form-hint' : 'form-alert'}>{sheetMessage.text}</div>
          )}
          <div className="list-stack">
            {productsWithoutSheet.map((product) => (
              <div className="list-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.sku} - {product.category} - {currency.format(product.price)}</span>
                </div>
                <button
                  className="secondary-button"
                  disabled={savingAction === `create-${product.id}`}
                  type="button"
                  onClick={() => handleCreateSheet(product)}
                >
                  {savingAction === `create-${product.id}` ? 'Criando...' : 'Criar ficha'}
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
              <div className="recipe-heading-actions">
                <StatusBadge status={product.active ? 'com-ficha' : 'inativo'} />
                <button
                  className="ghost-button danger-button"
                  disabled={savingAction === `delete-${sheet.id}`}
                  type="button"
                  onClick={() => handleDeleteSheet(sheet, product)}
                >
                  {savingAction === `delete-${sheet.id}` ? 'Excluindo...' : 'Excluir ficha'}
                </button>
              </div>
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

            {sheetMessage?.sheetId === sheet.id && (
              <div className={sheetMessage.ok ? 'form-hint' : 'form-alert'}>{sheetMessage.text}</div>
            )}

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
              <button className="ghost-button" disabled={savingAction === `settings-${sheet.id}`} type="submit">
                {savingAction === `settings-${sheet.id}` ? 'Salvando...' : 'Salvar ficha'}
              </button>
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
                        disabled={savingAction === `remove-${sheet.id}-${ingredient.inventoryItemId}`}
                        type="button"
                        onClick={() => handleRemoveIngredient(sheet, ingredient.inventoryItemId)}
                      >
                        {savingAction === `remove-${sheet.id}-${ingredient.inventoryItemId}` ? 'Removendo...' : 'Remover'}
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
              <button className="secondary-button" disabled={savingAction === `ingredient-${sheet.id}`} type="submit">
                {savingAction === `ingredient-${sheet.id}` ? 'Adicionando...' : 'Adicionar'}
              </button>
            </form>
          </Card>
        )
      })}
    </div>
  )
}
