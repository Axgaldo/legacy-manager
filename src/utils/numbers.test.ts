import { describe, expect, it } from 'vitest'
import { formatGroupedEsNumber, groupThousands } from './numbers'

describe('groupThousands', () => {
  it('agrupa también las cifras de cuatro dígitos', () => {
    expect(groupThousands('1000')).toBe('1.000')
    expect(groupThousands('10000')).toBe('10.000')
    expect(groupThousands('1234567')).toBe('1.234.567')
  })

  it('conserva los decimales', () => {
    expect(groupThousands('1000,5')).toBe('1.000,5')
    expect(groupThousands('1234,56')).toBe('1.234,56')
  })

  it('respeta los negativos', () => {
    expect(groupThousands('-1000')).toBe('-1.000')
  })

  it('no toca los números cortos', () => {
    expect(groupThousands('999')).toBe('999')
    expect(groupThousands('0')).toBe('0')
  })
})

describe('formatGroupedEsNumber', () => {
  it('formatea al estilo es-ES con miles agrupados', () => {
    expect(formatGroupedEsNumber(1000)).toBe('1.000')
    expect(formatGroupedEsNumber(1234.567)).toBe('1.234,57')
  })

  it('devuelve 0 para valores no finitos', () => {
    expect(formatGroupedEsNumber(Number.NaN)).toBe('0')
    expect(formatGroupedEsNumber(Number.POSITIVE_INFINITY)).toBe('0')
  })
})
