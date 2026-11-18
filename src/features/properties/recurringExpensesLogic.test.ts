import { describe, expect, it } from 'vitest'
import { RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import {
  isScheduleDueInMonth,
  occurrenceAmount,
  occurrenceIdFor,
  recurringMonthlyAverage,
  recurringMonthlyAverageForProperty,
} from './recurringExpensesLogic'

function schedule(overrides: Partial<RecurringExpenseSchedule> = {}): RecurringExpenseSchedule {
  return {
    id: 's1',
    propertyId: 'p1',
    category: 'comunidad',
    description: 'Comunidad',
    amount: 40,
    startDate: '2026-01-01',
    intervalMonths: 1,
    requiresInvoice: false,
    chargeToTenant: false,
    isDeductible: true,
    isActive: true,
    ...overrides,
  }
}

function occurrence(overrides: Partial<RecurringExpenseOccurrence> = {}): RecurringExpenseOccurrence {
  return {
    id: 'o1',
    scheduleId: 's1',
    propertyId: 'p1',
    year: 2026,
    month: 3,
    amount: 55,
    invoiceReceived: false,
    isPaid: false,
    ...overrides,
  }
}

describe('isScheduleDueInMonth', () => {
  it('marca cada mes en un gasto mensual que empieza en enero de 2026', () => {
    const monthly = schedule()
    expect(isScheduleDueInMonth(monthly, 2026, 1)).toBe(true)
    expect(isScheduleDueInMonth(monthly, 2026, 2)).toBe(true)
    expect(isScheduleDueInMonth(monthly, 2025, 12)).toBe(false)
  })

  it('respeta el intervalo anual (IBI solo en su mes)', () => {
    const yearly = schedule({ intervalMonths: 12, startDate: '2026-03-15' })
    expect(isScheduleDueInMonth(yearly, 2026, 3)).toBe(true)
    expect(isScheduleDueInMonth(yearly, 2026, 4)).toBe(false)
    expect(isScheduleDueInMonth(yearly, 2027, 3)).toBe(true)
  })

  it('incluye el mes de fin y deja de vencer después', () => {
    const bounded = schedule({ endDate: '2026-06-30' })
    expect(isScheduleDueInMonth(bounded, 2026, 6)).toBe(true)
    expect(isScheduleDueInMonth(bounded, 2026, 7)).toBe(false)
  })

  it('trata un intervalo 0 como mensual en lugar de dividir por cero', () => {
    expect(isScheduleDueInMonth(schedule({ intervalMonths: 0 }), 2026, 5)).toBe(true)
  })
})

describe('occurrenceIdFor y occurrenceAmount', () => {
  it('genera el id con el mes a dos dígitos', () => {
    expect(occurrenceIdFor('abc', 2026, 3)).toBe('abc_2026-03')
    expect(occurrenceIdFor('abc', 2026, 11)).toBe('abc_2026-11')
  })

  it('usa el importe real de la ocurrencia y cae al previsto si no existe', () => {
    const occurrences = new Map([[occurrenceIdFor('s1', 2026, 3), occurrence({ amount: 57.5 })]])
    expect(occurrenceAmount(schedule(), occurrences, 2026, 3)).toBe(57.5)
    expect(occurrenceAmount(schedule(), occurrences, 2026, 4)).toBe(40)
  })
})

describe('recurringMonthlyAverage', () => {
  const now = new Date(2026, 10, 15) // noviembre de 2026

  it('prorratea el IBI anual a 1/12 y suma la comunidad', () => {
    const total = recurringMonthlyAverage([
      schedule({ id: 'comunidad', amount: 40, intervalMonths: 1 }),
      schedule({ id: 'ibi', amount: 600, intervalMonths: 12, category: 'ibi' }),
    ], now)
    expect(total).toBeCloseTo(90, 5)
  })

  it('ignora los gastos inactivos y los que ya han terminado', () => {
    const total = recurringMonthlyAverage([
      schedule({ id: 'activo', amount: 30 }),
      schedule({ id: 'inactivo', amount: 100, isActive: false }),
      schedule({ id: 'terminado', amount: 200, endDate: '2026-10-31' }),
    ], now)
    expect(total).toBeCloseTo(30, 5)
  })

  it('cuenta una prórroga que termina este mismo mes', () => {
    const total = recurringMonthlyAverage([schedule({ amount: 60, endDate: '2026-11-30' })], now)
    expect(total).toBeCloseTo(60, 5)
  })

  it('solo suma los gastos del inmueble pedido', () => {
    const total = recurringMonthlyAverageForProperty([
      schedule({ id: 'a', propertyId: 'p1', amount: 40 }),
      schedule({ id: 'b', propertyId: 'p2', amount: 90 }),
    ], 'p2', now)
    expect(total).toBeCloseTo(90, 5)
  })
})
