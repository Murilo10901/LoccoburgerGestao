import { Card } from '../components/Card.jsx'
import { getTodayLocalDateKey } from '../lib/dateUtils.js'
import { getRecipeUnitCost } from '../lib/technicalSheetRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function getProductCost(productId, products, technicalSheets, inventoryItems) {
  const product = products.find((item) => item.id === productId)
  const sheet = technicalSheets.find((item) => item.id === product?.recipeId)

  return getRecipeUnitCost(sheet, inventoryItems)
}

function getItemCost(item, products, technicalSheets, inventoryItems) {
  const productCost = getProductCost(item.productId, products, technicalSheets, inventoryItems) * item.quantity
  const modifiersCost = (item.modifiers?.additions ?? []).reduce((total, addition) => {
    const inventoryItem = inventoryItems.find((stockItem) => stockItem.id === addition.inventoryItemId)
    return total + (inventoryItem ? inventoryItem.averageCost * addition.quantity * item.quantity : 0)
  }, 0)

  return productCost + modifiersCost
}

function percent(value, base) {
  if (!base) return '0.0%'
  return `${((value / base) * 100).toFixed(1)}%`
}

export function Dre({ expenses, inventoryItems, payments, products, stockAdjustments = [], technicalSheets }) {
  const revenue = payments.reduce((total, payment) => total + payment.amount, 0)
  const productCogs = payments.reduce((paymentTotal, payment) => {
    return paymentTotal + payment.items.reduce((itemTotal, item) => {
      return itemTotal + getItemCost(item, products, technicalSheets, inventoryItems)
    }, 0)
  }, 0)
  const todayIsoDate = getTodayLocalDateKey()
  const stockLossTotal = stockAdjustments
    .filter((adjustment) => adjustment.type === 'perda' && adjustment.createdAtIso === todayIsoDate)
    .reduce((total, adjustment) => total + Number(adjustment.totalCost || 0), 0)
  const cogs = productCogs + stockLossTotal

  const paidExpenses = expenses.filter((expense) => expense.status === 'pago')
  const operatingExpenses = paidExpenses.reduce((total, expense) => total + expense.amount, 0)
  const grossProfit = revenue - cogs
  const netResult = grossProfit - operatingExpenses

  const expenseByCategory = paidExpenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] ?? 0) + expense.amount
    return accumulator
  }, {})

  const dreRows = [
    { label: 'Receita bruta', value: revenue, kind: 'positive', share: percent(revenue, revenue) },
    { label: '(-) Custo dos produtos vendidos', value: -cogs, kind: 'negative', share: percent(cogs, revenue) },
    { label: 'Perdas de estoque no CMV', value: -stockLossTotal, kind: 'negative', share: percent(stockLossTotal, revenue) },
    { label: '(=) Lucro bruto', value: grossProfit, kind: 'subtotal', share: percent(grossProfit, revenue) },
    { label: '(-) Despesas operacionais pagas', value: -operatingExpenses, kind: 'negative', share: percent(operatingExpenses, revenue) },
    { label: '(=) Resultado liquido', value: netResult, kind: netResult >= 0 ? 'result-positive' : 'result-negative', share: percent(netResult, revenue) },
  ]

  return (
    <div className="dre-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Receita bruta</span>
          <strong>{currency.format(revenue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>CMV</span>
          <strong>{currency.format(cogs)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Lucro bruto</span>
          <strong>{currency.format(grossProfit)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Resultado liquido</span>
          <strong>{currency.format(netResult)}</strong>
        </Card>
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Demonstrativo</p>
            <h2>DRE do turno</h2>
          </div>
          <span className="soft-label">{payments.length} vendas</span>
        </div>

        <div className="dre-statement">
          {dreRows.map((row) => (
            <div className={`dre-row ${row.kind}`} key={row.label}>
              <span>{row.label}</span>
              <b>{currency.format(row.value)}</b>
              <small>{row.share}</small>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Margens</p>
            <h2>Indicadores</h2>
          </div>
        </div>
        <div className="summary-stack">
          <div>
            <span>Margem bruta</span>
            <strong>{percent(grossProfit, revenue)}</strong>
          </div>
          <div>
            <span>CMV sobre receita</span>
            <strong>{percent(cogs, revenue)}</strong>
          </div>
          <div>
            <span>Margem liquida</span>
            <strong>{percent(netResult, revenue)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Despesas</p>
            <h2>Por categoria</h2>
          </div>
        </div>
        <div className="list-stack">
          {Object.entries(expenseByCategory).length === 0 ? (
            <p className="empty-state">Nenhuma despesa paga no periodo.</p>
          ) : (
            Object.entries(expenseByCategory).map(([category, amount]) => (
              <div className="list-row" key={category}>
                <div>
                  <strong>{category}</strong>
                  <span>{percent(amount, operatingExpenses)} das despesas pagas</span>
                </div>
                <b>{currency.format(amount)}</b>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
