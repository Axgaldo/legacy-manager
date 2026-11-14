import { useEffect, useMemo, useState } from 'react'
import { Expense, ExpenseCategory, Property } from '@/types'
import { subscribeToYearExpenses, updateExpenseStatus } from './expensesService'
import { EXPENSE_CATEGORIES } from './expenseCategories'

export default function PropertyExpensesOverview({ properties }: { properties: Property[] }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    return subscribeToYearExpenses(year, (items) => { setExpenses(items); setLoading(false); setError(null) }, (loadError) => { setError(loadError.message); setLoading(false) })
  }, [year])

  const propertyNames = useMemo(() => new Map(properties.map((property) => [property.id, property.name])), [properties])
  const visible = useMemo(() => expenses.filter((expense) => category === 'all' || expense.category === category), [expenses, category])
  const totals = useMemo(() => visible.reduce((summary, expense) => ({
    amount: summary.amount + expense.amount,
    unpaid: summary.unpaid + (expense.isPaid ? 0 : expense.amount),
    missingInvoices: summary.missingInvoices + (expense.invoiceReceived ? 0 : 1),
  }), { amount: 0, unpaid: 0, missingInvoices: 0 }), [visible])
  const groups = useMemo(() => {
    const map = new Map<number, Expense[]>()
    visible.forEach((expense) => map.set(expense.month, [...(map.get(expense.month) ?? []), expense]))
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [visible])
  const formatEuro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount)
  const monthName = (month: number) => new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(year, month - 1, 1))
  const today = () => new Date().toLocaleDateString('sv-SE')

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-400">Vista transversal</p><h2 className="mt-1 text-2xl font-semibold text-slate-100">Gastos puntuales de los inmuebles</h2><p className="mt-1 text-sm text-slate-400">Consulta gastos aislados de todas las propiedades por categoría.</p></div><select value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((value) => <option key={value}>{value}</option>)}</select></header>
    {error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">No se pudieron cargar los gastos: {error}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Gasto registrado</p><p className="mt-1 text-xl font-semibold text-slate-100">{formatEuro(totals.amount)}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Pendiente de pago</p><p className="mt-1 text-xl font-semibold text-amber-300">{formatEuro(totals.unpaid)}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Facturas sin marcar como recibidas</p><p className="mt-1 text-xl font-semibold text-slate-100">{totals.missingInvoices}</p></div></div>
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><select value={category} onChange={(event) => setCategory(event.target.value as 'all' | ExpenseCategory)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 sm:max-w-sm"><option value="all">Todas las categorías</option>{EXPENSE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="text-xs text-slate-500">Los gastos periódicos se consultan en el control mensual de cada inmueble.</p></div>
    {loading ? <p className="py-12 text-center text-sm text-slate-400">Cargando gastos…</p> : groups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">No hay gastos que coincidan con estos filtros.</div> : <div className="space-y-4">{groups.map(([month, items]) => <section key={month} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h3 className="font-semibold capitalize text-slate-200">{monthName(month)} {year}</h3><span className="text-xs text-slate-400">{formatEuro(items.reduce((sum, expense) => sum + expense.amount, 0))}</span></header><div className="divide-y divide-slate-800">{items.map((expense) => <article key={expense.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-200">{EXPENSE_CATEGORIES.find((item) => item.value === expense.category)?.label ?? expense.category}</span><span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">Puntual</span><span className="text-[11px] text-slate-500">{expense.date}</span></div><p className="mt-1 truncate text-sm text-slate-100">{expense.description}</p><p className="mt-1 text-xs text-slate-400">{propertyNames.get(expense.propertyId) ?? 'Inmueble eliminado'}{expense.invoiceNumber ? ` · Factura ${expense.invoiceNumber}` : ''}</p></div><div className="flex flex-wrap items-center gap-2"><button onClick={() => updateExpenseStatus(expense.id, { invoiceReceived: !expense.invoiceReceived, invoiceReceivedDate: !expense.invoiceReceived ? (expense.invoiceReceivedDate || today()) : '' })} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${expense.invoiceReceived ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-slate-700 text-slate-400'}`}>{expense.invoiceReceived ? `✓ Factura ${expense.invoiceReceivedDate || 'recibida'}` : 'Factura pendiente'}</button><button onClick={() => updateExpenseStatus(expense.id, { isPaid: !expense.isPaid, paidAt: !expense.isPaid ? (expense.paidAt || today()) : '' })} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${expense.isPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{expense.isPaid ? `✓ Pagado ${expense.paidAt || ''}` : 'Pendiente de pago'}</button><strong className="min-w-20 text-right text-sm text-slate-100">{formatEuro(expense.amount)}</strong></div></article>)}</div></section>)}</div>}
  </div>
}
