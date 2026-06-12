import { useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const categories = ['Insumos', 'Operacional', 'Utilidades', 'Marketing', 'Pessoal', 'Outros']
const receivablePaymentMethods = [
  { id: 'pix', label: 'Pix' },
  { id: 'debito', label: 'Debito' },
  { id: 'credito', label: 'Credito' },
  { id: 'dinheiro', label: 'Dinheiro' },
]

function sumBy(items, predicate) {
  return items.filter(predicate).reduce((total, item) => total + item.amount, 0)
}

export function Financial({ accountsReceivable = [], expenses, onAddExpense, onReceiveReceivable, onToggleExpenseStatus, payments }) {
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    category: 'Insumos',
    amount: '',
    status: 'pendente',
  })
  const [receivableMethods, setReceivableMethods] = useState({})
  const [receivableMessage, setReceivableMessage] = useState(null)

  const revenue = payments.reduce((total, payment) => total + payment.amount, 0)
  const paidExpenses = sumBy(expenses, (expense) => expense.status === 'pago')
  const pendingExpenses = sumBy(expenses, (expense) => expense.status === 'pendente')
  const openReceivables = sumBy(accountsReceivable, (receivable) => receivable.status === 'aberto')
  const cashBalance = revenue - paidExpenses
  const paymentsByMethod = ['pix', 'credito', 'debito', 'dinheiro', 'caderneta'].map((method) => ({
    method,
    amount: method === 'caderneta'
      ? openReceivables
      : sumBy(payments, (payment) => payment.method === method),
  }))

  function handleSubmit(event) {
    event.preventDefault()
    if (!expenseForm.description.trim() || Number(expenseForm.amount) <= 0) return

    onAddExpense({
      description: expenseForm.description.trim(),
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      status: expenseForm.status,
    })

    setExpenseForm((currentForm) => ({
      ...currentForm,
      description: '',
      amount: '',
      status: 'pendente',
    }))
  }

  function handleReceiveReceivable(receivable) {
    const method = receivableMethods[receivable.id] ?? 'pix'
    const result = onReceiveReceivable(receivable.id, method)

    if (result?.ok === false) {
      setReceivableMessage({ ok: false, text: result.message })
      return
    }

    setReceivableMessage({ ok: true, text: `Recebimento de ${currency.format(receivable.amount)} registrado no caixa.` })
  }

  return (
    <div className="financial-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Receita recebida</span>
          <strong>{currency.format(revenue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Despesas pagas</span>
          <strong>{currency.format(paidExpenses)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Contas a receber</span>
          <strong>{currency.format(openReceivables)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Saldo do turno</span>
          <strong>{currency.format(cashBalance)}</strong>
        </Card>
      </section>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Receitas</p>
            <h2>Por forma de pagamento</h2>
          </div>
        </div>
        <div className="summary-stack">
          {paymentsByMethod.map((item) => (
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
            <p className="eyebrow">Lancamento</p>
            <h2>Nova despesa</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            Descricao
            <input
              type="text"
              value={expenseForm.description}
              onChange={(event) => setExpenseForm((currentForm) => ({ ...currentForm, description: event.target.value }))}
              placeholder="Ex: Compra de insumos"
            />
          </label>
          <label>
            Categoria
            <select
              value={expenseForm.category}
              onChange={(event) => setExpenseForm((currentForm) => ({ ...currentForm, category: event.target.value }))}
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Valor
              <input
                min="0"
                step="0.01"
                type="number"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((currentForm) => ({ ...currentForm, amount: event.target.value }))}
                placeholder="0,00"
              />
            </label>
            <label>
              Status
              <select
                value={expenseForm.status}
                onChange={(event) => setExpenseForm((currentForm) => ({ ...currentForm, status: event.target.value }))}
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </label>
          </div>
          <button className="primary-button" type="submit">Registrar despesa</button>
        </form>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Caderneta</p>
            <h2>Contas a receber</h2>
          </div>
          <span className="soft-label">{accountsReceivable.length} titulos</span>
        </div>
        <div className="responsive-table">
          {receivableMessage && (
            <div className={receivableMessage.ok ? 'form-hint' : 'form-alert'}>{receivableMessage.text}</div>
          )}
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Descricao</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Recebimento</th>
              </tr>
            </thead>
            <tbody>
              {accountsReceivable.length === 0 ? (
                <tr>
                  <td colSpan="6">Nenhuma conta a receber registrada.</td>
                </tr>
              ) : accountsReceivable.map((receivable) => (
                <tr key={receivable.id}>
                  <td>{receivable.createdAt}</td>
                  <td>{receivable.customerName}</td>
                  <td>{receivable.description}</td>
                  <td><StatusBadge status={receivable.status} /></td>
                  <td>{currency.format(receivable.amount)}</td>
                  <td>
                    {receivable.status === 'aberto' ? (
                      <div className="inline-action-row">
                        <select
                          value={receivableMethods[receivable.id] ?? 'pix'}
                          onChange={(event) =>
                            setReceivableMethods((currentMethods) => ({
                              ...currentMethods,
                              [receivable.id]: event.target.value,
                            }))}
                        >
                          {receivablePaymentMethods.map((method) => (
                            <option key={method.id} value={method.id}>{method.label}</option>
                          ))}
                        </select>
                        <button className="primary-button compact-button" type="button" onClick={() => handleReceiveReceivable(receivable)}>
                          Receber
                        </button>
                      </div>
                    ) : (
                      <span className="soft-label">
                        {receivable.paidAt ?? 'Baixado'} - {receivable.paidMethod ? <StatusBadge status={receivable.paidMethod} /> : null}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Controle</p>
            <h2>Despesas do turno</h2>
          </div>
          <span className="soft-label">{expenses.length} lancamentos</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Descricao</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.time}</td>
                  <td>{expense.description}</td>
                  <td>{expense.category}</td>
                  <td><StatusBadge status={expense.status} /></td>
                  <td>{currency.format(expense.amount)}</td>
                  <td>
                    <button className="ghost-button" type="button" onClick={() => onToggleExpenseStatus(expense.id)}>
                      Alterar status
                    </button>
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
