import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Expense, ExpenseCategory, Property, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { subscribeToYearExpenses } from './expensesService'
import { subscribeToAllRecurringExpenseOccurrences, subscribeToAllRecurringExpenseSchedules } from './recurringExpensesService'
import { EXPENSE_CATEGORIES } from './expenseCategories'
import { propertySlug } from '@/utils/slugs'
import { useMoney } from '@/features/privacy/money'
import { isScheduleDueInMonth, occurrenceIdFor } from './recurringExpensesLogic'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const monthName = (year: number, month: number) => new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(year, month - 1, 1))

export type ExpensesKind = 'all' | 'recurring' | 'oneoff'

export default function PropertyExpensesOverview({ properties }: { properties: Property[] }) {
  const navigate = useNavigate()
  const money = useMoney()
  const euro = (amount: number) => money.formatEuro(amount, 2)
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [schedules, setSchedules] = useState<RecurringExpenseSchedule[]>([])
  const [occurrences, setOccurrences] = useState<RecurringExpenseOccurrence[]>([])
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all')
  const [kind, setKind] = useState<ExpensesKind>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    return subscribeToYearExpenses(year, (items) => { setExpenses(items); setLoading(false); setError(null) }, (loadError) => { setError(loadError.message); setLoading(false) })
  }, [year])
  useEffect(() => subscribeToAllRecurringExpenseSchedules(setSchedules, (loadError) => setError(loadError.message)), [])
  useEffect(() => subscribeToAllRecurringExpenseOccurrences(year, setOccurrences, (loadError) => setError(loadError.message)), [year])

  const propertyNames = useMemo(() => new Map(properties.map((property) => [property.id, property.name])), [properties])
  const occurrenceById = useMemo(() => new Map(occurrences.map((item) => [item.id, item])), [occurrences])
  const visible = useMemo(() => expenses.filter((expense) => category === 'all' || expense.category === category), [expenses, category])
  const totals = useMemo(() => visible.reduce((summary, expense) => ({
    amount: summary.amount + expense.amount,
    unpaid: summary.unpaid + (expense.isPaid ? 0 : expense.amount),
    missingInvoices: summary.missingInvoices + (expense.invoiceNumber && !expense.invoiceReceived ? 1 : 0),
  }), { amount: 0, unpaid: 0, missingInvoices: 0 }), [visible])
  const groups = useMemo(() => {
    const map = new Map<number, Expense[]>()
    visible.forEach((expense) => map.set(expense.month, [...(map.get(expense.month) ?? []), expense]))
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [visible])

  const dueInMonth = (schedule: RecurringExpenseSchedule, month: number) => isScheduleDueInMonth(schedule, year, month)

  const monthState = (propertyId: string, month: number) => {
    const scheduled = kind === 'oneoff' ? [] : schedules.filter((schedule) => schedule.propertyId === propertyId && (category === 'all' || schedule.category === category) && dueInMonth(schedule, month))
    const punctual = kind === 'recurring' ? [] : expenses.filter((expense) => expense.propertyId === propertyId && expense.month === month && (category === 'all' || expense.category === category))
    const tasks = [
      ...scheduled.map((schedule) => {
        const occurrence = occurrenceById.get(occurrenceIdFor(schedule.id, year, month))
        return occurrence?.isPaid === true && (!schedule.requiresInvoice || occurrence.invoiceReceived === true) && (!schedule.chargeToTenant || (occurrence.tenantInvoiceIssued === true && occurrence.tenantPaid === true))
      }),
      ...punctual.map((expense) => expense.isPaid === true && (!expense.invoiceNumber || expense.invoiceReceived === true)),
    ]
    if (!tasks.length) return { state: 'none' as const, title: 'Sin gastos previstos' }
    const incomplete = tasks.filter((complete) => !complete).length
    if (!incomplete) return { state: 'complete' as const, title: 'Todos los gastos y gestiones están completados' }
    const isFuture = year > currentYear || (year === currentYear && month > currentMonth)
    return { state: isFuture ? 'upcoming' as const : 'pending' as const, title: `${incomplete} gasto(s) o gestión(es) pendiente(s)` }
  }

  /** Filas de gastos periódicos para la vista «solo periódicos». */
  const recurringRows = useMemo(() => {
    return schedules
      .filter((schedule) => category === 'all' || schedule.category === category)
      .map((schedule) => {
        const months = Array.from({ length: 12 }, (_, index) => index + 1)
          .filter((month) => isScheduleDueInMonth(schedule, year, month))
          .map((month) => {
            const occurrence = occurrenceById.get(occurrenceIdFor(schedule.id, year, month))
            const amount = occurrence?.amount ?? schedule.amount
            const isPaid = occurrence?.isPaid === true
            const isFuture = year > currentYear || (year === currentYear && month > currentMonth)
            return { month, amount, isPaid, state: isPaid ? ('paid' as const) : isFuture ? ('upcoming' as const) : ('pending' as const) }
          })
        return {
          schedule,
          months,
          due: months.reduce((total, detail) => total + detail.amount, 0),
          paid: months.filter((detail) => detail.isPaid).reduce((total, detail) => total + detail.amount, 0),
        }
      })
      .filter((row) => row.months.length > 0)
  }, [schedules, occurrenceById, category, year, currentYear, currentMonth])

  const recurringTotals = useMemo(() => ({
    due: recurringRows.reduce((total, row) => total + row.due, 0),
    paid: recurringRows.reduce((total, row) => total + row.paid, 0),
  }), [recurringRows])

  const propertyEditLink = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId)
    return property ? `/inmuebles/${propertySlug(property, properties)}?tab=${'gastos'}` : null
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-400">Vista transversal</p><h2 className="mt-1 text-2xl font-semibold text-slate-100">Gastos de los inmuebles</h2><p className="mt-1 text-sm text-slate-400">Estado mensual de gastos puntuales y periódicos, por inmueble.</p></div><div className="flex flex-wrap gap-2"><label className="text-xs text-slate-400">Mostrar<select value={kind} onChange={(event) => setKind(event.target.value as ExpensesKind)} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"><option value="all">Todos los gastos</option><option value="recurring">Solo periódicos</option><option value="oneoff">Solo puntuales</option></select></label><label className="text-xs text-slate-400">Categoría<select value={category} onChange={(event) => setCategory(event.target.value as 'all' | ExpenseCategory)} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"><option value="all">Todas</option>{EXPENSE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-xs text-slate-400">Año <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((value) => <option key={value}>{value}</option>)}</select></label></div></header>
    {error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">No se pudieron cargar todos los gastos: {error}</p>}

    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h3 className="font-semibold text-slate-100">Calendario de gastos por inmueble</h3><p className="mt-1 text-xs text-slate-400">Verde: todos los pagos y gestiones previstos están completos · rojo: hay pendientes · ámbar: vencimiento futuro.</p></div>
      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-[1000px] w-full text-xs"><thead><tr className="border-b border-slate-700 bg-slate-950 text-slate-400"><th className="sticky left-0 z-10 min-w-48 bg-slate-950 px-3 py-3 text-left">Inmueble</th>{MONTHS.map((month) => <th key={month} className="min-w-16 px-2 py-3 text-center">{month}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{properties.map((property) => <tr key={property.id} className="hover:bg-slate-800/40"><th className="sticky left-0 bg-slate-900 px-3 py-3 text-left font-medium text-slate-200">{property.name}</th>{MONTHS.map((_, index) => { const status = monthState(property.id, index + 1); const style = status.state === 'complete' ? 'bg-emerald-950/70 text-emerald-200' : status.state === 'pending' ? 'bg-red-950/50 text-red-200' : status.state === 'upcoming' ? 'bg-amber-950/30 text-amber-200' : 'text-slate-700'; const symbol = status.state === 'complete' ? '✓' : status.state === 'pending' ? '!' : status.state === 'upcoming' ? '◷' : '—'; return <td key={index} title={status.title} className="px-1.5 py-2 text-center"><span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 font-bold ${style}`}>{symbol}</span></td> })}</tr>)}</tbody></table>{properties.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No hay inmuebles registrados.</p>}</div>
    </section>

    {kind === 'recurring' && (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-lg font-semibold text-slate-100">Gastos periódicos · {year}</h3><p className="mt-1 text-xs text-slate-400">Cada obligación con sus vencimientos del año y su estado de pago.</p></div>
          <p className="text-xs text-slate-400">Previsto: <span className="font-semibold text-slate-100">{euro(recurringTotals.due)}</span> · Pagado: <span className="font-semibold text-emerald-300">{euro(recurringTotals.paid)}</span></p>
        </div>
        {recurringRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">No hay gastos periódicos que coincidan con estos filtros.</div>
        ) : (
          <div className="space-y-3">{recurringRows.map(({ schedule, months, due, paid }) => {
            const property = properties.find((item) => item.id === schedule.propertyId)
            const categoryLabel = EXPENSE_CATEGORIES.find((item) => item.value === schedule.category)?.label ?? schedule.category
            const managePath = property ? `/inmuebles/${propertySlug(property, properties)}?tab=recurrentes` : null
            return <article key={schedule.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200">{categoryLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{property?.name ?? 'Inmueble eliminado'} · {schedule.intervalMonths === 1 ? 'Mensual' : `Cada ${schedule.intervalMonths} meses`} · {euro(schedule.amount)} por vencimiento</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400">{euro(due)} previsto</span>
                  <span className="font-semibold text-emerald-300">{euro(paid)} pagado</span>
                  {managePath && <button type="button" onClick={() => navigate(managePath)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-teal-700 hover:text-teal-200">Gestionar</button>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {months.map((detail) => (
                  <span key={detail.month} title={`${MONTHS[detail.month - 1]} · ${euro(detail.amount)} · ${detail.isPaid ? 'pagado' : detail.state === 'upcoming' ? 'vencimiento futuro' : 'pendiente de pagar'}`} className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${detail.state === 'paid' ? 'border-emerald-800 bg-emerald-950/60 text-emerald-200' : detail.state === 'upcoming' ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-red-900 bg-red-950/50 text-red-200'}`}>
                    {MONTHS[detail.month - 1]} {detail.state === 'paid' ? '✓' : detail.state === 'upcoming' ? '◷' : '!'}
                  </span>
                ))}
              </div>
            </article>
          })}</div>
        )}
      </section>
    )}

    {kind !== 'recurring' && (
    <section className="space-y-4">
      <div><h3 className="text-lg font-semibold text-slate-100">Gastos puntuales registrados</h3><p className="mt-1 text-xs text-slate-400">Esta lista es de consulta. Para abrir la gestión de un gasto, entra en el control del inmueble.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Importe puntual registrado</p><p className="mt-1 text-xl font-semibold text-slate-100">{euro(totals.amount)}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Pendiente de pago</p><p className="mt-1 text-xl font-semibold text-amber-300">{euro(totals.unpaid)}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Facturas puntuales sin recibir</p><p className="mt-1 text-xl font-semibold text-slate-100">{totals.missingInvoices}</p></div></div>
      {loading ? <p className="py-12 text-center text-sm text-slate-400">Cargando gastos…</p> : groups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">No hay gastos puntuales que coincidan con estos filtros.</div> : <div className="space-y-4">{groups.map(([month, items]) => <section key={month} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h3 className="font-semibold capitalize text-slate-200">{monthName(year, month)} {year}</h3><span className="text-xs text-slate-400">{euro(items.reduce((sum, expense) => sum + expense.amount, 0))}</span></header><div className="divide-y divide-slate-800">{items.map((expense) => { const editPath = propertyEditLink(expense.propertyId); return <article key={expense.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-200">{EXPENSE_CATEGORIES.find((item) => item.value === expense.category)?.label ?? expense.category}</span><span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">Puntual</span><span className="text-[11px] text-slate-500">{expense.date}</span></div><p className="mt-1 truncate text-sm text-slate-100">{expense.description}</p><p className="mt-1 text-xs text-slate-400">{propertyNames.get(expense.propertyId) ?? 'Inmueble eliminado'}{expense.invoiceNumber ? ` · Factura ${expense.invoiceNumber}` : ''}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${!expense.invoiceNumber ? 'border-slate-800 text-slate-500' : expense.invoiceReceived ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-slate-700 text-slate-400'}`}>{!expense.invoiceNumber ? 'Sin factura' : expense.invoiceReceived ? '✓ Factura recibida' : 'Factura pendiente'}</span><span className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${expense.isPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{expense.isPaid ? '✓ Pagado' : 'Pago pendiente'}</span><strong className="min-w-20 text-right text-sm text-slate-100">{euro(expense.amount)}</strong>{editPath && <button type="button" onClick={() => navigate(editPath)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-teal-700 hover:text-teal-200">Editar</button>}</div></article> })}</div></section>)}</div>}
    </section>
    )}
  </div>
}
