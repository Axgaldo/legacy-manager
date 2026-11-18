import { RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'

/**
 * Lógica compartida de gastos periódicos. Antes estaba duplicada en tres
 * componentes (panel, vista general y panel de inicio); ahora hay una sola
 * fuente de verdad para los vencimientos y los importes.
 */

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** ¿Tiene este gasto periódico un vencimiento en el mes indicado? */
export function isScheduleDueInMonth(schedule: RecurringExpenseSchedule, year: number, month: number): boolean {
  const [startYear, startMonth] = schedule.startDate.slice(0, 7).split('-').map(Number)
  const monthDelta = (year - startYear) * 12 + month - startMonth
  const [endYear, endMonth] = (schedule.endDate ?? '9999-12').slice(0, 7).split('-').map(Number)
  const beforeEnd = (endYear - year) * 12 + endMonth - month >= 0
  return monthDelta >= 0 && beforeEnd && monthDelta % Math.max(1, schedule.intervalMonths) === 0
}

/** Id de la ocurrencia de un vencimiento, igual que el servicio que la escribe. */
export function occurrenceIdFor(scheduleId: string, year: number, month: number): string {
  return `${scheduleId}_${year}-${pad2(month)}`
}

/** Importe de un vencimiento: la ocurrencia real si existe, o el previsto. */
export function occurrenceAmount(
  schedule: RecurringExpenseSchedule,
  occurrences: Map<string, RecurringExpenseOccurrence>,
  year: number,
  month: number,
): number {
  return occurrences.get(occurrenceIdFor(schedule.id, year, month))?.amount ?? schedule.amount
}

/**
 * Media mensual de los gastos fijos: cada obligación periódica **activa**
 * prorrateada por su intervalo (la comunidad al mes, el IBI anual / 12…).
 * Es la cifra correcta para un KPI «gastos fijos al mes»; los gastos
 * puntuales no entran aquí porque no son fijos.
 */
export function recurringMonthlyAverage(schedules: RecurringExpenseSchedule[], now = new Date()): number {
  const currentMonthKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  return schedules
    .filter((schedule) => schedule.isActive !== false && (!schedule.endDate || schedule.endDate.slice(0, 7) >= currentMonthKey))
    .reduce((total, schedule) => total + (schedule.amount || 0) / Math.max(1, schedule.intervalMonths || 1), 0)
}

/** Media mensual de los gastos fijos de un inmueble concreto. */
export function recurringMonthlyAverageForProperty(
  schedules: RecurringExpenseSchedule[],
  propertyId: string,
  now = new Date(),
): number {
  return recurringMonthlyAverage(schedules.filter((schedule) => schedule.propertyId === propertyId), now)
}
