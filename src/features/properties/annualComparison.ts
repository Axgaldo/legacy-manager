import type { Expense, RentPayment } from '@/types'

/** Comparativa anual de un inmueble: ingresos cobrados, gastos y neto. */

export interface AnnualComparisonRow {
  year: number
  income: number
  expenses: number
  net: number
}

export interface AnnualComparison {
  rows: AnnualComparisonRow[]
  totals: AnnualComparisonRow
}

/** Ingreso real de un mes: lo cobrado; si está marcado como pagado, el importe previsto. */
export function paymentIncome(payment: RentPayment): number {
  if (payment.receivedAmount !== undefined) return payment.receivedAmount
  return payment.isPaid ? payment.amount : 0
}

function expenseYear(expense: Expense): number | null {
  if (Number.isFinite(expense.year) && expense.year > 1900) return expense.year
  const parsed = Date.parse(`${expense.date}T00:00:00`)
  return Number.isNaN(parsed) ? null : new Date(parsed).getFullYear()
}

export function buildAnnualComparison(args: {
  propertyId: string
  payments: RentPayment[]
  expenses: Expense[]
  now?: Date
  years?: number
}): AnnualComparison {
  const now = args.now ?? new Date()
  const years = Math.max(1, args.years ?? 5)
  const firstYear = now.getFullYear() - years + 1

  const rows: AnnualComparisonRow[] = []
  for (let year = firstYear; year <= now.getFullYear(); year++) {
    const income = args.payments
      .filter((payment) => payment.propertyId === args.propertyId && payment.year === year)
      .reduce((total, payment) => total + paymentIncome(payment), 0)
    const expenses = args.expenses
      .filter((expense) => expense.propertyId === args.propertyId && expenseYear(expense) === year)
      .reduce((total, expense) => total + (Number.isFinite(expense.amount) ? expense.amount : 0), 0)
    rows.push({ year, income, expenses, net: income - expenses })
  }

  const totals = rows.reduce<AnnualComparisonRow>(
    (total, row) => ({
      year: 0,
      income: total.income + row.income,
      expenses: total.expenses + row.expenses,
      net: total.net + row.net,
    }),
    { year: 0, income: 0, expenses: 0, net: 0 },
  )

  return { rows, totals }
}
