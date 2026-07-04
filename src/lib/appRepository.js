import {
  hasLocalDataToMigrate,
  loadUserAppState,
  migrateLocalStorageToSupabase,
  saveUserAppState,
} from './database.js'
import { clearStoredState, loadStoredState, saveStoredState } from './storage.js'
import { isSupabaseConfigured } from './supabaseClient.js'
import { localStateToSupabaseMap } from './supabaseTables.js'

export function getRepositoryStatus(user, saveStatus = 'idle') {
  if (!isSupabaseConfigured) {
    return {
      mode: 'local',
      label: 'Local seguro',
      isSupabaseConfigured,
      mappedEntities: localStateToSupabaseMap,
    }
  }

  if (!user) {
    return {
      mode: 'supabase-ready',
      label: 'Supabase pronto',
      isSupabaseConfigured,
      mappedEntities: localStateToSupabaseMap,
    }
  }

  const labels = {
    loading: 'Carregando dados...',
    saving: 'Salvando...',
    saved: 'Dados salvos',
    error: 'Erro ao salvar',
    idle: 'Supabase conectado',
  }

  return {
    mode: saveStatus === 'error' ? 'supabase-error' : 'supabase-ready',
    label: labels[saveStatus] ?? labels.idle,
    isSupabaseConfigured,
    mappedEntities: localStateToSupabaseMap,
  }
}

export async function loadAppState(defaultState) {
  if (!isSupabaseConfigured) {
    return {
      source: 'local',
      state: loadStoredState() ?? defaultState,
      message: 'Usando armazenamento local.',
    }
  }

  const remoteResult = await loadUserAppState()
  if (!remoteResult.ok) {
    return {
      source: 'local-fallback',
      state: loadStoredState() ?? defaultState,
      message: remoteResult.message,
    }
  }

  if (remoteResult.appState) {
    return {
      source: 'supabase',
      state: remoteResult.appState,
      message: 'Dados carregados do Supabase.',
    }
  }

  if (hasLocalDataToMigrate()) {
    const migration = await migrateLocalStorageToSupabase()
    if (migration.ok && migration.appState) {
      return {
        source: 'migration',
        state: migration.appState,
        message: migration.message,
      }
    }
  }

  const createResult = await saveUserAppState(defaultState)
  return {
    source: createResult.ok ? 'supabase' : 'local-fallback',
    state: defaultState,
    message: createResult.ok ? 'Base inicial criada no Supabase.' : createResult.message,
  }
}

export async function saveAppState(state) {
  if (!isSupabaseConfigured) {
    saveStoredState(state)
    return { ok: true, source: 'local', message: 'Dados salvos localmente.' }
  }

  const result = await saveUserAppState(state)
  if (!result.ok) {
    saveStoredState(state)
    return { ...result, source: 'local-fallback' }
  }

  saveStoredState(state)
  return { ...result, source: 'supabase' }
}

export function clearAppState() {
  clearStoredState()
}
