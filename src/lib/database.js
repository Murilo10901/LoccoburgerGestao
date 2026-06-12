import { getCurrentUser } from './auth.js'
import { supabase } from './supabaseClient.js'
import { backupStoredState, clearStoredState, hasStoredState, loadStoredState } from './storage.js'
import { getDataOwnerId } from './tenantRepository.js'

const APP_STATE_VERSION = '1.0'

export async function loadUserAppState() {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, message: 'Entre no sistema para carregar os dados.' }
  }
  const ownerId = await getDataOwnerId()

  const { data, error } = await supabase
    .from('user_app_state')
    .select('app_data')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: `Falha ao carregar dados: ${error.message}` }
  }

  return { ok: true, user, appState: data?.app_data ?? null }
}

export async function upsertUserAppState(appState) {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, message: 'Entre no sistema para salvar os dados.' }
  }
  const ownerId = await getDataOwnerId()

  const { error } = await supabase
    .from('user_app_state')
    .upsert(
      {
        user_id: ownerId,
        app_data: appState,
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    return { ok: false, message: `Erro ao salvar: ${error.message}` }
  }

  return { ok: true, message: 'Dados salvos com sucesso.' }
}

export async function saveUserAppState(appState) {
  return upsertUserAppState(appState)
}

export async function migrateLocalStorageToSupabase() {
  const localState = loadStoredState()
  if (!localState) {
    return { ok: true, migrated: false, message: 'Nao havia dados locais para migrar.' }
  }

  const backupKey = backupStoredState('pre-supabase-migration')
  const appState = {
    ...localState,
    migrationInfo: {
      version: APP_STATE_VERSION,
      migratedAt: new Date().toISOString(),
      backupKey,
    },
  }

  const result = await upsertUserAppState(appState)
  if (!result.ok) {
    return {
      ...result,
      migrated: false,
      backupKey,
      message: `${result.message} O backup local foi mantido.`,
    }
  }

  clearLocalStorageAfterMigration()
  return { ok: true, migrated: true, appState, backupKey, message: 'Dados locais migrados para o Supabase.' }
}

export function clearLocalStorageAfterMigration() {
  clearStoredState()
}

export function hasLocalDataToMigrate() {
  return hasStoredState()
}
