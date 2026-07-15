import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { useEffect, useState } from 'react'

function minutesBetween(start, end) {
  if (!start || !end) return 0
  return Math.max(0, Math.round((end - start) / 60000))
}

function formatElapsed(order) {
  const end = order.deliveredAt ?? order.completedAt ?? Date.now()
  const minutes = minutesBetween(order.createdAt, end)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = String(minutes % 60).padStart(2, '0')

  return `${String(hours).padStart(2, '0')}:${remainingMinutes}`
}

function formatTimerMinutes(minutes) {
  const safeMinutes = Math.max(0, minutes)
  const hours = Math.floor(safeMinutes / 60)
  const remainingMinutes = String(safeMinutes % 60).padStart(2, '0')

  return `${String(hours).padStart(2, '0')}:${remainingMinutes}`
}

function getLocalDayKey(value = Date.now()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isToday(value, now = Date.now()) {
  return Boolean(value && getLocalDayKey(value) === getLocalDayKey(now))
}

function getKitchenTiming(order, now) {
  const end = order.deliveredAt ?? order.completedAt ?? now
  const elapsedMinutes = minutesBetween(order.createdAt, end)
  const targetMinutes = Number(order.targetMinutes || 0)
  const delayMinutes = Math.max(0, elapsedMinutes - targetMinutes)
  const remainingMinutes = Math.max(0, targetMinutes - elapsedMinutes)
  const progress = targetMinutes > 0 ? Math.min(100, (elapsedMinutes / targetMinutes) * 100) : 100

  return {
    delayMinutes,
    delayed: targetMinutes > 0 && elapsedMinutes > targetMinutes,
    elapsedMinutes,
    progress,
    remainingMinutes,
    targetMinutes,
  }
}

function actionLabel(status) {
  const labels = {
    'em preparo': 'Finalizar',
    finalizado: 'Finalizado',
  }

  return labels[status] ?? 'Avancar'
}

function groupByHour(orders) {
  return orders.reduce((accumulator, order) => {
    const finishedAt = order.deliveredAt ?? order.completedAt
    if (!finishedAt) return accumulator

    const hour = new Date(finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit' })
    accumulator[hour] = (accumulator[hour] ?? 0) + 1
    return accumulator
  }, {})
}

function groupBySource(orders) {
  return orders.reduce((accumulator, order) => {
    if (!accumulator[order.source]) {
      accumulator[order.source] = {
        source: order.source,
        orders: [],
        oldestCreatedAt: order.createdAt,
      }
    }

    accumulator[order.source].orders.push(order)
    accumulator[order.source].oldestCreatedAt = Math.min(accumulator[order.source].oldestCreatedAt, order.createdAt)
    return accumulator
  }, {})
}

function sortKitchenOrders(orders, sortMode, now) {
  return [...orders].sort((a, b) => {
    const timingA = getKitchenTiming(a, now)
    const timingB = getKitchenTiming(b, now)
    const priorityA = a.priority === 'alta' ? 1 : 0
    const priorityB = b.priority === 'alta' ? 1 : 0

    if (sortMode === 'prioridade') {
      return (
        priorityB - priorityA ||
        Number(timingB.delayed) - Number(timingA.delayed) ||
        timingB.delayMinutes - timingA.delayMinutes ||
        a.createdAt - b.createdAt
      )
    }

    if (sortMode === 'tempo') {
      return (
        Number(timingB.delayed) - Number(timingA.delayed) ||
        timingB.delayMinutes - timingA.delayMinutes ||
        timingB.elapsedMinutes - timingA.elapsedMinutes ||
        priorityB - priorityA ||
        a.createdAt - b.createdAt
      )
    }

    return a.createdAt - b.createdAt
  })
}

function hasModifiers(order) {
  return Boolean(
    order.modifiers?.meatPoint ||
    order.modifiers?.removals?.length ||
    order.modifiers?.additions?.length ||
    order.notes,
  )
}

function KitchenInstructions({ compact = false, order }) {
  if (!hasModifiers(order)) return null

  return (
    <div className={`kitchen-instructions ${compact ? 'compact' : ''}`}>
      {order.modifiers?.meatPoint && (
        <div>
          <span>Ponto</span>
          <strong>{order.modifiers.meatPoint}</strong>
        </div>
      )}
      {order.modifiers?.removals?.length > 0 && (
        <div>
          <span>Remover</span>
          <div className="kitchen-tags">
            {order.modifiers.removals.map((item) => <b key={item}>{item}</b>)}
          </div>
        </div>
      )}
      {order.modifiers?.additions?.length > 0 && (
        <div>
          <span>Adicionais</span>
          <div className="kitchen-tags kitchen-tags-additions">
            {order.modifiers.additions.map((item) => <b key={item.id}>{item.label}</b>)}
          </div>
        </div>
      )}
      {order.notes && (
        <div>
          <span>Observacao</span>
          <strong>{order.notes}</strong>
        </div>
      )}
    </div>
  )
}

export function Kitchen({ onAdvanceOrder, onPrioritizeOrder, orders }) {
  const [viewMode, setViewMode] = useState('individual')
  const [sortMode, setSortMode] = useState('fila')
  const [completedSourceFilter, setCompletedSourceFilter] = useState('todos')
  const [actionOrderId, setActionOrderId] = useState(null)
  const [kitchenMessage, setKitchenMessage] = useState(null)
  const [now, setNow] = useState(Date.now())
  const activeOrders = orders.filter((order) => order.status !== 'finalizado')
  const completedOrders = orders.filter((order) => order.completedAt && isToday(order.completedAt, now))
  const sortedCompletedOrders = [...completedOrders].sort(
    (first, second) => Number(second.completedAt ?? second.deliveredAt ?? 0) - Number(first.completedAt ?? first.deliveredAt ?? 0),
  )
  const completedSourceOptions = ['todos', ...Array.from(new Set(sortedCompletedOrders.map((order) => order.source).filter(Boolean)))]
  const visibleCompletedOrders = completedSourceFilter === 'todos'
    ? sortedCompletedOrders
    : sortedCompletedOrders.filter((order) => order.source === completedSourceFilter)
  const averageMinutes = completedOrders.length
    ? completedOrders.reduce((total, order) => total + minutesBetween(order.createdAt, order.completedAt), 0) / completedOrders.length
    : 0
  const onTargetOrders = completedOrders.filter((order) => minutesBetween(order.createdAt, order.completedAt) <= order.targetMinutes)
  const onTargetRate = completedOrders.length ? (onTargetOrders.length / completedOrders.length) * 100 : 0
  const productionByHour = Object.entries(groupByHour(completedOrders))
  const sortedActiveOrders = sortKitchenOrders(activeOrders, sortMode, now)
  const delayedOrders = activeOrders.filter((order) => getKitchenTiming(order, now).delayed)
  const groupedOrders = Object.values(groupBySource(sortedActiveOrders)).sort((a, b) => {
    if (sortMode === 'fila') return a.oldestCreatedAt - b.oldestCreatedAt

    const timingA = getKitchenTiming(a.orders[0], now)
    const timingB = getKitchenTiming(b.orders[0], now)
    return (
      Number(timingB.delayed) - Number(timingA.delayed) ||
      timingB.delayMinutes - timingA.delayMinutes ||
      timingB.elapsedMinutes - timingA.elapsedMinutes ||
      a.oldestCreatedAt - b.oldestCreatedAt
    )
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 15000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!kitchenMessage || kitchenMessage.type === 'loading') return undefined

    const timer = window.setTimeout(() => setKitchenMessage(null), 3200)
    return () => window.clearTimeout(timer)
  }, [kitchenMessage])

  async function runKitchenAction(actionId, loadingText, action) {
    if (actionOrderId) return

    setActionOrderId(actionId)
    setKitchenMessage({ type: 'loading', text: loadingText })

    let result = null
    try {
      ;[result] = await Promise.all([
        Promise.resolve(action()),
        new Promise((resolve) => window.setTimeout(resolve, 350)),
      ])
    } catch (error) {
      result = { ok: false, message: error?.message ?? 'Nao foi possivel atualizar a cozinha.' }
    }

    setActionOrderId(null)
    setKitchenMessage({
      type: result?.ok ? 'success' : 'error',
      text: result?.message ?? 'Cozinha atualizada.',
    })
  }

  function handleAdvanceOrder(order) {
    runKitchenAction(order.id, `Salvando ${order.item}...`, () => onAdvanceOrder?.(order.id))
  }

  function handlePrioritizeOrder(order) {
    runKitchenAction(order.id, `Priorizando ${order.item}...`, () => onPrioritizeOrder?.(order.id))
  }

  async function handleAdvanceGroup(groupOrders) {
    const groupId = `group-${groupOrders[0]?.source ?? 'cozinha'}`
    if (actionOrderId) return

    setActionOrderId(groupId)
    setKitchenMessage({ type: 'loading', text: `Finalizando ${groupOrders.length} item(ns) do grupo...` })

    let lastResult = null
    try {
      for (const order of groupOrders) {
        if (order.status !== 'finalizado') {
          lastResult = await Promise.resolve(onAdvanceOrder?.(order.id))
          if (lastResult && lastResult.ok === false) break
        }
      }
    } catch (error) {
      lastResult = { ok: false, message: error?.message ?? 'Nao foi possivel finalizar o grupo.' }
    }

    setActionOrderId(null)
    setKitchenMessage({
      type: lastResult?.ok === false ? 'error' : 'success',
      text: lastResult?.ok === false ? lastResult.message : 'Grupo finalizado e salvo.',
    })
  }

  return (
    <div className="kitchen-workspace">
      <Card className="kitchen-command-card full-span">
        <div>
          <p className="eyebrow">Tela de producao</p>
          <h2>{activeOrders.length === 0 ? 'Cozinha livre no momento' : `${activeOrders.length} pedidos na fila`}</h2>
          <span>
            Para usar no iPad da cozinha, escolha Visual &gt; Tablet no topo: a lateral some e os tickets ganham mais area.
          </span>
        </div>
        <div className="kitchen-command-metrics">
          <strong>{delayedOrders.length}</strong>
          <span>atrasados</span>
        </div>
      </Card>

      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Pedidos ativos</span>
          <strong>{activeOrders.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Tempo medio</span>
          <strong>{averageMinutes.toFixed(1)} min</strong>
        </Card>
        <Card className="stat-card">
          <span>Dentro do alvo</span>
          <strong>{onTargetRate.toFixed(0)}%</strong>
        </Card>
        <Card className="stat-card">
          <span>Finalizados hoje</span>
          <strong>{completedOrders.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Atrasados</span>
          <strong>{delayedOrders.length}</strong>
        </Card>
      </section>

      <Card className="kitchen-toolbar">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Producao</p>
            <h2>Fila da cozinha</h2>
          </div>
          <div className="segmented-control" aria-label="Modo de visualizacao da cozinha">
            <button
              className={viewMode === 'individual' ? 'active' : ''}
              type="button"
              onClick={() => setViewMode('individual')}
            >
              Tickets
            </button>
            <button
              className={viewMode === 'grouped' ? 'active' : ''}
              type="button"
              onClick={() => setViewMode('grouped')}
            >
              Agrupar por mesa
            </button>
          </div>
        </div>
        <div className="kitchen-sort-bar">
          <span>Priorizar por</span>
          <div className="segmented-control" aria-label="Ordenacao da fila da cozinha">
            <button
              className={sortMode === 'fila' ? 'active' : ''}
              type="button"
              onClick={() => setSortMode('fila')}
            >
              Fila
            </button>
            <button
              className={sortMode === 'tempo' ? 'active' : ''}
              type="button"
              onClick={() => setSortMode('tempo')}
            >
              Tempo
            </button>
            <button
              className={sortMode === 'prioridade' ? 'active' : ''}
              type="button"
              onClick={() => setSortMode('prioridade')}
            >
              Prioridade
            </button>
          </div>
        </div>
      </Card>

      {kitchenMessage && (
        <div className={`form-${kitchenMessage.type === 'error' ? 'alert' : 'hint'} kitchen-inline-feedback`}>
          {kitchenMessage.text}
        </div>
      )}

      {viewMode === 'individual' ? (
        <div className="kitchen-grid">
          {activeOrders.length === 0 ? (
            <p className="empty-state kitchen-empty-state">Nenhum pedido ativo na cozinha.</p>
          ) : sortedActiveOrders.map((order) => {
            const timing = getKitchenTiming(order, now)

            return (
              <Card className={`kitchen-ticket kitchen-ticket-${order.status.replaceAll(' ', '-')} ${timing.delayed ? 'kitchen-ticket-delayed' : ''}`} key={order.id}>
                <div className="table-card-top">
                  <strong>{order.id}</strong>
                  <div className="row-actions">
                    {timing.delayed && <StatusBadge status="atrasado" />}
                    <StatusBadge status={order.priority} />
                  </div>
                </div>
                <h2>{order.item}</h2>
                <KitchenInstructions order={order} />
                <div className="ticket-source">{order.source}</div>
                <div className={`ticket-timer ${timing.delayed ? 'delayed' : ''}`}>
                  <div>
                    <span>Tempo de preparo</span>
                    <strong>{formatTimerMinutes(timing.elapsedMinutes)}</strong>
                  </div>
                  <i><b style={{ width: `${timing.progress}%` }} /></i>
                  <small>
                    {timing.delayed
                      ? `${timing.delayMinutes} min atrasado`
                      : `${timing.remainingMinutes} min restantes no alvo`}
                  </small>
                </div>
                <div className="ticket-meta">
                  <span>Alvo: {order.targetMinutes} min</span>
                  <span>Aberto: {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="ticket-footer">
                  <StatusBadge status={order.status} />
                  <span>{formatElapsed(order)}</span>
                </div>
                <div className="kitchen-ticket-actions">
                  <button
                    className="ghost-button"
                    disabled={order.priority === 'alta' || Boolean(actionOrderId)}
                    type="button"
                    onClick={() => handlePrioritizeOrder(order)}
                  >
                    {actionOrderId === order.id ? 'Salvando...' : 'Priorizar'}
                  </button>
                  <button className="primary-button" disabled={Boolean(actionOrderId)} type="button" onClick={() => handleAdvanceOrder(order)}>
                    {actionOrderId === order.id ? 'Salvando...' : actionLabel(order.status)}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="kitchen-group-grid">
          {groupedOrders.length === 0 ? (
            <p className="empty-state kitchen-empty-state">Nenhum pedido ativo para agrupar.</p>
          ) : groupedOrders.map((group) => {
            const slowestOrder = group.orders.reduce((oldest, order) =>
              order.createdAt < oldest.createdAt ? order : oldest,
            )

            return (
              <Card className="kitchen-group-card" key={group.source}>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{group.orders.length} itens em producao</p>
                    <h2>{group.source}</h2>
                  </div>
                  <span className="soft-label">{formatElapsed(slowestOrder)}</span>
                </div>
                <div className="kitchen-group-items">
                  {group.orders.map((order) => (
                    <div className={getKitchenTiming(order, now).delayed ? 'kitchen-group-item delayed' : 'kitchen-group-item'} key={order.id}>
                      <div>
                        <strong>{order.item}</strong>
                        <span>{order.id} - aberto {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Tempo {formatTimerMinutes(getKitchenTiming(order, now).elapsedMinutes)} de {order.targetMinutes} min</span>
                        <KitchenInstructions compact order={order} />
                      </div>
                      <div className="kitchen-group-status">
                        {getKitchenTiming(order, now).delayed && <StatusBadge status="atrasado" />}
                        <StatusBadge status={order.status} />
                      </div>
                      <button
                        className="ghost-button"
                        disabled={order.priority === 'alta' || Boolean(actionOrderId)}
                        type="button"
                        onClick={() => handlePrioritizeOrder(order)}
                      >
                        {actionOrderId === order.id ? 'Salvando...' : 'Priorizar'}
                      </button>
                      <button className="ghost-button" disabled={Boolean(actionOrderId)} type="button" onClick={() => handleAdvanceOrder(order)}>
                        {actionOrderId === order.id ? 'Salvando...' : actionLabel(order.status)}
                      </button>
                    </div>
                  ))}
                </div>
                <button className="primary-button" disabled={Boolean(actionOrderId)} type="button" onClick={() => handleAdvanceGroup(group.orders)}>
                  {actionOrderId === `group-${group.source}` ? 'Salvando grupo...' : 'Finalizar grupo'}
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historico</p>
            <h2>Ultimos atendimentos</h2>
          </div>
          <label className="compact-filter-label">
            Filtrar
            <select value={completedSourceFilter} onChange={(event) => setCompletedSourceFilter(event.target.value)}>
              {completedSourceOptions.map((source) => (
                <option key={source} value={source}>{source === 'todos' ? 'Todos' : source}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="kitchen-completed-stack">
          {visibleCompletedOrders.length === 0 ? (
            <p className="empty-state">Nenhum atendimento finalizado hoje neste filtro.</p>
          ) : visibleCompletedOrders.slice(0, 14).map((order) => (
            <details className="kitchen-completed-item" key={order.id}>
              <summary>
                <span>
                  <strong>{order.item}</strong>
                  <small>
                    {order.source} - {new Date(order.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {minutesBetween(order.createdAt, order.completedAt)} min
                  </small>
                </span>
                <StatusBadge status={order.status} />
              </summary>
              <KitchenInstructions compact order={order} />
              <p>ID: {order.id}</p>
            </details>
          ))}
        </div>
      </Card>

      <Card className="kitchen-performance-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Performance</p>
            <h2>Producao por horario</h2>
          </div>
        </div>
        <div className="hour-list">
          {productionByHour.length === 0 ? (
            <p className="empty-state">Nenhum pedido finalizado hoje.</p>
          ) : (
            productionByHour.map(([hour, quantity]) => (
              <div className="hour-row" key={hour}>
                <span>{hour}h</span>
                <div><i style={{ width: `${Math.max(quantity * 28, 16)}%` }} /></div>
                <b>{quantity}</b>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
