const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function onlyDigits(value: string) {
  return String(value ?? '').replace(/\D/g, '')
}

function extractFiscalKey(input: string) {
  return onlyDigits(input).slice(0, 44)
}

function isPrivateOrLocalHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase()
  if (['localhost', '0.0.0.0'].includes(normalizedHost)) return true
  if (normalizedHost === '::1') return true
  if (/^127\./.test(normalizedHost)) return true
  if (/^10\./.test(normalizedHost)) return true
  if (/^192\.168\./.test(normalizedHost)) return true
  if (/^169\.254\./.test(normalizedHost)) return true

  const private172 = normalizedHost.match(/^172\.(\d{1,2})\./)
  if (private172) {
    const secondOctet = Number(private172[1])
    return secondOctet >= 16 && secondOctet <= 31
  }

  return false
}

function isAllowedFiscalHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase()
  if (isPrivateOrLocalHost(normalizedHost)) return false

  return (
    normalizedHost.endsWith('.gov.br') ||
    normalizedHost.includes('sefaz') ||
    normalizedHost.includes('fazenda') ||
    normalizedHost.includes('nfce') ||
    normalizedHost.includes('nfe') ||
    normalizedHost.includes('dfe')
  )
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBrazilianNumber(value: string) {
  const normalized = String(value ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  return Number(normalized || 0)
}

function matchFirst(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match?.[1]) return cleanText(match[1])
  }

  return ''
}

function parseItemsFromHtml(html: string) {
  const blocks = html.match(/<tr[^>]*(?:id=["']?Item|class=["'][^"']*item)[\s\S]*?<\/tr>/gi)
    ?? html.match(/<li[^>]*>[\s\S]*?(?:Qtde|Qtd|Vl\.?\s*Unit|Valor)[\s\S]*?<\/li>/gi)
    ?? []

  const items = blocks
    .map((block) => {
      const fiscalName = matchFirst(block, [
        /class=["'][^"']*txtTit[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
        /class=["'][^"']*xProd[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
        /<td[^>]*>([\s\S]*?)<\/td>/i,
      ])
      const quantityText = matchFirst(block, [
        /(?:Qtde\.?|Qtd\.?)\s*:?\s*<\/?[^>]*>\s*([\d.,]+)/i,
        /class=["'][^"']*Rqtd[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      ])
      const unitCostText = matchFirst(block, [
        /(?:Vl\.?\s*Unit\.?|Valor\s*Unitario)\s*:?\s*<\/?[^>]*>\s*R?\$?\s*([\d.,]+)/i,
        /class=["'][^"']*RvlUnit[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      ])
      const totalText = matchFirst(block, [
        /class=["'][^"']*valor[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
        /(?:Valor\s*Total|Total)\s*:?\s*<\/?[^>]*>\s*R?\$?\s*([\d.,]+)/i,
      ])

      const quantity = parseBrazilianNumber(quantityText) || 1
      const total = parseBrazilianNumber(totalText)
      const unitCost = parseBrazilianNumber(unitCostText) || (quantity > 0 ? total / quantity : 0)

      if (!fiscalName || unitCost <= 0) return null

      return {
        fiscalName,
        quantity,
        unitCost,
        total: total || quantity * unitCost,
      }
    })
    .filter(Boolean)

  return items
}

function parseSupplierFromHtml(html: string) {
  return matchFirst(html, [
    /class=["'][^"']*txtTopo[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<h4[^>]*>([\s\S]*?)<\/h4>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]) || 'Fornecedor NFC-e'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Metodo nao permitido.', { status: 405, headers: corsHeaders })
  }

  const { qrCodeValue } = await req.json().catch(() => ({ qrCodeValue: '' }))
  const input = String(qrCodeValue ?? '').trim()
  const fiscalKey = extractFiscalKey(input)

  if (!input) {
    return Response.json({ ok: false, message: 'Informe a URL ou chave do cupom fiscal.' }, { status: 400, headers: corsHeaders })
  }

  if (!/^https?:\/\//i.test(input)) {
    return Response.json({
      ok: false,
      message: 'A consulta automatica precisa da URL completa do QR Code da NFC-e.',
      coupon: { fiscalKey, items: [] },
    }, { headers: corsHeaders })
  }

  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !isAllowedFiscalHost(url.hostname)) {
      return Response.json({
        ok: false,
        message: 'Por seguranca, informe uma URL publica de QR Code NFC-e da SEFAZ.',
        coupon: { fiscalKey, sourceUrl: input, items: [] },
      }, { status: 400, headers: corsHeaders })
    }

    const response = await fetch(input, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 LoccoBurger/1.0 NFCe Importer',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return Response.json({
        ok: false,
        message: `A SEFAZ respondeu ${response.status}. Tente abrir o cupom manualmente para confirmar se esta disponivel.`,
        coupon: { fiscalKey, sourceUrl: input, items: [] },
      }, { headers: corsHeaders })
    }

    const html = await response.text()
    const items = parseItemsFromHtml(html)

    if (items.length === 0) {
      return Response.json({
        ok: false,
        message: 'A consulta abriu, mas os itens nao foram reconhecidos automaticamente. Algumas SEFAZ usam captcha ou layout fechado.',
        coupon: { fiscalKey, sourceUrl: input, supplier: parseSupplierFromHtml(html), items: [] },
      }, { headers: corsHeaders })
    }

    return Response.json({
      ok: true,
      message: 'Cupom fiscal carregado da consulta publica da SEFAZ.',
      coupon: {
        fiscalKey,
        supplier: parseSupplierFromHtml(html),
        sourceUrl: input,
        issuedAt: new Date().toLocaleDateString('pt-BR'),
        items,
      },
    }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({
      ok: false,
      message: `Nao foi possivel conectar na SEFAZ: ${error.message}`,
      coupon: { fiscalKey, sourceUrl: input, items: [] },
    }, { status: 502, headers: corsHeaders })
  }
})
