export interface HistoricalPeriod {
  id: string
  name: string
  minYear?: number
  maxYear?: number
}

export const HISTORICAL_PERIODS: HistoricalPeriod[] = [
  { id: 'ancient', name: 'Época Antigua / Romana (hasta s. V)', maxYear: 475 },
  { id: 'medieval', name: 'Época Medieval (s. V - XV)', minYear: 476, maxYear: 1491 },
  { id: 'century16', name: 'Siglo XVI (Monarquía Hispánica / Reyes Católicos a Felipe II)', minYear: 1492, maxYear: 1599 },
  { id: 'century17', name: 'Siglo XVII (Siglo de Oro / Austrias)', minYear: 1600, maxYear: 1699 },
  { id: 'century18', name: 'Siglo XVIII (Ilustración / Primeros Borbones)', minYear: 1700, maxYear: 1799 },
  { id: 'century19', name: 'Siglo XIX (Guerra Indep. / Isabel II / Alfonso XII)', minYear: 1800, maxYear: 1899 },
  { id: 'century20', name: 'Siglo XX (Alfonso XIII / República / Peseta)', minYear: 1900, maxYear: 1999 },
  { id: 'century21', name: 'Siglo XXI (Época Euro / Actual)', minYear: 2000, maxYear: 2100 },
]

export function getHistoricalEraFromYear(year?: number): string | undefined {
  if (year === undefined || isNaN(year)) return undefined

  for (const period of HISTORICAL_PERIODS) {
    const minOk = period.minYear === undefined || year >= period.minYear
    const maxOk = period.maxYear === undefined || year <= period.maxYear
    if (minOk && maxOk) {
      return period.name
    }
  }

  return undefined
}
