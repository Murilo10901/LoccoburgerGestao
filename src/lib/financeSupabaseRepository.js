import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'
import { getDataOwnerId } from './tenantRepository.js'

function mapPaymentFromSupabase(payment) {
  return {
    id: payment.app_id,
    source: payment.source,
    receivableId: payment.receivable_app_id,
    tableId: payment.table_app_id ? Number(payment.table_app_id) : null,
    tabId: payment.tab_app_id,
    tabName: payment.tab_name,
    deliveryId: payment.delivery_app_id,
    customerId: payment.customer_app_id ? Number(payment.customer_app_id) : null,
    customerName: payment.customer_name,
    method: payment.method,
    amount: Number(payment.amount || 0),
    grossAmount: Number(payment.gross_amount || 0),
    netAmount: Number(payment.net_amount || 0),
    discount: Number(payment.discount || 0),
    serviceCharge: Number(payment.service_charge || 0),
    receivedAmount: Number(payment.received_amount || 0),
    change: Number(payment.change_amount || 0),
    time: payment.time_label,
    paidAt: payment.paid_at_label,
    paidAtIso: payment.paid_at_iso,
    items: payment.items ?? [],
  }
}

function mapReceivableFromSupabase(receivable) {
  return {
    id: receivable.app_id,
    code: receivable.code,
    customerId: Number(receivable.customer_app_id),
    customerName: receivable.customer_name,
    description: receivable.description,
    amount: Number(receivable.amount || 0),
    grossAmount: Number(receivable.gross_amount || 0),
    discount: Number(receivable.discount || 0),
    serviceCharge: Number(receivable.service_charge || 0),
    status: receivable.status,
    createdAt: receivable.created_at_label,
    createdAtIso: receivable.created_at_iso,
    dueDate: receivable.due_date_label,
    time: receivable.time_label,
    paidAt: receivable.paid_at_label,
    paidAtIso: receivable.paid_at_iso,
    paidTime: receivable.paid_time_label,
    paidMethod: receivable.paid_method,
    paymentId: receivable.payment_app_id,
    tableId: receivable.table_app_id ? Number(receivable.table_app_id) : null,
    tabId: receivable.tab_app_id,
    deliveryId: receivable.delivery_app_id,
    items: receivable.items ?? [],
  }
}

function mapExpenseFromSupabase(expense) {
  return {
    id: Number(expense.app_id),
    description: expense.description,
    category: expense.category,
    amount: Number(expense.amount || 0),
    status: expense.status,
    time: expense.time_label,
  }
}

function mapCashClosingFromSupabase(closing, methods) {
  return {
    id: Number(closing.app_id),
    code: closing.code,
    expectedTotal: Number(closing.expected_total || 0),
    countedTotal: Number(closing.counted_total || 0),
    difference: Number(closing.difference || 0),
    notes: closing.notes ?? '',
    paymentsCount: Number(closing.payments_count || 0),
    createdAt: closing.created_at_label,
    createdAtIso: closing.created_at_iso,
    time: closing.time_label,
    methods: methods
      .filter((method) => Number(method.closing_app_id) === Number(closing.app_id))
      .map((method) => ({
        id: method.method,
        label: method.label,
        expected: Number(method.expected || 0),
        counted: Number(method.counted || 0),
        difference: Number(method.difference || 0),
      })),
  }
}

export async function loadFinanceTables() {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para carregar financeiro.' }
  const ownerId = await getDataOwnerId()

  const [paymentsResult, receivablesResult, expensesResult, closingsResult, closingMethodsResult] = await Promise.all([
    supabase.from('user_payments').select('*').eq('user_id', ownerId),
    supabase.from('user_accounts_receivable').select('*').eq('user_id', ownerId),
    supabase.from('user_expenses').select('*').eq('user_id', ownerId),
    supabase.from('user_cash_closings').select('*').eq('user_id', ownerId),
    supabase.from('user_cash_closing_methods').select('*').eq('user_id', ownerId),
  ])

  const error = paymentsResult.error ?? receivablesResult.error ?? expensesResult.error ?? closingsResult.error ?? closingMethodsResult.error
  if (error) {
    return { ok: false, message: `Financeiro ainda nao disponivel no Supabase: ${error.message}` }
  }

  const hasData =
    paymentsResult.data.length > 0 ||
    receivablesResult.data.length > 0 ||
    expensesResult.data.length > 0 ||
    closingsResult.data.length > 0 ||
    closingMethodsResult.data.length > 0

  return {
    ok: true,
    hasData,
    data: {
      payments: paymentsResult.data.map(mapPaymentFromSupabase),
      accountsReceivable: receivablesResult.data.map(mapReceivableFromSupabase),
      expenses: expensesResult.data.map(mapExpenseFromSupabase),
      cashClosings: closingsResult.data.map((closing) => mapCashClosingFromSupabase(closing, closingMethodsResult.data)),
    },
  }
}

