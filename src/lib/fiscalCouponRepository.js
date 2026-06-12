import { supabase } from './supabaseClient.js'

export function normalizeFiscalText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function extractFiscalKey(input) {
  return String(input ?? '').replace(/\D/g, '').slice(0, 44)
}

function normalizeFiscalItem(item) {
  const quantity = Number(item.quantity || 0)
  const total = Number(item.total || 0)
  const unitCost = Number(item.unitCost || item.unit_price || 0) || (quantity > 0 ? total / quantity : 0)

  return {
    fiscalName: item.fiscalName ?? item.name ?? item.description ?? 'Item do cupom',
    quantity,
    unitCost,
    unit: item.unit ?? item.commercialUnit ?? '',
    barcode: item.barcode ?? item.ean ?? '',
    ncm: item.ncm ?? '',
    suggestedInventoryId: item.suggestedInventoryId ?? '',
  }
}

export function normalizeFiscalCouponDraft(payload, originalInput = '') {
  const fiscalKey = payload.fiscalKey ?? payload.key ?? extractFiscalKey(originalInput)
  const items = Array.isArray(payload.items) ? payload.items.map(normalizeFiscalItem) : []

  return {
    fiscalKey,
    supplier: payload.supplier ?? payload.supplierName ?? payload.issuerName ?? 'Fornecedor NFC-e',
    issuedAt: payload.issuedAt ?? payload.issueDate ?? new Date().toLocaleDateString('pt-BR'),
    sourceUrl: payload.sourceUrl ?? originalInput,
    items,
  }
}

export async function fetchFiscalCouponFromSefaz(qrCodeValue) {
  if (!qrCodeValue?.trim()) {
    return { ok: false, message: 'Informe a URL ou chave do cupom fiscal.' }
  }

  const { data, error } = await supabase.functions.invoke('fiscal-coupon-import', {
    body: { qrCodeValue },
  })

  if (error) {
    return { ok: false, message: `Falha na consulta SEFAZ: ${error.message}` }
  }

  if (!data?.ok) {
    return { ok: false, message: data?.message ?? 'Nao foi possivel importar os itens do cupom.' }
  }

  return {
    ok: true,
    draft: normalizeFiscalCouponDraft(data.coupon, qrCodeValue),
    message: data.message ?? 'Cupom carregado para conferencia.',
  }
}
