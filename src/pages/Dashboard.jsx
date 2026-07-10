import { Card } from '../components/Card.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function Dashboard({ data, icons }) {
  const hourlySales = data.hourlySales?.length ? data.hourlySales : [{ label: 'Hoje', value: 0 }]
  const topProducts = data.topProducts?.length ? data.topProducts : []
  const alerts = data.alerts?.length ? data.alerts : ['Nenhum alerta critico no momento.']
  const stats = [
    { label: 'Vendas do dia', value: currency.format(data.salesToday), icon: icons.ReceiptText },
    { label: 'Pedidos abertos', value: data.openOrders, icon: icons.BarChart3 },
    { label: 'Mesas ocupadas', value: data.occupiedTables, icon: icons.Utensils },
    { label: 'Alertas de estoque', value: data.stockAlerts, icon: icons.Boxes },
  ]

  const maxSale = Math.max(1, ...hourlySales.map((item) => item.value))

  return (
    <div className="page-grid">
      <Card className="brand-hero-card">
        <div>
          <BrandLogo />
          <p>Hamburgueres gourmet assados na brasa, com operacao conectada do pedido ao resultado.</p>
        </div>
        <div className="brand-hero-flame" aria-hidden="true" />
      </Card>

      <section className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card className="stat-card" key={stat.label}>
              <div className="stat-icon">
                <Icon size={21} />
              </div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </Card>
          )
        })}
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Movimento</p>
            <h2>Vendas por horario</h2>
          </div>
          <span className="soft-label">Hoje</span>
        </div>
        <div className="bar-chart">
          {hourlySales.map((item) => (
            <div className="bar-item" key={item.label}>
              <div className="bar-track">
                <span style={{ height: `${Math.max((item.value / maxSale) * 100, 12)}%` }} />
              </div>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Top produtos</p>
            <h2>Mais vendidos</h2>
          </div>
        </div>
        <div className="list-stack">
          {topProducts.length === 0 ? (
            <p className="empty-state">Nenhum produto vendido hoje ainda.</p>
          ) : topProducts.map((product) => (
            <div className="list-row" key={product.name}>
              <div>
                <strong>{product.name}</strong>
                <span>{product.quantity} unidades</span>
              </div>
              <b>{currency.format(product.revenue)}</b>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Atencao</p>
            <h2>Alertas de estoque</h2>
          </div>
        </div>
        <div className="alert-list">
          {alerts.map((alert) => (
            <p key={alert}>{alert}</p>
          ))}
        </div>
      </Card>
    </div>
  )
}
