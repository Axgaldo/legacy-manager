import { describe, expect, it } from 'vitest'
import { BACKUP_REMINDER_DAYS, backupStatus } from './backupReminder'

const now = new Date('2026-11-18T12:00:00.000Z')

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('backupStatus', () => {
  it('avisa cuando nunca se ha descargado una copia', () => {
    const status = backupStatus(null, now)
    expect(status.isDue).toBe(true)
    expect(status.daysSince).toBeNull()
  })

  it('no avisa el mismo día de la copia', () => {
    const status = backupStatus(daysAgo(0), now)
    expect(status.isDue).toBe(false)
    expect(status.daysSince).toBe(0)
    expect(status.daysUntilReminder).toBe(BACKUP_REMINDER_DAYS)
  })

  it('no avisa un día antes del límite', () => {
    const status = backupStatus(daysAgo(BACKUP_REMINDER_DAYS - 1), now)
    expect(status.isDue).toBe(false)
    expect(status.daysUntilReminder).toBe(1)
  })

  it('avisa justo al cumplir los 60 días', () => {
    const status = backupStatus(daysAgo(BACKUP_REMINDER_DAYS), now)
    expect(status.isDue).toBe(true)
    expect(status.daysSince).toBe(BACKUP_REMINDER_DAYS)
    expect(status.daysUntilReminder).toBe(0)
  })

  it('sigue avisando pasados los 60 días', () => {
    const status = backupStatus(daysAgo(180), now)
    expect(status.isDue).toBe(true)
    expect(status.daysSince).toBe(180)
  })

  it('trata una fecha inválida como si nunca se hubiera hecho copia', () => {
    expect(backupStatus('no-es-una-fecha', now).isDue).toBe(true)
  })

  it('no muestra días negativos si el reloj del equipo va adelantado', () => {
    const future = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const status = backupStatus(future, now)
    expect(status.daysSince).toBe(0)
    expect(status.isDue).toBe(false)
  })
})
