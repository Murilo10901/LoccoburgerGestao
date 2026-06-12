import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

function getServiceRoleKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) return legacyKey

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secretKeys) return ''

  try {
    return JSON.parse(secretKeys).default ?? ''
  } catch {
    return ''
  }
}

async function verifySignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!appSecret) return true
  if (!signature?.startsWith('sha256=')) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expected = `sha256=${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`

  return expected === signature
}

function extractMessageBody(message: Record<string, any>) {
  if (message.text?.body) return message.text.body
  if (message.button?.text) return message.button.text
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title
  if (message.image?.caption) return message.image.caption
  if (message.document?.caption) return message.document.caption
  return `[${message.type ?? 'mensagem'} recebida]`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''
  const storeOwnerId = Deno.env.get('LOCCO_STORE_OWNER_ID') ?? ''

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: corsHeaders })
    }

    return new Response('Token de verificacao invalido.', { status: 403, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Metodo nao permitido.', { status: 405, headers: corsHeaders })
  }

  if (!storeOwnerId) {
    return new Response('LOCCO_STORE_OWNER_ID nao configurado.', { status: 500, headers: corsHeaders })
  }

  const rawBody = await req.text()
  const validSignature = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)
  if (!validSignature) {
    return new Response('Assinatura invalida.', { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = getServiceRoleKey()
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Supabase nao configurado.', { status: 500, headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const payload = JSON.parse(rawBody)
  const rows = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const value = change.value ?? {}
      const metadata = value.metadata ?? {}
      const contacts = value.contacts ?? []

      for (const message of value.messages ?? []) {
        const contact = contacts.find((item: any) => item.wa_id === message.from) ?? contacts[0] ?? {}
        const timestamp = Number(message.timestamp || 0)

        rows.push({
          user_id: storeOwnerId,
          message_id: message.id,
          from_phone: message.from,
          customer_name: contact.profile?.name ?? '',
          phone_number_id: metadata.phone_number_id ?? '',
          display_phone_number: metadata.display_phone_number ?? '',
          message_type: message.type ?? 'text',
          body: extractMessageBody(message),
          status: 'pendente',
          received_at: timestamp > 0 ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
          raw_payload: { entry, change, message, contact, metadata },
        })
      }
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('user_whatsapp_messages')
      .upsert(rows, { onConflict: 'user_id,message_id', ignoreDuplicates: true })

    if (error) {
      return new Response(`Erro ao gravar mensagem: ${error.message}`, { status: 500, headers: corsHeaders })
    }
  }

  return new Response(JSON.stringify({ ok: true, received: rows.length }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
