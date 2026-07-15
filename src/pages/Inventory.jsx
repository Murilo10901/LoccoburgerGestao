import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { useState } from 'react'
import {
  applyStockEntry,
  getStockStatus,
  getSuggestedPurchaseMaxPrice,
  getSuggestedPurchaseQuantity,
  parseNumericInput,
} from '../lib/inventoryRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR')

const emptyItemForm = {
  id: '',
  name: '',
  category: '',
  unit: 'un',
  currentStock: 0,
  minStock: 0,
  averageCost: 0,
  supplier: '',
}

function normalizeSearchText(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesInventorySearch(item, searchTerm) {
  if (!searchTerm) return true
  return [
    item.name,
    item.category,
    item.unit,
    item.supplier,
  ].some((field) => normalizeSearchText(field).includes(searchTerm))
}

function compareInventoryItems(firstItem, secondItem) {
  const firstCategory = String(firstItem?.category ?? '')
  const secondCategory = String(secondItem?.category ?? '')
  if (firstCategory !== secondCategory) return firstCategory.localeCompare(secondCategory, 'pt-BR')
  return String(firstItem?.name ?? '').localeCompare(String(secondItem?.name ?? ''), 'pt-BR')
}

export function Inventory({ inventoryItems, onSaveInventoryItem, onStockAdjustment, onStockEntry, stockAdjustments = [] }) {
  const [entryForm, setEntryForm] = useState({
    inventoryItemId: inventoryItems[0]?.id ?? '',
    quantity: '',
    unitCost: '',
    supplier: '',
  })
  const [adjustmentForm, setAdjustmentForm] = useState({
    inventoryItemId: inventoryItems[0]?.id ?? '',
    quantity: '',
    reason: '',
  })
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [entryMessage, setEntryMessage] = useState(null)
  const [adjustmentMessage, setAdjustmentMessage] = useState(null)
  const [itemMessage, setItemMessage] = useState(null)
  const [itemEditorOpen, setItemEditorOpen] = useState(false)
  const [itemSaving, setItemSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('Todas')
  const [inventorySearch, setInventorySearch] = useState('')

  const stockValue = inventoryItems.reduce((total, item) => total + item.currentStock * item.averageCost, 0)
  const lowItems = inventoryItems.filter((item) => getStockStatus(item) !== 'saudavel')
  const criticalItems = inventoryItems.filter((item) => getStockStatus(item) === 'critico')
  const selectedItem = inventoryItems.find((item) => item.id === Number(entryForm.inventoryItemId))
  const selectedAdjustmentItem = inventoryItems.find((item) => item.id === Number(adjustmentForm.inventoryItemId))
  const editingItem = inventoryItems.find((item) => item.id === Number(itemForm.id))
  const inventoryCategories = Array.from(
    new Set(inventoryItems.map((item) => item.category).filter(Boolean)),
  ).sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory, 'pt-BR'))
  const inventorySearchTerm = normalizeSearchText(inventorySearch)
  const visibleInventoryItems = inventoryItems
    .filter((item) => categoryFilter === 'Todas' || item.category === categoryFilter)
    .filter((item) => matchesInventorySearch(item, inventorySearchTerm))
    .sort(compareInventoryItems)

  function handleSubmit(event) {
    event.preventDefault()
    const quantity = parseNumericInput(entryForm.quantity)
    const unitCost = parseNumericInput(entryForm.unitCost)

    if (!selectedItem || !entryForm.inventoryItemId || !Number.isFinite(quantity) || !Number.isFinite(unitCost) || quantity <= 0 || unitCost <= 0) {
      setEntryMessage({ ok: false, text: 'Informe insumo, quantidade e custo unitario validos para atualizar o estoque.' })
      return
    }

    const stockEntry = {
      inventoryItemId: Number(entryForm.inventoryItemId),
      quantity,
      unitCost,
      supplier: entryForm.supplier.trim(),
    }
    const previewItem = applyStockEntry(selectedItem, stockEntry)

    onStockEntry(stockEntry)

    setEntryMessage({
      ok: true,
      text: `Entrada registrada. Custo medio atualizado de ${currency.format(selectedItem.averageCost)} para ${currency.format(previewItem.averageCost)}.`,
    })
    setEntryForm((currentForm) => ({
      ...currentForm,
      quantity: '',
      unitCost: '',
      supplier: '',
    }))
  }

  function handleEditItem(item) {
    setItemForm({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      averageCost: item.averageCost,
      supplier: item.supplier,
    })
    setItemMessage({ ok: true, text: `Editando ${item.name}. Ajuste estoque, minimo, custo ou fornecedor e clique em Salvar.` })
    setItemEditorOpen(true)
  }

  function handleNewItem() {
    setItemForm(emptyItemForm)
    setItemMessage({ ok: true, text: 'Cadastre um novo insumo para usar no estoque e nas fichas tecnicas.' })
    setItemEditorOpen(true)
  }

  async function handleSaveItem(event) {
    event.preventDefault()
    if (itemSaving) return
    const currentStock = parseNumericInput(itemForm.currentStock)
    const minStock = parseNumericInput(itemForm.minStock)
    const averageCost = parseNumericInput(itemForm.averageCost)

    if (!itemForm.name.trim() || !itemForm.category.trim() || !itemForm.unit.trim()) {
      setItemMessage({ ok: false, text: 'Preencha nome, categoria e unidade para salvar o insumo.' })
      return
    }

    if (!Number.isFinite(currentStock) || !Number.isFinite(minStock) || !Number.isFinite(averageCost) || minStock < 0 || averageCost < 0) {
      setItemMessage({ ok: false, text: 'Informe estoque, minimo e custo medio com numeros validos. O estoque atual pode ficar negativo em ajuste/teste.' })
      return
    }

    setItemSaving(true)

    try {
      const [result] = await Promise.all([
        Promise.resolve(onSaveInventoryItem({
          ...itemForm,
          currentStock,
          minStock,
          averageCost,
        })),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ])
      const ok = result?.ok !== false
      setItemMessage({
        ok,
        text: result?.message ?? `${itemForm.name} salvo no estoque.`,
      })
      if (ok) {
        setItemForm(emptyItemForm)
        setItemEditorOpen(false)
      }
    } catch (error) {
      setItemMessage({ ok: false, text: error?.message ?? 'Nao foi possivel salvar este insumo.' })
    } finally {
      setItemSaving(false)
    }
  }

  function handleAdjustmentSubmit(event) {
    event.preventDefault()
    const quantity = parseNumericInput(adjustmentForm.quantity)

    if (!selectedAdjustmentItem || !Number.isFinite(quantity) || quantity <= 0) {
      setAdjustmentMessage({ ok: false, text: 'Informe insumo e quantidade validos para registrar a perda.' })
      return
    }

    const result = onStockAdjustment({
      inventoryItemId: Number(adjustmentForm.inventoryItemId),
      quantity,
      reason: adjustmentForm.reason.trim(),
    })

    if (!result) {
      setAdjustmentMessage({ ok: false, text: 'Nao foi possivel registrar este ajuste.' })
      return
    }

    setAdjustmentMessage({
      ok: true,
      text: `${result.code} registrado como perda. Valor sensibilizado no CMV: ${currency.format(result.totalCost)}.`,
    })
    setAdjustmentForm((currentForm) => ({
      ...currentForm,
      quantity: '',
      reason: '',
    }))
  }

  return (
    <div className="module-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Valor em estoque</span>
          <strong>{currency.format(stockValue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Insumos cadastrados</span>
          <strong>{inventoryItems.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Abaixo do minimo</span>
          <strong>{lowItems.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Criticos</span>
          <strong>{criticalItems.length}</strong>
        </Card>
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Insumos</p>
            <h2>Controle de estoque</h2>
            <small>Clique em <strong>Editar estoque</strong> na linha do insumo para alterar quantidade, minimo, custo ou fornecedor.</small>
          </div>
          <div className="row-actions">
            <span className="soft-label">Atualiza custo medio</span>
            <button className="secondary-button" type="button" onClick={handleNewItem}>
              Novo insumo
            </button>
          </div>
        </div>

        <div className="admin-filter-strip">
          <label className="admin-filter-field">
            Filtrar categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="Todas">Todas as categorias</option>
              {inventoryCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field admin-filter-field-wide">
            Buscar insumo
            <input
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              placeholder="Nome, categoria, unidade ou fornecedor"
            />
          </label>
          <span className="filter-result-pill">
            {visibleInventoryItems.length} de {inventoryItems.length} insumo(s)
          </span>
        </div>

        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Categoria</th>
                <th>Estoque</th>
                <th>Minimo</th>
                <th>Custo medio</th>
                  <th>Fornecedor</th>
                  <th>Status</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
              {visibleInventoryItems.length === 0 && (
                <tr>
                  <td colSpan="8">Nenhum insumo encontrado nesse filtro.</td>
                </tr>
              )}
              {visibleInventoryItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{number.format(item.currentStock)} {item.unit}</td>
                  <td>{number.format(item.minStock)} {item.unit}</td>
                  <td>{currency.format(item.averageCost)} / {item.unit}</td>
                  <td>{item.supplier}</td>
                  <td><StatusBadge status={getStockStatus(item)} /></td>
                  <td>
                    <button className="ghost-button" type="button" onClick={() => handleEditItem(item)}>
                      Editar estoque
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {itemEditorOpen && (
      <div className="inventory-editor-overlay" role="dialog" aria-modal="true" aria-label="Editar estoque">
      <Card className="inventory-editor-card modal-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>{editingItem ? 'Editar insumo' : 'Novo insumo'}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={() => setItemEditorOpen(false)}>
            Fechar
          </button>
        </div>

        <form className="entry-form" onSubmit={handleSaveItem}>
          <label>
            Nome
            <input
              value={itemForm.name}
              onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))}
              placeholder="Nome do insumo"
            />
          </label>
          <div className="form-grid">
            <label>
              Categoria
              <input
                value={itemForm.category}
                onChange={(event) => setItemForm((form) => ({ ...form, category: event.target.value }))}
                placeholder="Padaria"
              />
            </label>
            <label>
              Unidade
              <input
                value={itemForm.unit}
                onChange={(event) => setItemForm((form) => ({ ...form, unit: event.target.value }))}
                placeholder="un, g, ml"
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Estoque atual
              <input
                inputMode="decimal"
                value={itemForm.currentStock}
                onChange={(event) => setItemForm((form) => ({ ...form, currentStock: event.target.value }))}
              />
            </label>
            <label>
              Estoque minimo
              <input
                inputMode="decimal"
                value={itemForm.minStock}
                onChange={(event) => setItemForm((form) => ({ ...form, minStock: event.target.value }))}
              />
            </label>
          </div>
          <label>
            Custo medio
            <input
              inputMode="decimal"
              value={itemForm.averageCost}
              onChange={(event) => setItemForm((form) => ({ ...form, averageCost: event.target.value }))}
            />
          </label>
          <label>
            Fornecedor
            <input
              value={itemForm.supplier}
              onChange={(event) => setItemForm((form) => ({ ...form, supplier: event.target.value }))}
              placeholder="Fornecedor principal"
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={itemSaving} type="submit">
              {itemSaving ? 'Salvando no estoque...' : 'Salvar insumo'}
            </button>
            {editingItem && (
              <button className="ghost-button" disabled={itemSaving} type="button" onClick={() => setItemForm(emptyItemForm)}>
                Cancelar
              </button>
            )}
          </div>
          {itemMessage && (
            <div className={itemMessage.ok ? 'form-hint' : 'form-alert'}>{itemMessage.text}</div>
          )}
        </form>
      </Card>
      </div>
      )}

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historico</p>
            <h2>Ajustes e perdas</h2>
          </div>
          <span className="soft-label">{stockAdjustments.length} lancamentos</span>
        </div>
        <div className="list-stack">
          {stockAdjustments.length === 0 ? (
            <p className="empty-state">Nenhum ajuste de estoque registrado.</p>
          ) : (
            stockAdjustments.slice(0, 8).map((adjustment) => (
              <div className="list-row" key={adjustment.id}>
                <div>
                  <strong>{adjustment.code} - {adjustment.itemName}</strong>
                  <span>{adjustment.createdAt} {adjustment.time} - {adjustment.reason}</span>
                  <span>{number.format(adjustment.quantity)} {adjustment.unit} como perda</span>
                </div>
                <b>{currency.format(adjustment.totalCost)}</b>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ajuste</p>
            <h2>Perda de estoque</h2>
          </div>
          <span className="soft-label">Entra no CMV</span>
        </div>

        <form className="entry-form" onSubmit={handleAdjustmentSubmit}>
          <label>
            Insumo
            <select
              value={adjustmentForm.inventoryItemId}
              onChange={(event) =>
                setAdjustmentForm((currentForm) => ({ ...currentForm, inventoryItemId: Number(event.target.value) }))
              }
            >
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Quantidade perdida
            <input
              inputMode="decimal"
              value={adjustmentForm.quantity}
              onChange={(event) =>
                setAdjustmentForm((currentForm) => ({ ...currentForm, quantity: event.target.value }))
              }
              placeholder={selectedAdjustmentItem ? selectedAdjustmentItem.unit : 'un'}
            />
          </label>
          <label>
            Motivo
            <input
              value={adjustmentForm.reason}
              onChange={(event) =>
                setAdjustmentForm((currentForm) => ({ ...currentForm, reason: event.target.value }))
              }
              placeholder="Ex.: perda, vencimento, quebra, degustacao"
            />
          </label>
          {selectedAdjustmentItem && (
            <div className="form-hint">
              Custo medio atual: {currency.format(selectedAdjustmentItem.averageCost)} / {selectedAdjustmentItem.unit}. Valor previsto: {currency.format(selectedAdjustmentItem.averageCost * Number(parseNumericInput(adjustmentForm.quantity) || 0))}.
            </div>
          )}
          {adjustmentMessage && (
            <div className={adjustmentMessage.ok ? 'form-hint' : 'form-alert'}>{adjustmentMessage.text}</div>
          )}
          <button className="primary-button" type="submit">Registrar perda e ajustar estoque</button>
        </form>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Movimentacao</p>
            <h2>Entrada de mercadoria</h2>
          </div>
        </div>

        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            Insumo
            <select
              value={entryForm.inventoryItemId}
              onChange={(event) =>
                setEntryForm((currentForm) => ({ ...currentForm, inventoryItemId: Number(event.target.value) }))
              }
            >
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Quantidade
              <input
                inputMode="decimal"
                value={entryForm.quantity}
                onChange={(event) => setEntryForm((currentForm) => ({ ...currentForm, quantity: event.target.value }))}
                placeholder={selectedItem ? selectedItem.unit : 'un'}
              />
            </label>
            <label>
              Custo unitario
              <input
                inputMode="decimal"
                value={entryForm.unitCost}
                onChange={(event) => setEntryForm((currentForm) => ({ ...currentForm, unitCost: event.target.value }))}
                placeholder="0,00"
              />
            </label>
          </div>

          <label>
            Fornecedor
            <input
              type="text"
              value={entryForm.supplier}
              onChange={(event) => setEntryForm((currentForm) => ({ ...currentForm, supplier: event.target.value }))}
              placeholder={selectedItem?.supplier ?? 'Fornecedor'}
            />
          </label>

          {selectedItem && (
            <div className="form-hint">
              Estoque atual: {number.format(selectedItem.currentStock)} {selectedItem.unit} - custo medio {currency.format(selectedItem.averageCost)}
            </div>
          )}

          {entryMessage && (
            <div className={entryMessage.ok ? 'form-hint' : 'form-alert'}>{entryMessage.text}</div>
          )}

          <button className="primary-button" type="submit">Registrar entrada e atualizar custo medio</button>
        </form>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reposicao</p>
            <h2>Lista de compra sugerida</h2>
          </div>
        </div>
        <div className="list-stack">
          {lowItems.map((item) => {
            const suggestedQuantity = getSuggestedPurchaseQuantity(item)
            const suggestedMaxPrice = getSuggestedPurchaseMaxPrice(item)
            return (
              <div className="list-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>Comprar {number.format(Math.ceil(suggestedQuantity))} {item.unit}</span>
                  <span>Preco max. {currency.format(suggestedMaxPrice)} / {item.unit}</span>
                </div>
                <StatusBadge status={getStockStatus(item)} />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
