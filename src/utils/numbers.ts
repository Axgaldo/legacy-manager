/**
 * Formato numérico de la app.
 *
 * El Intl de es-ES no agrupa las cifras de 4 dígitos (1000 → «1000» pero
 * 10000 → «10.000», por el minimumGroupingDigits del CLDR español). Para que
 * el dinero se lea igual en todos los rangos, la app formatea sin agrupar y
 * añade el separador de miles aquí, siempre: «1.000», «10.000», «1.000,50».
 */

export function groupThousands(formatted: string): string {
  const [integerPart, ...rest] = formatted.split(',')
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return rest.length ? `${grouped},${rest.join(',')}` : grouped
}

/** Número es-ES con decimales y separador de miles en todas las magnitudes. */
export function formatGroupedEsNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0'
  return groupThousands(value.toLocaleString('es-ES', { maximumFractionDigits, useGrouping: false }))
}
