export const STORAGE_KEY = 'loccoburger-gestao-state-v1'
const BACKUP_PREFIX = 'loccoburger-gestao-backup-'

export function loadStoredState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY)
    return rawState ? JSON.parse(rawState) : null
  } catch (error) {
    console.warn('Nao foi possivel carregar os dados locais.', error)
    return null
  }
}

export function saveStoredState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Nao foi possivel salvar os dados locais.', error)
  }
}

export function clearStoredState() {
  localStorage.removeItem(STORAGE_KEY)
}

export function backupStoredState(reason = 'backup') {
  const state = loadStoredState()
  if (!state) return null

  const backup = {
    reason,
    createdAt: new Date().toISOString(),
    appState: state,
  }
  const backupKey = `${BACKUP_PREFIX}${Date.now()}`
  localStorage.setItem(backupKey, JSON.stringify(backup))
  return backupKey
}

export function hasStoredState() {
  return Boolean(localStorage.getItem(STORAGE_KEY))
}
