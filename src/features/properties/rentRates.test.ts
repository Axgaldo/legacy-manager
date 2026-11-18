import { describe, expect, it } from 'vitest'
import { Property } from '@/types'
import { isRentApplicableForMonth, normalizeRentHistory, rentAmountForMonth } from './rentRates'

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    name: 'Piso de prueba',
    owner: 'Gabriel',
    type: 'apartment',
    status: 'rented',
    address: 'Calle Falsa 1',
    city: 'Sevilla',
    province: 'Sevilla',
    ...overrides,
  }
}

describe('rentAmountForMonth', () => {
  it('devuelve 0 antes del mes de inicio del alquiler', () => {
    expect(rentAmountForMonth(property({ rentStartMonth: '2026-03', monthlyRent: 800 }), 2026, 2)).toBe(0)
    expect(rentAmountForMonth(property({ rentStartMonth: '2026-03', monthlyRent: 800 }), 2026, 3)).toBe(800)
  })

  it('usa la renta mensual cuando no hay historial', () => {
    expect(rentAmountForMonth(property({ monthlyRent: 750 }), 2026, 5)).toBe(750)
  })

  it('aplica el último tramo vigente en el mes consultado', () => {
    const withHistory = property({
      monthlyRent: 900,
      rentHistory: [
        { effectiveFrom: '2026-01', amount: 700 },
        { effectiveFrom: '2026-07', amount: 750 },
      ],
    })
    expect(rentAmountForMonth(withHistory, 2026, 3)).toBe(700)
    expect(rentAmountForMonth(withHistory, 2026, 7)).toBe(750)
    expect(rentAmountForMonth(withHistory, 2026, 12)).toBe(750)
  })

  it('para meses anteriores al primer tramo usa el primer importe conocido, no la renta actual', () => {
    const withHistory = property({
      monthlyRent: 900,
      rentHistory: [{ effectiveFrom: '2026-05', amount: 700 }],
    })
    // monthlyRent ya contiene la subida posterior; no debe aplicarse a 2026-01.
    expect(rentAmountForMonth(withHistory, 2026, 1)).toBe(700)
  })

  it('ignora tramos con fechas o importes inválidos', () => {
    const withHistory = property({
      monthlyRent: 800,
      rentHistory: [
        { effectiveFrom: 'mayo', amount: 500 },
        { effectiveFrom: '2026-02', amount: Number.NaN },
        { effectiveFrom: '2026-04', amount: 820 },
      ],
    })
    expect(rentAmountForMonth(withHistory, 2026, 5)).toBe(820)
  })

  it('devuelve 0 si no hay ni renta ni historial', () => {
    expect(rentAmountForMonth(property(), 2026, 5)).toBe(0)
  })
})

describe('isRentApplicableForMonth', () => {
  it('sin fecha de inicio se considera siempre aplicable', () => {
    expect(isRentApplicableForMonth(property(), 2024, 1)).toBe(true)
  })

  it('compara meses con formato YYYY-MM', () => {
    const p = property({ rentStartMonth: '2026-03' })
    expect(isRentApplicableForMonth(p, 2026, 2)).toBe(false)
    expect(isRentApplicableForMonth(p, 2026, 3)).toBe(true)
    expect(isRentApplicableForMonth(p, 2026, 11)).toBe(true)
  })
})

describe('normalizeRentHistory', () => {
  it('ordena por fecha y se queda con el último valor de cada mes', () => {
    expect(normalizeRentHistory([
      { effectiveFrom: '2026-01', amount: 700 },
      { effectiveFrom: '2025-12', amount: 650 },
      { effectiveFrom: '2026-01', amount: 720 },
    ])).toEqual([
      { effectiveFrom: '2025-12', amount: 650 },
      { effectiveFrom: '2026-01', amount: 720 },
    ])
  })
})
