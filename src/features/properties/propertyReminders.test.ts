import { describe, expect, it } from 'vitest'
import type { Contract, Property } from '@/types'
import { buildPropertyReminders, nextRentReviewDate } from './propertyReminders'

const now = new Date('2026-11-18T10:00:00')

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    name: 'Piso Centro',
    owner: 'Gabriel',
    type: 'apartment',
    status: 'rented',
    address: 'Calle Falsa 1',
    city: 'Sevilla',
    province: 'Sevilla',
    ...overrides,
  }
}

function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'c1',
    propertyId: 'p1',
    tenantName: 'Ana',
    startDate: '2025-01-01',
    endDate: '2026-12-10',
    monthlyRent: 800,
    isActive: true,
    ...overrides,
  }
}

describe('nextRentReviewDate', () => {
  it('usa el último tramo del historial y suma un año', () => {
    const p = property({ rentHistory: [{ effectiveFrom: '2025-11', amount: 700 }, { effectiveFrom: '2026-10', amount: 750 }] })
    expect(nextRentReviewDate(p)).toBe('2027-10-01')
  })

  it('sin historial usa el mes de inicio del alquiler', () => {
    expect(nextRentReviewDate(property({ rentStartMonth: '2025-12' }))).toBe('2026-12-01')
  })

  it('sin datos no inventa una fecha', () => {
    expect(nextRentReviewDate(property())).toBeNull()
  })
})

describe('buildPropertyReminders', () => {
  it('avisa de un contrato que vence dentro de la ventana', () => {
    const reminders = buildPropertyReminders({ properties: [property()], contracts: [contract()], now })
    expect(reminders).toHaveLength(1)
    expect(reminders[0].kind).toBe('contract-expiry')
    expect(reminders[0].daysLeft).toBe(22)
    expect(reminders[0].overdue).toBe(false)
  })

  it('no avisa si el vencimiento queda lejos', () => {
    const reminders = buildPropertyReminders({ properties: [property()], contracts: [contract({ endDate: '2027-06-01' })], now })
    expect(reminders).toHaveLength(0)
  })

  it('marca como vencido un contrato cuya fecha ya pasó pero sigue activo', () => {
    const reminders = buildPropertyReminders({ properties: [property()], contracts: [contract({ endDate: '2026-11-01' })], now })
    expect(reminders[0].overdue).toBe(true)
    expect(reminders[0].daysLeft).toBeLessThan(0)
  })

  it('ignora contratos inactivos o borrados', () => {
    const reminders = buildPropertyReminders({
      properties: [property()],
      contracts: [contract({ isActive: false }), contract({ id: 'c2', isDeleted: true })],
      now,
    })
    expect(reminders).toHaveLength(0)
  })

  it('avisa de la revisión de renta atrasada', () => {
    const reminders = buildPropertyReminders({
      properties: [property({ rentHistory: [{ effectiveFrom: '2025-11', amount: 700 }] })],
      contracts: [],
      now,
    })
    expect(reminders).toHaveLength(1)
    expect(reminders[0].kind).toBe('rent-review')
    expect(reminders[0].overdue).toBe(true)
  })

  it('no avisa de revisión en inmuebles no alquilados', () => {
    const reminders = buildPropertyReminders({
      properties: [property({ status: 'vacant', rentHistory: [{ effectiveFrom: '2025-11', amount: 700 }] })],
      contracts: [],
      now,
    })
    expect(reminders).toHaveLength(0)
  })

  it('ordena primero lo más urgente', () => {
    const reminders = buildPropertyReminders({
      properties: [
        property({ id: 'p1', name: 'A', rentHistory: [{ effectiveFrom: '2025-11', amount: 700 }] }),
        property({ id: 'p2', name: 'B' }),
      ],
      contracts: [contract({ id: 'c2', propertyId: 'p2', endDate: '2026-12-10' })],
      now,
    })
    expect(reminders.map((reminder) => reminder.kind)).toEqual(['rent-review', 'contract-expiry'])
  })
})
