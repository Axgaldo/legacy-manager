import { describe, expect, it } from 'vitest'
import { asBoolean, asIsoDate, asNumber, asNumberArray, asNumberOr, asString, asStringArray } from './coerce'

describe('asString', () => {
  it('devuelve solo strings y cae al valor por defecto', () => {
    expect(asString('hola')).toBe('hola')
    expect(asString(123)).toBe('')
    expect(asString(null, 'sin datos')).toBe('sin datos')
  })
})

describe('asNumber', () => {
  it('acepta números finitos y strings con coma decimal', () => {
    expect(asNumber(12.5)).toBe(12.5)
    expect(asNumber('12,5')).toBe(12.5)
    expect(asNumber(' 7 ')).toBe(7)
  })

  it('rechaza NaN, infinitos, vacíos y objetos', () => {
    expect(asNumber(Number.NaN)).toBeUndefined()
    expect(asNumber(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(asNumber('')).toBeUndefined()
    expect(asNumber('no es un número')).toBeUndefined()
    expect(asNumber({})).toBeUndefined()
    expect(asNumber(null)).toBeUndefined()
  })

  it('asNumberOr aplica el valor por defecto', () => {
    expect(asNumberOr('abc', 0)).toBe(0)
    expect(asNumberOr('3,2', 0)).toBe(3.2)
  })
})

describe('asBoolean', () => {
  it('acepta booleanos y strings true/false', () => {
    expect(asBoolean(true)).toBe(true)
    expect(asBoolean('false', true)).toBe(false)
    expect(asBoolean('TRUE')).toBe(true)
  })

  it('usa el fallback para el resto', () => {
    expect(asBoolean(1, false)).toBe(false)
    expect(asBoolean(undefined, true)).toBe(true)
  })
})

describe('arrays', () => {
  it('filtra elementos no string y normaliza números', () => {
    expect(asStringArray(['a', 2, null, 'b'])).toEqual(['a', 'b'])
    expect(asStringArray('no')).toEqual([])
    expect(asNumberArray(['1', 2, 'x', null])).toEqual([1, 2, 0, 0])
  })
})

describe('asIsoDate', () => {
  it('acepta strings, Date y objetos con toDate', () => {
    expect(asIsoDate('2026-01-02')).toBe('2026-01-02')
    expect(asIsoDate(new Date('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02T00:00:00.000Z')
    expect(asIsoDate({ toDate: () => new Date('2026-01-02T00:00:00.000Z') })).toBe('2026-01-02T00:00:00.000Z')
  })

  it('devuelve undefined para valores inválidos', () => {
    expect(asIsoDate('')).toBeUndefined()
    expect(asIsoDate(new Date('invalid'))).toBeUndefined()
    expect(asIsoDate(42)).toBeUndefined()
  })
})
