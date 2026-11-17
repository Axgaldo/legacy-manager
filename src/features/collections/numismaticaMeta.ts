/**
 * Helpers shared by the numismática form and the coin list.
 *
 * Years are stored as signed numbers: negative values mean "a.C." and
 * positive values mean "d.C.". This keeps sorting and filtering simple while
 * still allowing the UI to show "a.C." / "d.C." labels.
 */

export const CONSERVATION_STATES = [
  'Excelente',
  'Muy buena',
  'Buen estado',
  'Regular',
  'Desgastado',
  'Muy desgastado',
  'Dañado',
] as const

export const ERA_OPTIONS = ['Romana', 'Visigoda', 'Medieval', 'Moderna', 'Contemporánea', 'Antigua'] as const

export const ACQUISITION_OPERATIONS = ['Compra', 'Herencia', 'Regalo', 'Donación', 'Subasta', 'Intercambio', 'Hallazgo'] as const

export const MEDAL_MATERIALS = ['Bronce', 'Plata', 'Oro', 'Latón', 'Cobre', 'Zinc', 'Estaño', 'Aleación', 'Porcelana', 'Vidrio'] as const

/**
 * Currencies found in the family archive. `eurPerUnit` is the value of one
 * unit in euros. Pesetas and French francs use their legal fixed rates; the
 * rest are approximate defaults that the user can override by editing the
 * euro amount in the form.
 */
export interface CurrencyInfo {
  code: string
  label: string
  symbol: string
  eurPerUnit: number
  fixed?: boolean
  note?: string
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', label: 'Euro', symbol: '€', eurPerUnit: 1, fixed: true },
  { code: 'ESP', label: 'Peseta española', symbol: 'ptas', eurPerUnit: 1 / 166.386, fixed: true, note: '166,386 ptas = 1 €' },
  { code: 'FRF', label: 'Franco francés', symbol: 'FRF', eurPerUnit: 1 / 6.55957, fixed: true, note: '6,55957 FRF = 1 €' },
  { code: 'CHF', label: 'Franco suizo', symbol: 'CHF', eurPerUnit: 1.05, note: 'Tipo orientativo; puedes ajustar el importe en euros' },
  { code: 'USD', label: 'Dólar estadounidense', symbol: '$', eurPerUnit: 0.92, note: 'Tipo orientativo; puedes ajustar el importe en euros' },
  { code: 'GBP', label: 'Libra esterlina', symbol: '£', eurPerUnit: 1.17, note: 'Tipo orientativo; puedes ajustar el importe en euros' },
]

const euroAmountFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export function getCurrency(code?: string): CurrencyInfo {
  const normalized = (code ?? 'EUR').trim().toUpperCase()
  return CURRENCIES.find((currency) => currency.code === normalized) ?? CURRENCIES[0]
}

/**
 * Reads amounts written by hand. Spanish notation uses "." for thousands and
 * "," for decimals ("3.500,50"), so a dot followed by exactly three digits is
 * treated as a thousands separator.
 */