export async function saveFinanceTables({ payments, accountsReceivable, expenses, cashClosings }) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Entre no sistema para salvar financeiro.' }
  const ownerId = await getDataOwnerId()

  const deleteClosingMethods = await supabase.from('user_cash_closing_methods').delete().eq('user_id', ownerId)
  const deleteClosings = await supabase.from('user_cash_closings').delete().eq('user_id', ownerId)
  const deleteReceivables = await supabase.from('user_accounts_receivable').delete().eq('user_id', ownerId)
  const deletePayments = await supabase.from('user_payments').delete().eq('user_id', ownerId)
  const deleteExpenses = await supabase.from('user_expenses').delete().eq('user_id', ownerId)
  const deleteError = deleteClosingMethods.error ?? deleteClosings.error ?? deleteReceivables.error ?? deletePayments.error ?? deleteExpenses.error
  if (deleteError) return { ok: false, message: `Erro ao limpar financeiro antigo: ${deleteError.message}` }

  if (payments.length > 0) {
    const { error } = await supabase.from('user_payments').insert(
      payments.map((payment) => ({
        user_id: ownerId,
        app_id: String(payment.id),
        source: payment.source ?? 'mesa',
        receivable_app_id: payment.receivableId ? String(payment.receivableId) : null,
        table_app_id: payment.tableId ? String(payment.tableId) : null,
        tab_app_id: payment.tabId ? String(payment.tabId) : null,
        tab_name: payment.tabName ?? null,
        delivery_app_id: payment.deliveryId ? String(payment.deliveryId) : null,
        customer_app_id: payment.customerId ? Number(payment.customerId) : null,
        customer_name: payment.customerName ?? null,
        method: payment.method,
        amount: Number(payment.amount || 0),
        gross_amount: Number(payment.grossAmount || payment.amount || 0),
        net_amount: Number(payment.netAmount || payment.amount || 0),
        discount: Number(payment.discount || 0),
        service_charge: Number(payment.serviceCharge || 0),
        received_amount: Number(payment.receivedAmount || payment.amount || 0),
        change_amount: Number(payment.change || 0),
        time_label: payment.time ?? null,
        paid_at_label: payment.paidAt ?? null,
        paid_at_iso: payment.paidAtIso ?? null,
        items: payment.items ?? [],
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar pagamentos: ${error.message}` }
  }

  if (accountsReceivable.length > 0) {
    const { error } = await supabase.from('user_accounts_receivable').insert(
      accountsReceivable.map((receivable) => ({
        user_id: ownerId,
        app_id: String(receivable.id),
        code: receivable.code,
        customer_app_id: Number(receivable.customerId),
        customer_name: receivable.customerName,
        description: receivable.description,
        amount: Number(receivable.amount || 0),
        gross_amount: Number(receivable.grossAmount || receivable.amount || 0),
        discount: Number(receivable.discount || 0),
        service_charge: Number(receivable.serviceCharge || 0),
        status: receivable.status,
        created_at_label: receivable.createdAt,
        created_at_iso: receivable.createdAtIso,
        due_date_label: receivable.dueDate,
        time_label: receivable.time,
        paid_at_label: receivable.paidAt ?? null,
        paid_at_iso: receivable.paidAtIso ?? null,
        paid_time_label: receivable.paidTime ?? null,
        paid_method: receivable.paidMethod ?? null,
        payment_app_id: receivable.paymentId ? String(receivable.paymentId) : null,
        table_app_id: receivable.tableId ? String(receivable.tableId) : null,
        tab_app_id: receivable.tabId ? String(receivable.tabId) : null,
        delivery_app_id: receivable.deliveryId ? String(receivable.deliveryId) : null,
        items: receivable.items ?? [],
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar contas a receber: ${error.message}` }
  }

  if (expenses.length > 0) {
    const { error } = await supabase.from('user_expenses').insert(
      expenses.map((expense) => ({
        user_id: ownerId,
        app_id: Number(expense.id),
        description: expense.description,
        category: expense.category,
        amount: Number(expense.amount || 0),
        status: expense.status,
        time_label: expense.time ?? null,
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar despesas: ${error.message}` }
  }

  if (cashClosings.length > 0) {
    const { error } = await supabase.from('user_cash_closings').insert(
      cashClosings.map((closing) => ({
        user_id: ownerId,
        app_id: Number(closing.id),
        code: closing.code,
        expected_total: Number(closing.expectedTotal || 0),
        counted_total: Number(closing.countedTotal || 0),
        difference: Number(closing.difference || 0),
        notes: closing.notes ?? '',
        payments_count: Number(closing.paymentsCount || 0),
        created_at_label: closing.createdAt,
        created_at_iso: closing.createdAtIso,
        time_label: closing.time,
      })),
    )
    if (error) return { ok: false, message: `Erro ao salvar fechamentos de caixa: ${error.message}` }
  }

  const closingMethods = cashClosings.flatMap((closing) =>
    (closing.methods ?? []).map((method) => ({
      user_id: ownerId,
      closing_app_id: Number(closing.id),
      method: method.id,
      label: method.label,
      expected: Number(method.expected || 0),
      counted: Number(method.counted || 0),
      difference: Number(method.difference || 0),
    })),
  )

  if (closingMethods.length > 0) {
    const { error } = await supabase.from('user_cash_closing_methods').insert(closingMethods)
    if (error) return { ok: false, message: `Erro ao salvar detalhes do fechamento: ${error.message}` }
  }

  return { ok: true, message: 'Financeiro salvo em tabelas proprias.' }
}
