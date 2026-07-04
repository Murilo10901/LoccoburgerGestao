export function parseDateValue(value) {
  if (value instanceof Date) return value
  if (value === null || value === undefined || value === '') return new Date()

  if (typeof value === 'number') return new Date(value)

  const text = String(value).trim()
  const numericValue = Number(text)
  if (Number.isFinite(numericValue) && text !== '') return new Date(numericValue)

  return new Date(text)
}

export function getLocalDateKey(value = new Date()) {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayLocalDateKey() {
  return getLocalDateKey(new Date())
}

export function formatLocalDateLabel(dateKey, options = {}) {
  if (!dateKey) return 'Sem data'

  const [year, month, day] = String(dateKey).split('-').map(Number)
  if (!year || !month || !day) return 'Sem data'

  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', options)
}
