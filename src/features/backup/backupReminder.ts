/**
 * Recordatorio de copia de seguridad.
 *
 * No escribe nada en Firebase: solo guarda en `localStorage` la fecha de la
 * última copia completa descargada en este navegador y avisa cuando han pasado
 * 60 días. Si se limpian los datos del sitio, el recordatorio se olvida (el
 * archivo descargado no).
 */

export const BACKUP_REMINDER_DAYS = 60

const STORAGE_KEY = 'legacy-manager:ultima-copia'
const DAY_MS = 24 * 60 * 60 * 1000

export interface BackupStatus {
  lastBackupAt: string | null
  /** Días completos desde la última copia; `null` si nunca se ha hecho. */
  daysSince: number | null
  /** Días que faltan para el próximo aviso; 0 si ya toca. */
  daysUntilReminder: number
  isDue: boolean
}

export function backupStatus(lastBackupAt: string | null, now = new Date()): BackupStatus {
  const timestamp = lastBackupAt ? Date.parse(lastBackupAt) : Number.NaN
  if (!lastBackupAt || !Number.isFinite(timestamp)) {
    return { lastBackupAt: null, daysSince: null, daysUntilReminder: 0, isDue: true }
  }
  const daysSince = Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS))
  return {
    lastBackupAt,
    daysSince,
    daysUntilReminder: Math.max(0, BACKUP_REMINDER_DAYS - daysSince),
    isDue: daysSince >= BACKUP_REMINDER_DAYS,
  }
}

/** Fecha de la última copia completa en este navegador, o `null`. */
export function readLastBackupAt(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value || !Number.isFinite(Date.parse(value))) return null
    return value
  } catch {
    return null
  }
}

/** Marca la copia completa como descargada ahora mismo. */
export function markBackupDone(date = new Date()): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, date.toISOString())
  } catch {
    // Sin localStorage (modo privado): el recordatorio no persiste.
  }
}
