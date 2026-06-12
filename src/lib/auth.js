import { supabase } from './supabaseClient.js'

function mapAuthError(error) {
  if (!error) return 'Nao foi possivel concluir a operacao.'

  const message = error.message?.toLowerCase() ?? ''
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('fetch')) {
    return 'Nao foi possivel conectar ao Supabase. Verifique se o projeto esta ativo e se a URL do Supabase esta correta.'
  }
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'E-mail ou senha invalidos.'
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Este e-mail ja esta cadastrado.'
  }
  if (message.includes('password') && message.includes('weak')) {
    return 'Use uma senha mais forte para criar o acesso.'
  }
  if (message.includes('email')) {
    return 'Confira o e-mail informado.'
  }

  return error.message || 'Nao foi possivel concluir a operacao.'
}

export async function getCurrentUser() {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

export async function getCurrentSession() {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session
}

export async function signUp(email, password, options = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        store_code: options.storeCode?.trim() || '',
      },
    },
  })
  if (error) {
    return { ok: false, message: mapAuthError(error) }
  }

  return {
    ok: true,
    user: data.user,
    session: data.session,
    message: data.session
      ? 'Cadastro criado com sucesso.'
      : 'Cadastro criado. Se o Supabase pedir confirmacao, confirme o e-mail antes de entrar.',
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { ok: false, message: mapAuthError(error) }
  }

  return { ok: true, user: data.user, session: data.session, message: 'Entrada realizada com sucesso.' }
}

export async function resetPassword(email) {
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail) {
    return { ok: false, message: 'Informe o e-mail para recuperar a senha.' }
  }

  const { data: existsData, error: existsError } = await supabase.functions.invoke('auth-user-exists', {
    body: {
      email: normalizedEmail,
    },
  })

  if (existsError) {
    console.error('Erro ao verificar e-mail:', existsError)
    return {
      ok: false,
      message: 'Nao foi possivel verificar se esse e-mail esta cadastrado.',
    }
  }

  if (existsData?.exists !== true) {
    return {
      ok: false,
      message: 'Este e-mail nao existe no sistema. Verifique o e-mail informado ou fale com o administrador.',
    }
  }

  const resetUrl = `${window.location.origin}/gestao?reset=senha`

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: resetUrl,
  })

  if (error) {
    console.error('Erro ao enviar recuperacao de senha:', error)
    return {
      ok: false,
      message: mapAuthError(error),
    }
  }

  return {
    ok: true,
    message: 'Enviamos um link de recuperacao para o e-mail informado.',
  }
}

export async function updatePassword(password) {
  if (!password || password.length < 6) {
    return { ok: false, message: 'A nova senha precisa ter no minimo 6 caracteres.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { ok: false, message: mapAuthError(error) }
  }

  return { ok: true, message: 'Senha alterada com sucesso.' }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    return { ok: false, message: mapAuthError(error) }
  }

  return { ok: true, message: 'Voce saiu do sistema.' }
}
