/**
 * Conversión defensiva de datos que vienen de Firestore.
 *
 * Los documentos pueden ser antiguos, haber sido editados a mano o contener
 * tipos inesperados. Estos helpers se usan en los mappers de los servicios para
 * que un valor corrupto no acabe como `NaN` en un importe ni como `undefined`
 * donde la app espera un string.
 */

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** Número finito o `undefined`. Acepta strings numéricos y coma decimal. */
export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Número finito con valor por defecto (para campos que siempre deben existir). */
export function asNumberOr(value: unknown, fallback: number): number {
  return asNumber(value) ?? fallback
}

/** Booleano tolerante a `true/false` y a la cadena `"true"`/`"false"`. */
export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return fallback
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => asNumber(item) ?? 0) : []
}

/** Fecha ISO de un Timestamp de Firestore, Date o string; `undefined` si no es válida. */
export function asIsoDate(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  const maybe = value as { toDate?: () => Date } | null
  if (maybe && typeof maybe.toDate === 'function') {
    const date = maybe.toDate()
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  return undefined
}
