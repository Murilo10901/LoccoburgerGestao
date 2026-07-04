import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'

const DEFAULT_ROLE = 'atendimento'

export const roleLabels = {
  admin: 'Administrador',
  atendimento: 'Atendimento',
  cozinha: 'Cozinha',
  garcom: 'Garcom',
}

export const roles = Object.entries(roleLabels).map(([id, label]) => ({ id, label }))

function isMissingRpc(error) {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.code === 'PGRST202' || message.includes('function') && message.includes('does not exist')
}

export async function loadUserProfile() {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, message: 'Entre no sistema para carregar o perfil.' }
  }

  const storeCode = user.user_metadata?.store_code ?? ''
  const rpcResult = await supabase.rpc('ensure_user_profile', {
    profile_email: user.email,
    profile_full_name: user.user_metadata?.full_name ?? '',
    requested_store_code: storeCode,
  })

  if (!rpcResult.error) {
    return { ok: true, profile: rpcResult.data?.[0] ?? null }
  }

  if (!isMissingRpc(rpcResult.error)) {
    return { ok: false, message: `Falha ao carregar perfil: ${rpcResult.error.message}` }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false, message: `Falha ao carregar perfil: ${error.message}` }
  }

  if (data) {
    return { ok: true, profile: data }
  }

  const profile = {
    user_id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? '',
    role: DEFAULT_ROLE,
  }

  const { data: createdProfile, error: createError } = await supabase
    .from('user_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (createError) {
    return { ok: false, message: `Falha ao criar perfil: ${createError.message}` }
  }

  return { ok: true, profile: createdProfile }
}

export async function listUserProfiles() {
  const { data, error } = await supabase.rpc('admin_list_user_profiles')

  if (error) {
    return { ok: false, message: `Falha ao carregar usuarios: ${error.message}`, profiles: [] }
  }

  return { ok: true, profiles: data ?? [] }
}

export async function updateUserRole(userId, role) {
  const { data, error } = await supabase.rpc('admin_update_user_role', {
    target_user_id: userId,
    new_role: role,
  })

  if (error) {
    return { ok: false, message: `Falha ao alterar perfil: ${error.message}` }
  }

  return { ok: true, profile: data?.[0] ?? null, message: 'Perfil atualizado com sucesso.' }
}

export async function attachUserToStore(email, role) {
  const { data, error } = await supabase.rpc('admin_attach_user_to_store', {
    target_email: email,
    new_role: role,
  })

  if (error) {
    return { ok: false, message: `Falha ao vincular usuario: ${error.message}` }
  }

  return { ok: true, profile: data?.[0] ?? null, message: 'Usuario vinculado a loja com sucesso.' }
}

export async function createManagedUser({ email, password, fullName, role }) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  if (!normalizedEmail || !password || String(password).length < 6) {
    return { ok: false, message: 'Informe e-mail e senha com no minimo 6 caracteres.' }
  }

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: normalizedEmail,
      password,
      full_name: String(fullName ?? '').trim(),
      role,
    },
  })

  if (error) {
    return {
      ok: false,
      message: `Falha ao criar usuario. Configure a Edge Function admin-create-user no Supabase. Detalhe: ${error.message}`,
    }
  }

  return {
    ok: true,
    profile: data?.profile ?? null,
    message: data?.message ?? 'Usuario criado e vinculado a loja com sucesso.',
  }
}

export async function deleteManagedUser(userId) {
  if (!userId) return { ok: false, message: 'Usuario invalido para excluir.' }

  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: {
      user_id: userId,
    },
  })

  if (error) {
    return {
      ok: false,
      message: `Falha ao excluir usuario. Configure a Edge Function admin-delete-user no Supabase. Detalhe: ${error.message}`,
    }
  }

  return {
    ok: true,
    message: data?.message ?? 'Usuario excluido com sucesso.',
  }
}
