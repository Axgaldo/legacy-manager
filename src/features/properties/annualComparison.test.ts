import { describe, expect, it } from 'vitest'
import type { Expense, RecurringExpenseSchedule, RentPayment } from '@/types'
import { buildAnnualComparison, paymentIncome } from './annualComparison'

const now = new Date('2026-11-18T10:00:00')

function payment(overrides: Partial<RentPayment> = {}): RentPayment {
  return {
    id: 'pay1',
    propertyId: 'p1',
    year: 2026,
    month: 1,
    amount: 800,
    isPaid: true,
    invoiceIssued: false,
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    propertyId: 'p1',
    date: '2026-02-01',
    year: 2026,
    month: 2,
    category: 'comunidad',
    amount: 50,
    description: 'Comunidad',
    ...overrides,
  }
}

describe('paymentIncome', () => {
  it('prioriza lo realmente cobrado', () => {
    expect(paymentIncome(payment({ receivedAmount: 700, isPaid: true, amount: 800 }))).toBe(700)
  })

  it('si no hay cobro registrado usa el importe solo cuando está pagado', () => {
    expect(paymentIncome(payment({ receivedAmount: undefined, isPaid: true, amount: 800 }))).toBe(800)
    expect(paymentIncome(payment({ receivedAmount: undefined, isPaid: false, amount: 800 }))).toBe(0)
  })
})

describe('buildAnnualComparison', () => {
  it('agrupa ingresos y gastos por año e ignora otros inmuebles', () => {
    const result = buildAnnualComparison({
      propertyId: 'p1',
      payments: [
        payment({ id: 'a', month: 1 }),
        payment({ id: 'b', month: 2, receivedAmount: 750 }),
        payment({ id: 'c', propertyId: 'p2' }),
        payment({ id: 'd', year: 2025 }),
      ],
      expenses: [
        expense({ id: 'e1' }),
        expense({ id: 'e2', amount: 120 }),
        expense({ id: 'e3', propertyId: 'p2' }),
      ],
      now,
      years: 2,
    })

    expect(result.rows.map((row) => row.year)).toEqual([2025, 2026])
    expect(result.rows[1]).toEqual({ year: 2026, income: 800 + 750, expenses: 170, net: 1550 - 170 })
    expect(result.totals.income).toBe(2350)
    expect(result.totals.expenses).toBe(170)
    expect(result.totals.net).toBe(2180)
  })

  it('usa la fecha del gasto si el año no es válido', () => {
    const result = buildAnnualComparison({
      propertyId: 'p1',
      payments: [],
      expenses: [expense({ year: Number.NaN, date: '2024-05-03' })],
      now,
      years: 5,
    })
    expect(result.rows.find((row) => row.year === 2024)?.expenses).toBe(50)
  })

  it('devuelve ceros sin datos', () => {
    const result = buildAnnualComparison({ propertyId: 'p1', payments: [], expenses: [], now, years: 3 })
    expect(result.rows).toHaveLength(3)
    expect(result.rows.every((row) => row.income === 0 && row.expenses === 0)).toBe(true)
  })

  it('incluye los gastos periódicos y usa la ocurrencia real cuando existe', () => {
    const schedule = (overrides: Partial<RecurringExpenseSchedule>): RecurringExpenseSchedule => ({
      id: 's',
      propertyId: 'p1',
      category: 'comunidad',
      description: 'Comunidad',
      amount: 100,
      startDate: '2026-01-01',
      intervalMonths: 1,
      requiresInvoice: false,
      chargeToTenant: false,
      isDeductible: true,
      isActive: true,
      ...overrides,
    })
    const result = buildAnnualComparison({
      propertyId: 'p1',
      payments: [],
      expenses: [],
      schedules: [
        schedule({ id: 'comunidad', amount: 100 }),
        schedule({ id: 'ibi', category: 'ibi', amount: 600, intervalMonths: 12 }),
        schedule({ id: 'inactivo', amount: 999, isActive: false }),
      ],
      occurrences: [{
        id: 'comunidad_2026-03',
        scheduleId: 'comunidad',
        propertyId: 'p1',
        year: 2026,
        month: 3,
        amount: 120,
        invoiceReceived: false,
        isPaid: false,
      }],
      now,
      years: 1,
    })

    // 12 meses de comunidad (uno a 120) + IBI anual 600.
    expect(result.rows[0].expenses).toBe(1820)
    expect(result.rows[0].net).toBe(-1820)
  })
})
