import { describe, expect, it } from 'vitest'
import { formatEuroValue, formatOriginalValue, maskedAmount, maskedEuro } from './money'

describe('formatEuroValue', () => {
  it('agrupa los miles siempre, también con cuatro cifras', () => {
    expect(formatEuroValue(1000)).toContain('1.000')
    expect(formatEuroValue(100000)).toContain('100.000')
  })

  it('admite dos decimales cuando se piden', () => {
    expect(formatEuroValue(1234.567, 2)).toContain('1.234,57')
  })

  it('muestra un guion cuando no hay importe', () => {
    expect(formatEuroValue(undefined)).toBe('—')
    expect(formatEuroValue(Number.NaN)).toBe('—')
  })
})

describe('formatOriginalValue', () => {
  it('usa «ptas» para la peseta y el símbolo para el resto', () => {
    expect(formatOriginalValue(1000, 'ESP')).toBe('1.000 ptas')
    expect(formatOriginalValue(1500, 'USD')).toBe('1.500 $')
  })

  it('mantiene los decimales sin agrupar más de la cuenta', () => {
    expect(formatOriginalValue(12.5, 'CHF')).toBe('12,5 CHF')
  })

  it('devuelve vacío si no hay importe', () => {
    expect(formatOriginalValue(undefined, 'ESP')).toBe('')
  })
})

describe('máscaras del modo incógnito', () => {
  it('termina con el símbolo de la divisa', () => {
    expect(maskedEuro()).toMatch(/€$/)
    expect(maskedAmount('ESP')).toMatch(/ptas$/)
    expect(maskedAmount('USD')).toMatch(/\$$/)
  })

  it('nunca muestra el importe real (solo 3-4 símbolos y la divisa)', () => {
    const masked = maskedEuro().replace(/\s*€$/, '')
    expect(masked.length).toBeGreaterThanOrEqual(3)
    expect(masked.length).toBeLessThanOrEqual(4)
    expect(masked).not.toMatch(/\d/)
  })
})