export function parseAmountText(value?: string): number | undefined {
  const raw = value?.trim().replace(/\s/g, '')
  if (!raw) return undefined
  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  let normalized = raw
  if (hasComma) {
    normalized = hasDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.')
  } else if (hasDot) {
    const parts = raw.split('.')
    const last = parts[parts.length - 1]
    if (parts.length === 2 && /^\d{1,3}$/.test(parts[0]) && last.length === 3) {
      normalized = parts.join('')
    }
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Converts an amount to euros using the configured rate. */
export function convertToEuro(amount: number, code?: string): number {
  return amount * getCurrency(code).eurPerUnit
}

export function roundEuro(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatEuroAmount(value: number): string {
  return euroAmountFormatter.format(value)
}

export function formatCurrencyAmount(amount: number, code?: string): string {
  const currency = getCurrency(code)
  if (currency.code === 'EUR') return formatEuroAmount(amount)
  const formatted = amount.toLocaleString('es-ES', { maximumFractionDigits: 2 })
  return currency.code === 'ESP' ? `${formatted} ptas` : `${formatted} ${currency.symbol}`
}

export function formatCurrencyRate(code?: string): string {
  const currency = getCurrency(code)
  const rate = currency.eurPerUnit.toLocaleString('es-ES', { maximumFractionDigits: 4 })
  return `1 ${currency.symbol} = ${rate} €`
}

export interface RulerPeriod {
  ruler: string
  empire: string
  start: number
  end: number
}

/**
 * Curated periods used to suggest the ruler and the reign/empire from the
 * year. The user can always overwrite the suggestion.
 */
export const RULER_PERIODS: RulerPeriod[] = [
  { ruler: 'República Romana', empire: 'República Romana', start: -509, end: -28 },
  { ruler: 'Augusto', empire: 'Imperio Romano', start: -27, end: 14 },
  { ruler: 'Tiberio', empire: 'Imperio Romano', start: 14, end: 37 },
  { ruler: 'Calígula', empire: 'Imperio Romano', start: 37, end: 41 },
  { ruler: 'Claudio', empire: 'Imperio Romano', start: 41, end: 54 },
  { ruler: 'Nerón', empire: 'Imperio Romano', start: 54, end: 68 },
  { ruler: 'Galba', empire: 'Imperio Romano', start: 68, end: 69 },
  { ruler: 'Vespasiano', empire: 'Imperio Romano', start: 69, end: 79 },
  { ruler: 'Tito', empire: 'Imperio Romano', start: 79, end: 81 },
  { ruler: 'Domiciano', empire: 'Imperio Romano', start: 81, end: 96 },
  { ruler: 'Nerva', empire: 'Imperio Romano', start: 96, end: 98 },
  { ruler: 'Trajano', empire: 'Imperio Romano', start: 98, end: 117 },
  { ruler: 'Adriano', empire: 'Imperio Romano', start: 117, end: 138 },
  { ruler: 'Antonino Pío', empire: 'Imperio Romano', start: 138, end: 161 },
  { ruler: 'Marco Aurelio', empire: 'Imperio Romano', start: 161, end: 180 },
  { ruler: 'Cómodo', empire: 'Imperio Romano', start: 180, end: 192 },
  { ruler: 'Septimio Severo', empire: 'Imperio Romano', start: 193, end: 211 },
  { ruler: 'Caracalla', empire: 'Imperio Romano', start: 211, end: 217 },
  { ruler: 'Heliogábalo', empire: 'Imperio Romano', start: 218, end: 222 },
  { ruler: 'Alejandro Severo', empire: 'Imperio Romano', start: 222, end: 235 },
  { ruler: 'Maximino el Tracio', empire: 'Imperio Romano', start: 235, end: 238 },
  { ruler: 'Gordiano III', empire: 'Imperio Romano', start: 238, end: 244 },
  { ruler: 'Filipo el Árabe', empire: 'Imperio Romano', start: 244, end: 249 },
  { ruler: 'Decio', empire: 'Imperio Romano', start: 249, end: 251 },
  { ruler: 'Valeriano', empire: 'Imperio Romano', start: 253, end: 260 },
  { ruler: 'Galieno', empire: 'Imperio Romano', start: 253, end: 268 },
  { ruler: 'Claudio II', empire: 'Imperio Romano', start: 268, end: 270 },
  { ruler: 'Aureliano', empire: 'Imperio Romano', start: 270, end: 275 },
  { ruler: 'Probo', empire: 'Imperio Romano', start: 276, end: 282 },
  { ruler: 'Diocleciano', empire: 'Imperio Romano', start: 284, end: 305 },
  { ruler: 'Constantino I', empire: 'Imperio Romano', start: 306, end: 337 },
  { ruler: 'Constancio II', empire: 'Imperio Romano', start: 337, end: 361 },
  { ruler: 'Juliano', empire: 'Imperio Romano', start: 361, end: 363 },
  { ruler: 'Valente', empire: 'Imperio Romano', start: 364, end: 378 },
  { ruler: 'Teodosio I', empire: 'Imperio Romano', start: 379, end: 395 },
  { ruler: 'Honorio', empire: 'Imperio Romano', start: 395, end: 423 },
  { ruler: 'Valentiniano III', empire: 'Imperio Romano', start: 425, end: 455 },
  { ruler: 'Rómulo Augústulo', empire: 'Imperio Romano', start: 475, end: 476 },

  { ruler: 'Reino Visigodo', empire: 'Reino Visigodo', start: 476, end: 711 },
  { ruler: 'Al-Ándalus', empire: 'Al-Ándalus', start: 711, end: 1491 },

  { ruler: 'Reyes Católicos', empire: 'Monarquía Hispánica', start: 1474, end: 1516 },
  { ruler: 'Carlos I', empire: 'Monarquía Hispánica', start: 1516, end: 1556 },
  { ruler: 'Felipe II', empire: 'Monarquía Hispánica', start: 1556, end: 1598 },
  { ruler: 'Felipe III', empire: 'Monarquía Hispánica', start: 1598, end: 1621 },
  { ruler: 'Felipe IV', empire: 'Monarquía Hispánica', start: 1621, end: 1665 },
  { ruler: 'Carlos II', empire: 'Monarquía Hispánica', start: 1665, end: 1700 },
  { ruler: 'Felipe V', empire: 'Monarquía Española', start: 1700, end: 1746 },
  { ruler: 'Fernando VI', empire: 'Monarquía Española', start: 1746, end: 1759 },
  { ruler: 'Carlos III', empire: 'Monarquía Española', start: 1759, end: 1788 },
  { ruler: 'Carlos IV', empire: 'Monarquía Española', start: 1788, end: 1808 },
  { ruler: 'José I', empire: 'España', start: 1808, end: 1813 },
  { ruler: 'Fernando VII', empire: 'Monarquía Española', start: 1813, end: 1833 },
  { ruler: 'Isabel II', empire: 'Monarquía Española', start: 1833, end: 1868 },
  { ruler: 'Gobierno Provisional', empire: 'España', start: 1868, end: 1870 },
  { ruler: 'Amadeo I', empire: 'Monarquía Española', start: 1870, end: 1873 },
  { ruler: 'Primera República', empire: 'Primera República', start: 1873, end: 1874 },
  { ruler: 'Alfonso XII', empire: 'Monarquía Española', start: 1874, end: 1885 },
  { ruler: 'Alfonso XIII', empire: 'Monarquía Española', start: 1886, end: 1931 },
  { ruler: 'Segunda República', empire: 'Segunda República', start: 1931, end: 1939 },
  { ruler: 'Francisco Franco', empire: 'España', start: 1939, end: 1975 },
  { ruler: 'Juan Carlos I', empire: 'Monarquía Española', start: 1975, end: 2014 },
  { ruler: 'Felipe VI', empire: 'Monarquía Española', start: 2014, end: 2100 },
]

export const RULER_NAMES = Array.from(new Set(RULER_PERIODS.map((period) => period.ruler)))
export const EMPIRE_NAMES = Array.from(new Set(RULER_PERIODS.map((period) => period.empire)))

/** Era label inferred from a signed year. Editable by the user afterwards. */
export function getEraFromYear(year?: number): string | undefined {
  if (year === undefined || Number.isNaN(year)) return undefined
  if (year < -509) return 'Antigua'
  if (year <= 475) return 'Romana'
  if (year <= 711) return 'Visigoda'
  if (year <= 1491) return 'Medieval'
  if (year <= 1788) return 'Moderna'
  return 'Contemporánea'
}

/** Ruler and reign inferred from a signed year. */
export function getRulerSuggestion(year?: number): { ruler: string; empire: string } | undefined {
  if (year === undefined || Number.isNaN(year)) return undefined
  const period = RULER_PERIODS.find((item) => year >= item.start && year <= item.end)
  return period ? { ruler: period.ruler, empire: period.empire } : undefined
}

/** "1.234 a.C." or "1780" / "123 d.C." for early years. */
export function formatSignedYear(year: number): string {
  if (year < 0) return `${Math.abs(year).toLocaleString('es-ES')} a.C.`
  if (year > 0 && year <= 1000) return `${year} d.C.`
  return String(year)
}

export function formatYearRange(start?: number, end?: number): string {
  if (start === undefined && end === undefined) return ''
  if (start === undefined) return formatSignedYear(end as number)
  if (end === undefined) return formatSignedYear(start)
  if (start === end) return formatSignedYear(start)
  return `${formatSignedYear(start)} – ${formatSignedYear(end)}`
}

/** Parses a year written in a form field. Empty or invalid values are ignored. */
export function parseSignedYear(value: string | undefined, era: string | undefined): number | undefined {
  const digits = (value ?? '').replace(/[^\d]/g, '')
  if (!digits) return undefined
  const parsed = Number(digits)
  if (!Number.isFinite(parsed)) return undefined
  return era === 'bc' ? -parsed : parsed
}

export interface NumismaticaYearValues {
  year_mode?: string
  year_value?: string
  year_era?: string
  range_start?: string
  range_end?: string
  range_start_era?: string
  range_end_era?: string
  range_legacy_text?: string
}

function yearFromValues(values: NumismaticaYearValues): { start?: number; end?: number } {
  if (values.year_mode === 'range') {
    const start = parseSignedYear(values.range_start, values.range_start_era)
    const end = parseSignedYear(values.range_end, values.range_end_era)
    if (start !== undefined && end !== undefined && start > end) return { start: end, end: start }
    if (start !== undefined || end !== undefined) return { start, end }
    const legacy = parseYearRangeText(values.range_legacy_text ?? '')
    return { start: legacy.start, end: legacy.end }
  }
  const year = parseSignedYear(values.year_value, values.year_era)
  return { start: year, end: year }
}

export function getPrimaryYearFromValues(values: NumismaticaYearValues): number | undefined {
  const { start, end } = yearFromValues(values)
  return start ?? end
}

/** Midpoint used for era/ruler suggestions when the date is a range. */
export function getMidpointYearFromValues(values: NumismaticaYearValues): number | undefined {
  const { start, end } = yearFromValues(values)
  if (start !== undefined && end !== undefined) return Math.round((start + end) / 2)
  return start ?? end
}

export function getYearLabelFromValues(values: NumismaticaYearValues): string {
  if (values.year_mode === 'range') {
    const { start, end } = yearFromValues(values)
    if (start !== undefined || end !== undefined) return formatYearRange(start, end)
    return values.range_legacy_text?.trim() ?? ''
  }
  const year = parseSignedYear(values.year_value, values.year_era)
  return year === undefined ? '' : formatSignedYear(year)
}

/** Best-to-worst order for the conservation dropdown. */
export function orderConservationStates(values: string[] = []): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  const push = (value: string) => {
    const text = value.trim()
    if (!text) return
    const key = text.toLocaleLowerCase('es')
    if (seen.has(key)) return
    seen.add(key)
    ordered.push(text)
  }
  CONSERVATION_STATES.forEach(push)
  values.forEach(push)
  return ordered
}

/**
 * Builds the stored name automatically so the coin form does not need a
 * separate "title" field. Example: "Denario de Adriano". The year is shown in
 * its own column, so it is only added when there is no ruler to identify it.
 */
export function buildCoinName({
  denomination,
  ruler,
  material,
  yearLabel,
}: {
  denomination?: string
  ruler?: string
  material?: string
  yearLabel?: string
}): string {
  const rawBase = denomination?.trim() || 'Moneda'
  const base = rawBase.charAt(0).toLocaleUpperCase('es') + rawBase.slice(1)
  let name = base
  if (ruler?.trim()) name += ` de ${ruler.trim()}`
  else if (material?.trim()) name += ` de ${material.trim().toLocaleLowerCase('es')}`
  if (!ruler?.trim() && yearLabel?.trim()) name += ` (${yearLabel.trim()})`
  return name
}

/**
 * Builds the medal name from its motive. If the motive already starts with
 * "Medalla" it is respected, otherwise "Medalla de …" is prepended.
 */
export function buildMedalName(motive?: string): string {
  const base = motive?.trim()
  if (!base) return 'Medalla'
  const capitalized = base.charAt(0).toLocaleUpperCase('es') + base.slice(1)
  return /^medalla\b/i.test(capitalized) ? capitalized : `Medalla de ${capitalized}`
}

function romanToNumber(value: string): number | undefined {
  const roman = value.trim().toUpperCase()
  if (!/^[IVXLCDM]+$/.test(roman)) return undefined
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  for (let index = 0; index < roman.length; index++) {
    const current = map[roman[index]]
    const next = map[roman[index + 1]]
    total += next && current < next ? -current : current
  }
  return total
}

function centuryFromText(value: string): number | undefined {
  const parsed = romanToNumber(value) ?? Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function isBcToken(token: string | undefined): boolean {
  return Boolean(token && /^a/i.test(token.replace(/\./g, '').trim()))
}

/**
 * Tries to read ranges stored by older versions: "100-250 d.C.",
 * "100 a.C. - 50 a.C.", "siglo III a.C.", "1900–1920", "s. XVIII".
 */
export function parseYearRangeText(text: string): { start?: number; end?: number } {
  const raw = text.trim()
  if (!raw) return {}
  const normalized = raw.replace(/[–—−]/g, '-').replace(/\s+/g, ' ')

  const centuryMatch = normalized.match(/(?:siglos?|s\.)\s*([ivxlcdm]+|\d{1,2})\s*(a\.?\s*c\.?|d\.?\s*c\.?)?/i)
  if (centuryMatch) {
    const century = centuryFromText(centuryMatch[1])
    if (century) {
      const bc = isBcToken(centuryMatch[2])
      const first = (century - 1) * 100 + 1
      const last = century * 100
      return bc ? { start: -last, end: -first } : { start: first, end: last }
    }
  }

  const globalBc = /a\.?\s*c\.?/i.test(normalized)
  const matches = Array.from(normalized.matchAll(/(\d{1,4})\s*(a\.?\s*c\.?|d\.?\s*c\.?)?/gi))
  if (matches.length === 0) return {}

  const entries = matches.map((match) => {
    const year = Number(match[1])
    const bc = match[2] ? isBcToken(match[2]) : globalBc
    return bc ? -year : year
  })

  if (entries.length === 1) return { start: entries[0], end: entries[0] }
  const [firstYear, secondYear] = entries
  return firstYear <= secondYear
    ? { start: firstYear, end: secondYear }
    : { start: secondYear, end: firstYear }
}
