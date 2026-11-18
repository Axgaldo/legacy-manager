/**
 * CSV para Excel en español: separador `;`, decimales con coma y BOM para que
 * Excel detecte UTF-8. Vive en `utils` (sin Firebase) para poder probarlo con
 * Vitest y reutilizarlo desde cualquier exportación.
 */

export function escapeCsvCell(value: string | number): string {
  const text = String(value ?? '')
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function csvNumber(value: number): string {
  return String(Number.isFinite(value) ? value : 0).replace('.', ',')
}

export function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  return '\uFEFF' + [header, ...rows]
    .map((row) => row.map((cell) => (typeof cell === 'number' ? csvNumber(cell) : escapeCsvCell(cell))).join(';'))
    .join('\n')
}
