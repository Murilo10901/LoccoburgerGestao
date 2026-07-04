import { useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import {
  getSuggestedPurchaseMaxPrice,
  getSuggestedPurchasePriceStatus,
  getSuggestedPurchaseQuantity,
} from '../lib/inventoryRepository.js'
import { fetchFiscalCouponFromSefaz, normalizeFiscalText } from '../lib/fiscalCouponRepository.js'
import { getTodayLocalDateKey } from '../lib/dateUtils.js'
import { createPurchaseSuggestion } from '../lib/purchaseRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR')

function getPurchaseSuggestionRows(items) {
  return items.map((item) => {
    const suggestedQuantity = getSuggestedPurchaseQuantity(item)
    const suggestedMaxPrice = getSuggestedPurchaseMaxPrice(item)

    return {
      id: item.id,
      name: item.name,
      currentStock: item.currentStock,
      minStock: item.minStock,
      averageCost: item.averageCost,
      unit: item.unit,
      suggestedQuantity,
      suggestedMaxPrice,
      estimatedTotal: suggestedQuantity * suggestedMaxPrice,
      supplier: item.supplier,
    }
  })
}

function getExportFileName(extension) {
  const date = getTodayLocalDateKey()
  return `loccoburger-lista-compras-${date}.${extension}`
}

