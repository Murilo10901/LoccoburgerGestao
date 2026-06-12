import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function getServiceRoleKey() {
  const loccoKey = Deno.env.get('LOCCOBURGER_SERVICE_ROLE_KEY')
  if (loccoKey) return loccoKey

  const directKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (directKey) return directKey

  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secretKeysRaw) return ''

  try {
    const parsed = JSON.parse(secretKeysRaw)
    return (
      parsed.service_role ||
      parsed.service_role_key ||
      parsed.serviceRole ||
      parsed.SUPABASE_SERVICE_ROLE_KEY ||
      parsed.LOCCOBURGER_SERVICE_ROLE_KEY ||
      ''
    )
  } catch (_error) {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ exists: false, message: 'Metodo nao permitido.' }, 405)
  }

  try {
    const payload = await req.json().catch(() => ({}))
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''

    if (!email) {
      return jsonResponse({ exists: false, message: 'Informe o e-mail.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = getServiceRoleKey()

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Variaveis ausentes:', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasSecretKeys: Boolean(Deno.env.get('SUPABASE_SECRET_KEYS')),
      })

      return jsonResponse({
        exists: false,
        message: 'Funcao nao configurada. Configure a service role key nas secrets do Supabase.',
      }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const perPage = 1000
    let page = 1

    while (page <= 50) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        console.error('Erro ao consultar usuarios:', error)
        return jsonResponse({ exists: false, message: 'Erro ao consultar usuarios.' }, 500)
      }

      const users = data?.users ?? []
      const exists = users.some((user) => user.email?.trim().toLowerCase() === email)

      if (exists) {
        return jsonResponse({ exists: true })
      }

      if (users.length < perPage) break
      page += 1
    }

    return jsonResponse({ exists: false })
  } catch (error) {
    console.error('Erro inesperado:', error)
    return jsonResponse({ exists: false, message: 'Erro inesperado na funcao.' }, 500)
  }
})
