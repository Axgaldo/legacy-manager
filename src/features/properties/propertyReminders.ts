import type { Contract, Property } from '@/types'

/**
 * Avisos de Inicio: contratos que vencen y revisiones de renta que tocan (o que
 * ya han pasado). Es lógica pura para poder probarla sin Firestore.
 */

export const REMINDER_WINDOW_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

export type ReminderKind = 'contract-expiry' | 'rent-review'

export interface PropertyReminder {
  id: string
  kind: ReminderKind
  propertyId: string
  title: string
  detail: string
  /** Fecha del aviso en formato YYYY-MM-DD. */
  date: string
  /** Días que faltan (negativo si ya ha pasado). */
  daysLeft: number
  overdue: boolean
}

function toDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function daysBetween(iso: string, now: Date): number | null {
  const date = toDate(iso)
  if (!date) return null
  return Math.ceil((startOfDay(date) - startOfDay(now)) / DAY_MS)
}

function formatDate(iso: string): string {
  const date = toDate(iso)
  return date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : iso
}

/**
 * Próxima revisión de renta: un año después del último tramo del historial o,
 * si no hay historial, un año después del inicio del alquiler.
 */
export function nextRentReviewDate(property: Property): string | null {
  const rates = (property.rentHistory ?? [])
    .filter((rate) => /^\d{4}-\d{2}$/.test(rate.effectiveFrom))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const last = rates[rates.length - 1]?.effectiveFrom ?? property.rentStartMonth
  if (!last || !/^\d{4}-\d{2}$/.test(last)) return null
  const [year, month] = last.split('-').map(Number)
  return `${year + 1}-${String(month).padStart(2, '0')}-01`
}

/** Contrato vigente de un inmueble; si hay varios marcados, el más reciente. */
function activeContract(contracts: Contract[], propertyId: string): Contract | undefined {
  return contracts
    .filter((contract) => contract.propertyId === propertyId && contract.isActive && !contract.isDeleted)
    .sort((a, b) => timestampOf(b.createdAt) - timestampOf(a.createdAt))[0]
}

function timestampOf(value: unknown): number {
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return Number((value as { toMillis: () => number }).toMillis()) || 0
  }
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value ?? '')) || 0
}

export function buildPropertyReminders(args: {
  properties: Property[]
  contracts: Contract[]
  now?: Date
  windowDays?: number
}): PropertyReminder[] {
  const now = args.now ?? new Date()
  const windowDays = args.windowDays ?? REMINDER_WINDOW_DAYS
  const reminders: PropertyReminder[] = []

  args.properties.forEach((property) => {
    const contract = activeContract(args.contracts, property.id)
    if (contract?.endDate) {
      const daysLeft = daysBetween(contract.endDate, now)
      if (daysLeft !== null && daysLeft <= windowDays) {
        reminders.push({
          id: `contract-${contract.id}`,
          kind: 'contract-expiry',
          propertyId: property.id,
          title: `Contrato de ${contract.tenantName || 'alquiler'}`,
          detail: `${property.name} · vence el ${formatDate(contract.endDate)}`,
          date: contract.endDate.slice(0, 10),
          daysLeft,
          overdue: daysLeft < 0,
        })
      }
    }

    if (property.status !== 'rented') return
    const review = nextRentReviewDate(property)
    if (!review) return
    const daysLeft = daysBetween(review, now)
    if (daysLeft === null || daysLeft > windowDays) return
    reminders.push({
      id: `rent-review-${property.id}`,
      kind: 'rent-review',
      propertyId: property.id,
      title: 'Revisión de renta',
      detail: `${property.name} · tocaba el ${formatDate(review)}`,
      date: review,
      daysLeft,
      overdue: daysLeft < 0,
    })
  })

  return reminders.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title, 'es'))
}