function formatCsvValue(value) {
  const normalizedValue = String(value ?? '').replace(/"/g, '""')
  return `"${normalizedValue}"`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function guessInventoryItemId(fiscalName, inventoryItems) {
  const normalizedFiscalName = normalizeFiscalText(fiscalName)

  return inventoryItems.find((item) => normalizedFiscalName.includes(normalizeFiscalText(item.name)))?.id
    ?? inventoryItems.find((item) => normalizeFiscalText(item.name).includes(normalizedFiscalName.slice(0, 8)))?.id
    ?? inventoryItems[0]?.id
    ?? ''
}

export function Purchases({
  inventoryItems,
  onCancelPurchaseOrder,
  onCreatePurchaseOrder,
  onImportFiscalCoupon,
  onReceivePurchaseOrder,
  purchaseOrders,
}) {
  const lowItems = inventoryItems.filter((item) => item.currentStock <= item.minStock)
  const purchaseSuggestionRows = getPurchaseSuggestionRows(lowItems)
  const pendingOrders = purchaseOrders.filter((order) => order.status === 'aberto')
  const receivedOrders = purchaseOrders.filter((order) => order.status === 'recebido')
  const pendingValue = pendingOrders.reduce((total, order) => total + order.total, 0)
  const [qrInput, setQrInput] = useState('')
  const [couponDraft, setCouponDraft] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState({
    inventoryItemId: lowItems[0]?.id ?? inventoryItems[0]?.id ?? '',
    quantity: '',
    unitCost: '',
    supplier: '',
  })
  const [exportMessage, setExportMessage] = useState('')
  const [purchaseMessage, setPurchaseMessage] = useState(null)

  const selectedItem = inventoryItems.find((item) => item.id === Number(purchaseForm.inventoryItemId))
  const suggestedMaxPrice = selectedItem ? getSuggestedPurchaseMaxPrice(selectedItem) : 0
  const priceStatus = selectedItem ? getSuggestedPurchasePriceStatus(purchaseForm.unitCost, selectedItem) : 'neutro'

  async function readCouponFromValue(value) {
    const result = await fetchFiscalCouponFromSefaz(value)

    if (!result.ok) {
      setCouponDraft(null)
      setPurchaseMessage({ ok: false, text: result.message })
      return
    }

    setCouponDraft({
      ...result.draft,
      items: result.draft.items.map((item) => ({
        ...item,
        inventoryItemId: item.suggestedInventoryId || guessInventoryItemId(item.fiscalName, inventoryItems),
      })),
    })
    setPurchaseMessage({ ok: true, text: result.message })
  }

  async function handleReadCoupon(event) {
    event.preventDefault()
    setCouponLoading(true)
    try {
      await readCouponFromValue(qrInput)
    } finally {
      setCouponLoading(false)
    }
  }

  async function handleQrImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!('BarcodeDetector' in window)) {
      setPurchaseMessage({ ok: false, text: 'Este navegador nao conseguiu ler QR Code pela imagem. Cole a URL do cupom no campo acima.' })
      return
    }

    setCouponLoading(true)
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const bitmap = await createImageBitmap(file)
      const codes = await detector.detect(bitmap)
      const value = codes[0]?.rawValue

      if (!value) {
        setPurchaseMessage({ ok: false, text: 'Nao encontrei QR Code nessa imagem.' })
        return
      }

      setQrInput(value)
      await readCouponFromValue(value)
    } catch (error) {
      setPurchaseMessage({ ok: false, text: `Nao foi possivel ler a imagem do QR Code: ${error.message}` })
    } finally {
      setCouponLoading(false)
      event.target.value = ''
    }
  }

  function updateCouponItem(index, field, value) {
    setCouponDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }))
  }

  function confirmCouponImport() {
    if (!couponDraft) return
    const validItems = couponDraft.items
      .map((item) => ({
        inventoryItemId: Number(item.inventoryItemId),
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      }))
      .filter((item) => item.inventoryItemId && item.quantity > 0 && item.unitCost > 0)

    if (validItems.length === 0) {
      setPurchaseMessage({ ok: false, text: 'Revise os itens importados antes de confirmar a entrada.' })
      return
    }

    onImportFiscalCoupon({
      fiscalKey: couponDraft.fiscalKey,
      supplier: couponDraft.supplier,
      total: validItems.reduce((total, item) => total + item.quantity * item.unitCost, 0),
      items: validItems,
    })

    setCouponDraft(null)
    setQrInput('')
    setPurchaseMessage({ ok: true, text: 'Entrada do cupom confirmada no estoque.' })
  }

  function createSuggestedPurchase(item) {
    const suggestion = createPurchaseSuggestion(item)
    const newOrder = onCreatePurchaseOrder({
      inventoryItemId: Number(suggestion.inventoryItemId),
      quantity: Number(suggestion.quantity),
      unitCost: Number(suggestion.unitCost),
      supplier: suggestion.supplier,
    })

    if (!newOrder) {
      setPurchaseMessage({ ok: false, text: 'Nao foi possivel criar o pedido sugerido.' })
      return
    }

    setPurchaseMessage({ ok: true, text: `${newOrder.code} criado para ${newOrder.itemName}.` })
    setPurchaseForm(createPurchaseSuggestion(item))
  }

  function exportSuggestedPurchasesCsv() {
    const headers = [
      'Produto',
      'Estoque atual',
      'Estoque minimo',
      'Unidade',
      'Quantidade sugerida',
      'Preco maximo',
      'Total estimado',
      'Fornecedor',
    ]
    const rows = purchaseSuggestionRows.map((item) => [
      item.name,
      number.format(item.currentStock),
      number.format(item.minStock),
      item.unit,
      number.format(item.suggestedQuantity),
      currency.format(item.suggestedMaxPrice),
      currency.format(item.estimatedTotal),
      item.supplier,
    ])
    const csv = [headers, ...rows].map((row) => row.map(formatCsvValue).join(';')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getExportFileName('csv')
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportMessage('CSV gerado. Verifique a pasta de downloads do navegador.')
  }

  function exportSuggestedPurchasesPdf() {
    const printWindow = window.open('', '_blank', 'width=960,height=720')
    if (!printWindow) {
      setExportMessage('O navegador bloqueou a janela do PDF. Autorize pop-ups para gerar o arquivo.')
      return
    }

    const rows = purchaseSuggestionRows
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${number.format(item.currentStock)} ${escapeHtml(item.unit)}</td>
          <td>${number.format(item.minStock)} ${escapeHtml(item.unit)}</td>
          <td>${number.format(item.suggestedQuantity)} ${escapeHtml(item.unit)}</td>
          <td>${currency.format(item.suggestedMaxPrice)} / ${escapeHtml(item.unit)}</td>
          <td>${currency.format(item.estimatedTotal)}</td>
          <td>${escapeHtml(item.supplier)}</td>
        </tr>
      `)
      .join('')

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Lista de compras sugerida</title>
          <style>
            body {
              margin: 32px;
              color: #2d160f;
              font-family: Arial, sans-serif;
            }
            h1 {
              margin: 0;
              font-size: 24px;
            }
            p {
              margin: 8px 0 22px;
              color: #6f4934;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              color: #7a3b1a;
              background: #fff0d3;
              text-align: left;
            }
            th,
            td {
              padding: 10px;
              border: 1px solid #edcfb5;
              font-size: 12px;
            }
            tfoot td {
              font-weight: 800;
              background: #fff8ef;
            }
          </style>
        </head>
        <body>
          <h1>LoccoBurger Gestao - Lista de compras sugerida</h1>
          <p>Preco maximo sugerido igual ao custo medio atual. Compras abaixo desse valor melhoram a margem.</p>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque atual</th>
                <th>Estoque minimo</th>
                <th>Qtd sugerida</th>
                <th>Preco max.</th>
                <th>Total estimado</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="5">Total estimado</td>
                <td>${currency.format(purchaseSuggestionRows.reduce((total, item) => total + item.estimatedTotal, 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      setExportMessage('PDF aberto. Use Salvar como PDF na janela de impressao.')
    }, 300)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!selectedItem || Number(purchaseForm.quantity) <= 0 || Number(purchaseForm.unitCost) <= 0) return

    const newOrder = onCreatePurchaseOrder({
      inventoryItemId: selectedItem.id,
      quantity: Number(purchaseForm.quantity),
      unitCost: Number(purchaseForm.unitCost),
      supplier: purchaseForm.supplier.trim() || selectedItem.supplier,
    })

    if (!newOrder) {
      setPurchaseMessage({ ok: false, text: 'Nao foi possivel criar o pedido de compra.' })
      return
    }

    setPurchaseMessage({ ok: true, text: `${newOrder.code} criado para ${newOrder.itemName}.` })
    setPurchaseForm((currentForm) => ({ ...currentForm, quantity: '', unitCost: '', supplier: '' }))
  }

  return (
    <div className="purchases-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Sugestoes de compra</span>
          <strong>{lowItems.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Pedidos abertos</span>
          <strong>{pendingOrders.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Valor pendente</span>
          <strong>{currency.format(pendingValue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Recebidos</span>
          <strong>{receivedOrders.length}</strong>
        </Card>
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NFC-e</p>
            <h2>Importar compra por QR Code</h2>
          </div>
          <span className="soft-label">Consulta SEFAZ</span>
        </div>

        <form className="entry-form fiscal-form" onSubmit={handleReadCoupon}>
          <label>
            URL ou chave do cupom fiscal
            <input
              value={qrInput}
              onChange={(event) => setQrInput(event.target.value)}
              placeholder="Cole aqui a URL lida no QR Code da NFC-e"
            />
          </label>
          <button className="secondary-button" disabled={couponLoading} type="submit">
            {couponLoading ? 'Consultando...' : 'Consultar SEFAZ'}
          </button>
        </form>
        <label className="file-scan-button">
          Escanear imagem do QR Code
          <input accept="image/*" capture="environment" type="file" onChange={handleQrImageUpload} />
        </label>
        {purchaseMessage && (
          <div className={purchaseMessage.ok ? 'form-hint' : 'form-alert'}>
            {purchaseMessage.text}
          </div>
        )}

        {couponDraft && (
          <div className="coupon-preview">
            <div className="form-hint">
              Fornecedor: {couponDraft.supplier} - Chave: {couponDraft.fiscalKey}
            </div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Produto do cupom</th>
                    <th>Vincular ao estoque</th>
                    <th>Qtd</th>
                    <th>Custo unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {couponDraft.items.map((item, index) => (
                    <tr key={item.fiscalName}>
                      <td>{item.fiscalName}</td>
                      <td>
                        <select
                          value={item.inventoryItemId}
                          onChange={(event) => updateCouponItem(index, 'inventoryItemId', Number(event.target.value))}
                        >
                          {inventoryItems.map((inventoryItem) => (
                            <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateCouponItem(index, 'quantity', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          min="0"
                          step="0.001"
                          type="number"
                          value={item.unitCost}
                          onChange={(event) => updateCouponItem(index, 'unitCost', event.target.value)}
                        />
                      </td>
                      <td>{currency.format(Number(item.quantity) * Number(item.unitCost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="primary-button" type="button" onClick={confirmCouponImport}>
              Confirmar entrada do cupom
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reposicao</p>
            <h2>Sugestao por estoque minimo</h2>
          </div>
          <div className="export-actions">
            <button className="ghost-button" type="button" disabled={!purchaseSuggestionRows.length} onClick={exportSuggestedPurchasesCsv}>
              Exportar CSV
            </button>
            <button className="secondary-button" type="button" disabled={!purchaseSuggestionRows.length} onClick={exportSuggestedPurchasesPdf}>
              Exportar PDF
            </button>
          </div>
        </div>
        {exportMessage && <div className="form-hint">{exportMessage}</div>}
        {purchaseMessage && (
          <div className={purchaseMessage.ok ? 'form-hint' : 'form-alert'}>
            {purchaseMessage.text}
          </div>
        )}
        <div className="list-stack">
          {purchaseSuggestionRows.map((item) => {
            return (
              <div className="list-row purchase-suggestion" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>Atual {number.format(item.currentStock)} {item.unit} - minimo {number.format(item.minStock)} {item.unit}</span>
                </div>
                <div className="metric-cell">
                  <span>Sugerido</span>
                  <b>{number.format(item.suggestedQuantity)} {item.unit}</b>
                </div>
                <div className="metric-cell">
                  <span>Preco max.</span>
                  <b>{currency.format(item.suggestedMaxPrice)} / {item.unit}</b>
                </div>
                <button className="secondary-button" type="button" onClick={() => createSuggestedPurchase(item)}>
                  Comprar
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pedido</p>
            <h2>Novo pedido de compra</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            Insumo
            <select
              value={purchaseForm.inventoryItemId}
              onChange={(event) =>
                setPurchaseForm((currentForm) => ({ ...currentForm, inventoryItemId: Number(event.target.value) }))
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
                min="0"
                step="0.01"
                type="number"
                value={purchaseForm.quantity}
                onChange={(event) => setPurchaseForm((currentForm) => ({ ...currentForm, quantity: event.target.value }))}
                placeholder={selectedItem?.unit ?? 'un'}
              />
            </label>
            <label>
              Custo unitario
              <input
                min="0"
                step="0.01"
                type="number"
                value={purchaseForm.unitCost}
                onChange={(event) => setPurchaseForm((currentForm) => ({ ...currentForm, unitCost: event.target.value }))}
                placeholder="0,00"
              />
            </label>
          </div>
          <label>
            Fornecedor
            <input
              value={purchaseForm.supplier}
              onChange={(event) => setPurchaseForm((currentForm) => ({ ...currentForm, supplier: event.target.value }))}
              placeholder={selectedItem?.supplier ?? 'Fornecedor'}
            />
          </label>
          <div className="form-hint">
            Total previsto: {currency.format(Number(purchaseForm.quantity || 0) * Number(purchaseForm.unitCost || 0))}
          </div>
          {selectedItem && (
            <div className={priceStatus === 'acima' ? 'form-alert' : 'form-hint'}>
              Preco max. sugerido: {currency.format(suggestedMaxPrice)} / {selectedItem.unit}.{' '}
              {priceStatus === 'melhora' && 'Abaixo do custo medio atual: melhora a margem.'}
              {priceStatus === 'limite' && 'No limite do custo medio atual.'}
              {priceStatus === 'acima' && 'Acima do custo medio atual: pode reduzir a margem.'}
              {priceStatus === 'neutro' && 'Abaixo disso, a compra melhora a margem.'}
            </div>
          )}
          {purchaseMessage && (
            <div className={purchaseMessage.ok ? 'form-hint' : 'form-alert'}>
              {purchaseMessage.text}
            </div>
          )}
          <button className="primary-button" type="submit">Criar pedido de compra</button>
        </form>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Compras</p>
            <h2>Pedidos de compra</h2>
          </div>
          <span className="soft-label">{purchaseOrders.length} pedidos</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Insumo</th>
                <th>Fornecedor</th>
                <th>Quantidade</th>
                <th>Total</th>
                <th>Status</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.code}</td>
                  <td>{order.createdAt}</td>
                  <td>{order.itemName}</td>
                  <td>{order.supplier}</td>
                  <td>{number.format(order.quantity)} {order.unit}</td>
                  <td>{currency.format(order.total)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>
                    {order.status === 'aberto' ? (
                      <div className="row-actions">
                        <button className="ghost-button" type="button" onClick={() => onReceivePurchaseOrder(order.id)}>
                          Receber
                        </button>
                        <button className="ghost-button" type="button" onClick={() => onCancelPurchaseOrder(order.id)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <span className="muted">Concluido</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
