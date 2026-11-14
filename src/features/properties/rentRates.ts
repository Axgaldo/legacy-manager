import { Property, RentRate } from '@/types'

export function rentAmountForMonth(property: Property, year: number, month: number): number {
  const period = `${year}-${String(month).padStart(2, '0')}`
  const rates = [...(property.rentHistory ?? [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const matchingRates = rates.filter((rate) => rate.effectiveFrom <= period)
  const applicable = matchingRates[matchingRates.length - 1]
  return applicable?.amount ?? property.monthlyRent ?? 0
}

export function normalizeRentHistory(rates: RentRate[]): RentRate[] {
  const byMonth = new Map<string, RentRate>()
  rates.forEach((rate) => {
    if (rate.effectiveFrom && Number.isFinite(rate.amount)) byMonth.set(rate.effectiveFrom, rate)
  })
  return Array.from(byMonth.values()).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}
