import { describe, expect, it } from 'vitest'
import { csvNumber, escapeCsvCell, toCsv } from './csv'

describe('escapeCsvCell', () => {
  it('deja intactos los textos simples', () => {
    expect(escapeCsvCell('Comunidad')).toBe('Comunidad')
    expect(escapeCsvCell(0)).toBe('0')
  })

  it('entrecomilla los textos con separador, comillas o saltos de línea', () => {
    expect(escapeCsvCell('Piso; garaje')).toBe('"Piso; garaje"')
    expect(escapeCsvCell('dice "hola"')).toBe('"dice ""hola"""')
    expect(escapeCsvCell('linea1\nlinea2')).toBe('"linea1\nlinea2"')
    expect(escapeCsvCell('1.234,56')).toBe('"1.234,56"')
  })
})

describe('csvNumber', () => {
  it('usa coma decimal y no agrupa miles (Excel lo interpreta como número)', () => {
    expect(csvNumber(12.5)).toBe('12,5')
    expect(csvNumber(1000)).toBe('1000')
  })

  it('convierte valores no finitos en 0', () => {
    expect(csvNumber(Number.NaN)).toBe('0')
  })
})

describe('toCsv', () => {
  it('añade BOM, cabecera y filas separadas por ;', () => {
    expect(toCsv(['Concepto', 'Importe'], [['IBI; 2026', 600]])).toBe('\uFEFFConcepto;Importe\n"IBI; 2026";600')
  })

  it('no añade una fila vacía al final', () => {
    const csv = toCsv(['a'], [['b']])
    expect(csv.endsWith('\n')).toBe(false)
    expect(csv.split('\n')).toHaveLength(2)
  })
})
