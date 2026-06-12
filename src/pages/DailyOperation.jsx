import { useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { getOperationPeriodSummary } from '../lib/operationRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const today = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())
const periodOptions = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'data', label: 'Por data' },
  { id: '7-dias', label: '7 dias' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

const defaultSelectedDate = new Date().toISOString().slice(0, 10)

function percent(value, base) {
  if (!base) return '0.0%'
  return `${((value / base) * 100).toFixed(1)}%`
}

export function DailyOperation({ deliveries, expenses, inventoryItems, payments, products, stockAdjustments, tables, technicalSheets }) {
  const [period, setPeriod] = useState('hoje')
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate)
  const summary = getOperationPeriodSummary(
    {
      deliveries,
      expenses,
      inventoryItems,
      payments,
      products,
      stockAdjustments,
      tables,
      technicalSheets,
    },
    { mode: period, selectedDate },
  )
  const isSingleDay = summary.dailyBreakdown.length === 1
  const periodLabel = isSingleDay
    ? (period === 'hoje' ? today : summary.dailyBreakdown[0]?.label)
    : `${summary.dailyBreakdown[0]?.label} a ${summary.dailyBreakdown.at(-1)?.label}`

  const dreRows = [
    { label: 'Receita realizada', value: summary.receivedRevenue, share: percent(summary.receivedRevenue, summary.receivedRevenue), kind: 'positive' },
    { label: '(-) CMV estimado', value: -summary.cogs, share: percent(summary.cogs, summary.receivedRevenue), kind: 'negative' },
    { label: 'Perdas no estoque', value: -summary.stockLossTotal, share: percent(summary.stockLossTotal, summary.receivedRevenue), kind: 'negative' },
    { label: '(=) Lucro bruto', value: summary.grossProfit, share: percent(summary.grossProfit, summary.receivedRevenue), kind: 'subtotal' },
    { label: '(-) Despesas pagas', value: -summary.paidExpenseTotal, share: percent(summary.paidExpenseTotal, summary.receivedRevenue), kind: 'negative' },
    { label: '(=) Resultado do dia', value: summary.netResult, share: percent(summary.netResult, summary.receivedRevenue), kind: summary.netResult >= 0 ? 'result-positive' : 'result-negative' },
  ]

  return (
    <div className="operation-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Faturamento recebido</span>
          <strong>{currency.format(summary.receivedRevenue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Vendas em aberto</span>
          <strong>{currency.format(summary.openRevenue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>CMV estimado</span>
          <strong>{currency.format(summary.cogs)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Resultado do dia</span>
          <strong>{currency.format(summary.netResult)}</strong>
        </Card>
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operacao diaria</p>
            <h2>{isSingleDay ? 'Resultado do dia' : 'Resultado consolidado'}</h2>
          </div>
          <div className="operation-filters">
            <div className="segmented-control" aria-label="Periodo da operacao">
              {periodOptions.map((option) => (
                <button
                  className={period === option.id ? 'active' : ''}
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {period === 'data' && (
              <input
                aria-label="Selecionar data da operacao"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            )}
          </div>
        </div>
        <div className="operation-period-label">{periodLabel}</div>

        <div className="operation-summary-grid">
          <div>
            <span>Mesas recebidas</span>
            <strong>{currency.format(summary.revenueTables)}</strong>
          </div>
          <div>
            <span>Delivery entregue</span>
            <strong>{currency.format(summary.revenueDelivery)}</strong>
          </div>
          <div>
            <span>Mesas em aberto</span>
            <strong>{currency.format(summary.openTablesTotal)}</strong>
          </div>
          <div>
            <span>Delivery ativo</span>
            <strong>{currency.format(summary.activeDeliveryTotal)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Caixa</p>
            <h2>Fechamento por forma</h2>
          </div>
        </div>
        <div className="summary-stack">
          {summary.paymentsByMethod.map((item) => (
            <div key={item.method}>
              <span><StatusBadge status={item.method} /></span>
              <strong>{currency.format(item.amount)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">DRE</p>
            <h2>Demonstrativo do dia</h2>
          </div>
          <span className="soft-label">{summary.salesCount} vendas</span>
        </div>
        <div className="dre-statement compact-dre">
          {dreRows.map((row) => (
            <div className={`dre-row ${row.kind}`} key={row.label}>
              <span>{row.label}</span>
              <b>{currency.format(row.value)}</b>
              <small>{row.share}</small>
            </div>
          ))}
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historico</p>
            <h2>Operacao por dia</h2>
          </div>
          <span className="soft-label">{summary.dailyBreakdown.length} dia{summary.dailyBreakdown.length === 1 ? '' : 's'}</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Data</th>
                <th>Vendas</th>
                <th>Faturamento</th>
                <th>Aberto</th>
                <th>CMV</th>
                <th>Perdas</th>
                <th>Despesas</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {summary.dailyBreakdown.map((day) => (
                <tr key={day.isoDate}>
                  <td>{day.label}</td>
                  <td>{day.isoDate}</td>
                  <td>{day.salesCount}</td>
                  <td>{currency.format(day.receivedRevenue)}</td>
                  <td>{currency.format(day.openRevenue)}</td>
                  <td>{currency.format(day.cogs)}</td>
                  <td>{currency.format(day.stockLossTotal)}</td>
                  <td>{currency.format(day.paidExpenseTotal)}</td>
                  <td>{currency.format(day.netResult)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Produtos</p>
            <h2>O que vendemos</h2>
          </div>
          <span className="soft-label">{summary.productsSold.length} produtos</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Faturamento</th>
                <th>CMV</th>
                <th>Margem bruta</th>
              </tr>
            </thead>
            <tbody>
              {summary.productsSold.length === 0 ? (
                <tr>
                  <td colSpan="5">Nenhuma venda recebida ou entregue ainda.</td>
                </tr>
              ) : summary.productsSold.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{currency.format(item.revenue)}</td>
                  <td>{currency.format(item.cogs)}</td>
                  <td>{percent(item.revenue - item.cogs, item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pendencias</p>
            <h2>Contas em aberto</h2>
          </div>
        </div>
        <div className="list-stack">
          {summary.openTables.length === 0 && summary.activeDeliveryOrders.length === 0 ? (
            <p className="empty-state">Nenhuma conta em aberto no momento.</p>
          ) : (
            <>
              {summary.openTables.map((table) => (
                <div className="list-row" key={`mesa-${table.id}`}>
                  <div>
                    <strong>Mesa {String(table.id).padStart(2, '0')}</strong>
                    <span>{table.orderItems.length} itens em aberto</span>
                  </div>
                  <b>{currency.format(table.total)}</b>
                </div>
              ))}
              {summary.activeDeliveryOrders.map((order) => (
                <div className="list-row" key={order.id}>
                  <div>
                    <strong>{order.id} - {order.customer}</strong>
                    <span>{order.channel} - {order.status}</span>
                  </div>
                  <b>{currency.format(order.total)}</b>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
