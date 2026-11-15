import { Property, RentRate } from '@/types'

export function rentAmountForMonth(property: Property, year: number, month: number): number {
  const period = `${year}-${String(month).padStart(2, '0')}`
  const rates = [...(property.rentHistory ?? [])]
    .filter((rate) => /^\d{4}-\d{2}$/.test(rate.effectiveFrom) && Number.isFinite(rate.amount))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const matchingRates = rates.filter((rate) => rate.effectiveFrom <= period)
  const applicable = matchingRates[matchingRates.length - 1]
  if (applicable) return applicable.amount
  // A rate history can predate the current month but lack an explicit baseline.
  // Use its first known rate for older months instead of a mutable monthlyRent
  // fallback, which may now contain a later increase.
  if (property.monthlyRent === undefined) return 0
  return rates[0]?.amount ?? property.monthlyRent
}

export function normalizeRentHistory(rates: RentRate[]): RentRate[] {
  const byMonth = new Map<string, RentRate>()
  rates.forEach((rate) => {
    if (rate.effectiveFrom && Number.isFinite(rate.amount)) byMonth.set(rate.effectiveFrom, rate)
  })
  return Array.from(byMonth.values()).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}
