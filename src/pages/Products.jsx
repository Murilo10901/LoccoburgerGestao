import { useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import {
  getMarginSuggestion,
  getPortfolioMarginRanking,
  getProductMarginAnalysis,
} from '../lib/marginSimulatorRepository.js'
import { getRecipeUnitCost } from '../lib/technicalSheetRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyProductForm = {
  id: '',
  sku: '',
  name: '',
  category: 'Burger',
  type: 'Produto acabado',
  description: '',
  imageUrl: '',
  price: '',
  recipeId: '',
  availableChannels: {
    delivery: true,
    qr: true,
  },
}

function normalizeProductForm(product = emptyProductForm) {
  return {
    id: product.id ?? '',
    sku: product.sku ?? '',
    name: product.name ?? '',
    category: product.category ?? 'Burger',
    type: product.type ?? 'Produto acabado',
    description: product.description ?? '',
    imageUrl: product.imageUrl ?? '',
    price: product.price ?? '',
    recipeId: product.recipeId ?? '',
    availableChannels: {
      delivery: product.availableChannels?.delivery ?? true,
      qr: product.availableChannels?.qr ?? true,
    },
  }
}

function getProductImage(product) {
  if (product.imageUrl) return product.imageUrl
  return product.category === 'Porcao' ? '/locco-site/order-burger-drip-v1.png' : '/locco-site/hero-burger-v2.png'
}

export function Products({ inventoryItems, onCreateSheet, onDeleteProduct, onSaveProduct, onToggleProduct, products, technicalSheets }) {
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productSaving, setProductSaving] = useState(false)
  const productsWithSheet = products.filter((product) => product.recipeId)
  const [simulatorProductId, setSimulatorProductId] = useState(productsWithSheet[0]?.id ?? '')
  const [simulatedCosts, setSimulatedCosts] = useState({})
  const editingProduct = products.find((product) => product.id === Number(productForm.id))
  const simulatorProduct =
    products.find((product) => product.id === Number(simulatorProductId)) ?? productsWithSheet[0]
  const marginAnalysis = getProductMarginAnalysis({
    inventoryItems,
    product: simulatorProduct,
    simulatedCosts,
    technicalSheets,
  })
  const marginRanking = getPortfolioMarginRanking({ inventoryItems, products, technicalSheets }).slice(0, 5)

  function handleEditProduct(product) {
    setProductForm(normalizeProductForm(product))
    setProductModalOpen(true)
  }

  function handleNewProduct() {
    setProductForm(normalizeProductForm())
    setProductModalOpen(true)
  }

  function closeProductModal() {
    if (productSaving) return
    setProductForm(emptyProductForm)
    setProductModalOpen(false)
  }

  async function handleDeleteProduct(product) {
    if (!onDeleteProduct || productSaving) return
    if (!window.confirm(`Tem certeza que deseja excluir "${product.name}" do cardapio? Use inativar quando quiser apenas esconder do delivery/QR.`)) return

    setProductSaving(true)
    const result = await onDeleteProduct(product.id)
    if (result?.ok !== false && Number(productForm.id) === Number(product.id)) setProductForm(emptyProductForm)
    setProductSaving(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (productSaving || !productForm.sku.trim() || !productForm.name.trim() || Number(productForm.price) < 0) return

    setProductSaving(true)
    const result = await onSaveProduct({
      ...productForm,
      active: editingProduct?.active ?? true,
    })
    if (result?.ok !== false) {
      setProductForm(emptyProductForm)
      setProductModalOpen(false)
    }
    setProductSaving(false)
  }

  function updateProductChannel(channel, checked) {
    setProductForm((form) => ({
      ...form,
      availableChannels: {
        ...(form.availableChannels ?? emptyProductForm.availableChannels),
        [channel]: checked,
      },
    }))
  }

  function updateSimulatedCost(inventoryItemId, value) {
    setSimulatedCosts((currentCosts) => ({
      ...currentCosts,
      [inventoryItemId]: value,
    }))
  }

  function applySuggestedDiscount(ingredient, discount) {
    updateSimulatedCost(ingredient.inventoryItemId, (ingredient.averageCost * (1 - discount)).toFixed(4))
  }

  return (
    <div className="module-grid">
      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Margem</p>
            <h2>Simulador de margem por item</h2>
          </div>
          <span className="soft-label">Compra abaixo do custo medio melhora margem</span>
        </div>

        <div className="margin-simulator">
          <div className="simulator-controls">
            <label>
              Produto
              <select
                value={simulatorProduct?.id ?? ''}
                onChange={(event) => {
                  setSimulatorProductId(Number(event.target.value))
                  setSimulatedCosts({})
                }}
              >
                {productsWithSheet.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <div className="simulation-summary">
              <div>
                <span>Preco venda</span>
                <strong>{currency.format(simulatorProduct?.price ?? 0)}</strong>
              </div>
              <div>
                <span>Custo atual</span>
                <strong>{currency.format(marginAnalysis.currentCost)}</strong>
              </div>
              <div>
                <span>Margem atual</span>
                <strong>{marginAnalysis.currentMargin.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Margem simulada</span>
                <strong>{marginAnalysis.simulatedMargin.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Ganho simulado</span>
                <strong>{marginAnalysis.simulatedGain.toFixed(1)} p.p.</strong>
              </div>
            </div>
          </div>

          <div className="responsive-table margin-table">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Qtd/item</th>
                  <th>Peso no custo</th>
                  <th>Custo atual</th>
                  <th>Simular compra</th>
                  <th>Impacto</th>
                  <th>Analise</th>
                </tr>
              </thead>
              <tbody>
                {marginAnalysis.ingredients.map((ingredient) => (
                  <tr key={ingredient.inventoryItemId}>
                    <td>
                      <strong>{ingredient.name}</strong>
                      <span className="muted">Preco max. sugerido: {currency.format(ingredient.maxSuggestedPrice)} / {ingredient.unit}</span>
                    </td>
                    <td>{ingredient.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {ingredient.unit}</td>
                    <td>
                      <div className="cost-weight">
                        <span style={{ width: `${Math.min(100, ingredient.weight)}%` }} />
                      </div>
                      <b>{ingredient.weight.toFixed(1)}%</b>
                    </td>
                    <td>{currency.format(ingredient.currentContribution)}</td>
                    <td>
                      <div className="simulated-cost-cell">
                        <input
                          inputMode="decimal"
                          value={simulatedCosts[ingredient.inventoryItemId] ?? ''}
                          onChange={(event) => updateSimulatedCost(ingredient.inventoryItemId, event.target.value)}
                          placeholder={ingredient.averageCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        />
                        <button className="ghost-button" type="button" onClick={() => applySuggestedDiscount(ingredient, 0.08)}>
                          -8%
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong>{currency.format(ingredient.simulatedContribution)}</strong>
                      {ingredient.saving > 0 && <span className="margin-gain">Economia {currency.format(ingredient.saving)}</span>}
                    </td>
                    <td>{getMarginSuggestion(ingredient)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prioridade</p>
            <h2>Itens com menor margem</h2>
          </div>
          <span className="soft-label">Revisar preco ou compra</span>
        </div>
        <div className="list-stack">
          {marginRanking.map((product) => (
            <div className="list-row" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <span>Custo {currency.format(product.cost)} - venda {currency.format(product.price)}</span>
              </div>
              <b>{product.margin.toFixed(1)}%</b>
            </div>
          ))}
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cardapio</p>
            <h2>Produtos e precos</h2>
          </div>
          <button className="primary-button" type="button" onClick={handleNewProduct}>
            Novo produto
          </button>
        </div>

        <div className="product-list">
          {products.map((product) => {
            const recipe = technicalSheets.find((sheet) => sheet.id === product.recipeId)
            const cost = getRecipeUnitCost(recipe, inventoryItems)
            const margin = product.price ? ((product.price - cost) / product.price) * 100 : 0

            return (
              <div className="product-row product-row-rich" key={product.id}>
                <div className="product-thumb">
                  {product.imageUrl ? (
                    <img src={getProductImage(product)} alt="" />
                  ) : (
                    product.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.sku} - {product.category} - {product.type}</span>
                  {product.description && <small>{product.description}</small>}
                  <small className="product-channel-note">
                    {(product.availableChannels?.delivery ?? true) ? 'Delivery' : 'Delivery oculto'} · {(product.availableChannels?.qr ?? true) ? 'QR mesas' : 'QR oculto'}
                  </small>
                </div>
                <div className="metric-cell">
                  <span>Venda</span>
                  <b>{currency.format(product.price)}</b>
                </div>
                <div className="metric-cell">
                  <span>Custo</span>
                  <b>{currency.format(cost)}</b>
                </div>
                <div className="metric-cell">
                  <span>Margem</span>
                  <b>{margin.toFixed(1)}%</b>
                </div>
                <StatusBadge status={product.active ? 'ativo' : 'inativo'} />
                <div className="row-actions">
                  {!product.recipeId && (
                    <button className="secondary-button" type="button" onClick={() => onCreateSheet(product.id)}>
                      Criar ficha
                    </button>
                  )}
                  <button className="ghost-button" type="button" onClick={() => handleEditProduct(product)}>
                    Editar
                  </button>
                  <button className="ghost-button" disabled={productSaving} type="button" onClick={() => onToggleProduct(product.id)}>
                    {product.active ? 'Inativar' : 'Ativar'}
                  </button>
                  {onDeleteProduct && (
                    <button className="ghost-button danger-button" disabled={productSaving} type="button" onClick={() => handleDeleteProduct(product)}>
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {productModalOpen && (
        <div className="product-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
          <form className="product-editor-modal entry-form" onSubmit={handleSubmit}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Cardapio</p>
                <h2 id="product-editor-title">{editingProduct ? 'Editar produto' : 'Novo produto'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeProductModal}>
                Fechar
              </button>
            </div>

            <div className="product-editor-body">
              <div className="product-image-preview">
                <img src={getProductImage(productForm)} alt="" />
                <span>Previa da imagem no cardapio</span>
              </div>

              <div className="product-editor-fields">
                <div className="form-grid">
                  <label>
                    SKU
                    <input
                      value={productForm.sku}
                      onChange={(event) => setProductForm((form) => ({ ...form, sku: event.target.value }))}
                      placeholder="BUR-003"
                    />
                  </label>
                  <label>
                    Preco
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={productForm.price}
                      onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))}
                      placeholder="0,00"
                    />
                  </label>
                </div>

                <label>
                  Nome
                  <input
                    value={productForm.name}
                    onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Nome do produto"
                  />
                </label>

                <label>
                  Link da imagem
                  <input
                    value={productForm.imageUrl}
                    onChange={(event) => setProductForm((form) => ({ ...form, imageUrl: event.target.value }))}
                    placeholder="/locco-site/hero-burger-v2.png ou URL da imagem"
                  />
                </label>

                <label>
                  Descricao no cardapio
                  <textarea
                    rows="3"
                    value={productForm.description}
                    onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))}
                    placeholder="Ex.: Pao brioche, blend artesanal, queijo, bacon e maionese da casa."
                  />
                </label>

                <div className="form-grid">
                  <label>
                    Categoria
                    <input
                      value={productForm.category}
                      onChange={(event) => setProductForm((form) => ({ ...form, category: event.target.value }))}
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={productForm.type}
                      onChange={(event) => setProductForm((form) => ({ ...form, type: event.target.value }))}
                    >
                      <option>Produto acabado</option>
                      <option>Combo</option>
                      <option>Adicional</option>
                      <option>Bebida</option>
                    </select>
                  </label>
                </div>

                <label>
                  Ficha tecnica
                  <select
                    value={productForm.recipeId}
                    onChange={(event) => setProductForm((form) => ({ ...form, recipeId: event.target.value }))}
                  >
                    <option value="">Sem ficha vinculada</option>
                    <option value="new-sheet">Criar ficha tecnica vazia</option>
                    {technicalSheets.map((sheet) => {
                      const product = products.find((item) => item.id === sheet.productId)
                      return (
                        <option key={sheet.id} value={sheet.id}>
                          {product?.name ?? `Ficha ${sheet.id}`}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <div className="product-channel-grid" aria-label="Onde esse produto aparece">
                  <label>
                    <input
                      checked={productForm.availableChannels?.delivery ?? true}
                      type="checkbox"
                      onChange={(event) => updateProductChannel('delivery', event.target.checked)}
                    />
                    <span>
                      <strong>Mostrar no delivery</strong>
                      <small>Produto aparece no app de entrega.</small>
                    </span>
                  </label>
                  <label>
                    <input
                      checked={productForm.availableChannels?.qr ?? true}
                      type="checkbox"
                      onChange={(event) => updateProductChannel('qr', event.target.checked)}
                    />
                    <span>
                      <strong>Mostrar no QR das mesas</strong>
                      <small>Produto aparece para clientes no restaurante.</small>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions product-editor-actions">
              <button className="primary-button" disabled={productSaving} type="submit">
                {productSaving ? 'Salvando...' : 'Salvar produto'}
              </button>
              <button className="ghost-button" type="button" onClick={closeProductModal}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resumo</p>
            <h2>Estrutura do cardapio</h2>
          </div>
        </div>
        <div className="summary-stack">
          <div>
            <span>Produtos ativos</span>
            <strong>{products.filter((product) => product.active).length}</strong>
          </div>
          <div>
            <span>Com ficha tecnica</span>
            <strong>{products.filter((product) => product.recipeId).length}</strong>
          </div>
          <div>
            <span>Preco medio</span>
            <strong>{currency.format(products.reduce((total, product) => total + product.price, 0) / products.length)}</strong>
          </div>
        </div>
      </Card>
    </div>
  )
}
