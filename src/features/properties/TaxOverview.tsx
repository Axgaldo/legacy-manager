import { useEffect, useMemo, useState } from 'react'
import { Expense, Property, RentPayment, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { subscribeToAllYearPayments } from './paymentsService'
import { subscribeToYearExpenses } from './expensesService'
import { subscribeToAllRecurringExpenseOccurrences, subscribeToAllRecurringExpenseSchedules } from './recurringExpensesService'
import { isRentApplicableForMonth } from './rentRates'
import { isScheduleDueInMonth, occurrenceIdFor } from './recurringExpensesLogic'
import { downloadFiscalYearCsv } from '@/features/backup/backupService'
import { useMoney } from '@/features/privacy/money'
import { useToast } from '@/components/ui/ToastProvider'

/**
 * Resumen fiscal general de los alquileres (IRPF, rendimiento de capital
 * inmobiliario). El IRPF se declara por contribuyente agregando todos sus
 * inmuebles, así que esta vista vive en la sección general y no en cada
 * piso: filtra por propietario, provincia y año, suma puntuales y
 * periódicos deducibles y permite descargar el CSV equivalente.
 */

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'comunidad', label: 'Comunidad de propietarios' },
  { value: 'ibi', label: 'Tributos y tasas (IBI, basura)' },
  { value: 'seguro', label: 'Primas de seguro (hogar, impago)' },
  { value: 'reparacion', label: 'Reparación y conservación' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'administracion', label: 'Administración y honorarios' },
  { value: 'otros', label: 'Otros gastos justificados' },
]

export default function TaxOverview({ properties }: { properties: Property[] }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [owner, setOwner] = useState('all')
  const [province, setProvince] = useState('all')
  const [payments, setPayments] = useState<RentPayment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [schedules, setSchedules] = useState<RecurringExpenseSchedule[]>([])
  const [occurrences, setOccurrences] = useState<RecurringExpenseOccurrence[]>([])
  const [exporting, setExporting] = useState(false)

  const money = useMoney()
  const toast = useToast()
  const formatEuro = (value?: number) => money.formatEuro(value, 2)

  useEffect(() => subscribeToAllYearPayments(year, setPayments, (error) => console.error('No se pudieron cargar los cobros:', error)), [year])
  useEffect(() => subscribeToYearExpenses(year, setExpenses, (error) => console.error('No se pudieron cargar los gastos:', error)), [year])
  useEffect(() => subscribeToAllRecurringExpenseSchedules(setSchedules, (error) => console.error('No se pudieron cargar los periódicos:', error)), [])
  useEffect(() => subscribeToAllRecurringExpenseOccurrences(year, setOccurrences, (error) => console.error('No se pudieron cargar las ocurrencias:', error)), [year])

  const ownerOptions = useMemo(
    () => Array.from(new Set(properties.map((property) => property.owner || 'Gabriel'))).sort((a, b) => a.localeCompare(b, 'es')),
    [properties],
  )
  const provinceOptions = useMemo(
    () => Array.from(new Set(properties.map((property) => property.province).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'es')),
    [properties],
  )

  const filteredProperties = useMemo(
    () => properties.filter((property) =>
      (owner === 'all' || (property.owner || 'Gabriel') === owner)
      && (province === 'all' || property.province === province)),
    [properties, owner, province],
  )

  const occurrenceById = useMemo(() => new Map(occurrences.map((item) => [item.id, item])), [occurrences])

  /** Fila fiscal por inmueble: ingresos cobrados y deducibles por categoría. */
  const rows = useMemo(() => filteredProperties.map((property) => {
    // Igual que el resto de la app: solo cuentan los cobros de meses en los
    // que el alquiler era aplicable según el histórico de rentas.
    const income = payments
      .filter((payment) => payment.propertyId === property.id && isRentApplicableForMonth(property, year, payment.month))
      .reduce((total, payment) => total + (payment.receivedAmount ?? (payment.isPaid ? payment.amount : 0)), 0)

    const byCategory = new Map<string, number>()
    const addDeductible = (category: string, amount: number) => {
      const key = CATEGORIES.some((item) => item.value === category) ? category : 'otros'
      byCategory.set(key, (byCategory.get(key) ?? 0) + amount)
    }

    // Gastos puntuales deducibles
    expenses
      .filter((expense) => expense.propertyId === property.id && expense.isDeductible)
      .forEach((expense) => addDeductible(expense.category, expense.amount || 0))

    // Gastos periódicos deducibles: cada vencimiento con su ocurrencia real
    // (si existe) o el importe previsto del calendario.
    schedules
      .filter((schedule) => schedule.propertyId === property.id && schedule.isDeductible)
      .forEach((schedule) => {
        for (let month = 1; month <= 12; month++) {
          if (!isScheduleDueInMonth(schedule, year, month)) continue
          const occurrence = occurrenceById.get(occurrenceIdFor(schedule.id, year, month))
          addDeductible(schedule.category, occurrence?.amount ?? schedule.amount)
        }
      })

    const deductible = Array.from(byCategory.values()).reduce((total, value) => total + value, 0)
    return { property, income, byCategory, deductible, net: income - deductible }
  }), [filteredProperties, payments, expenses, schedules, occurrenceById, year])

  const totals = useMemo(() => {
    const income = rows.reduce((total, row) => total + row.income, 0)
    const byCategory = new Map<string, number>()
    rows.forEach((row) => row.byCategory.forEach((amount, key) => byCategory.set(key, (byCategory.get(key) ?? 0) + amount)))
    const deductible = rows.reduce((total, row) => total + row.deductible, 0)
    const net = income - deductible
    return { income, byCategory, deductible, net, reduced: Math.max(0, net * 0.5) }
  }, [rows])

  const handleExport = async () => {
    try {
      setExporting(true)
      const result = await downloadFiscalYearCsv(year, {
        owner: owner === 'all' ? undefined : owner,
        province: province === 'all' ? undefined : province,
      })
      toast.showToast(`Resumen fiscal ${year} descargado (${result.properties} inmueble(s)).`, { kind: 'success' })
    } catch (error) {
      toast.showToast(`No se pudo generar el CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`, { kind: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-400">Vista general</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-100">Resumen fiscal de alquileres (IRPF)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Rendimiento de capital inmobiliario por propietario: ingresos íntegros y gastos deducibles
            (puntuales y periódicos) de todos sus inmuebles. El IRPF se declara así, agregado por contribuyente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-slate-400">Propietario
            <select value={owner} onChange={(event) => setOwner(event.target.value)} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
              <option value="all">Todos</option>
              {ownerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Provincia
            <select value={province} onChange={(event) => setProvince(event.target.value)} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
              <option value="all">Todas</option>
              {provinceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Ejercicio
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
              {[currentYear - 2, currentYear - 1, currentYear].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </header>

      {filteredProperties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">
          No hay inmuebles que coincidan con estos filtros.
        </div>
      ) : (
        <>
          {/* Cajas de totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800">
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">(+) Ingresos Íntegros</p>
              <p className="text-3xl font-extrabold text-emerald-300 mt-2">{formatEuro(totals.income)}</p>
              <p className="text-xs text-emerald-400/80 mt-1">Rentas cobradas en {year} por {filteredProperties.length} inmueble(s)</p>
            </div>
            <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800">
              <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">(-) Gastos Deducibles</p>
              <p className="text-3xl font-extrabold text-amber-300 mt-2">{formatEuro(totals.deductible)}</p>
              <p className="text-xs text-amber-400/80 mt-1">Puntuales y periódicos marcados como deducibles</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
              <p className="text-xs font-bold text-teal-200 uppercase tracking-wider">(=) Rendimiento Neto Previo</p>
              <p className={`text-3xl font-extrabold mt-2 ${totals.net >= 0 ? 'text-teal-200' : 'text-red-400'}`}>
                {formatEuro(totals.net)}
              </p>
              <p className="text-xs text-teal-200/80 mt-1">
                Con reducción 50% vivienda: ~{formatEuro(totals.reduced)}
              </p>
            </div>
          </div>

          {/* Desglose por categoría */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Desglose de gastos deducibles ({year})
            </h4>
            <div className="divide-y divide-slate-800 text-xs">
              {CATEGORIES.map((category) => (
                <div key={category.value} className="py-2.5 flex justify-between">
                  <span className="text-slate-400">{category.label}</span>
                  <span className="font-semibold text-slate-200">{formatEuro(totals.byCategory.get(category.value) ?? 0)}</span>
                </div>
              ))}
              <div className="py-3 flex justify-between font-bold text-sm text-slate-100 bg-slate-950 px-2 rounded-lg mt-2">
                <span>TOTAL GASTOS DEDUCIBLES</span>
                <span>{formatEuro(totals.deductible)}</span>
              </div>
            </div>
          </div>

          {/* Detalle por inmueble */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto shadow-xs">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Inmueble</th>
                  <th className="py-3 px-4">Provincia</th>
                  <th className="py-3 px-4 text-right">Ingresos</th>
                  <th className="py-3 px-4 text-right">Deducibles</th>
                  <th className="py-3 px-4 text-right">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.property.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-200">{row.property.name}</td>
                    <td className="py-3 px-4 text-slate-400">{row.property.province || '—'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-300">{formatEuro(row.income)}</td>
                    <td className="py-3 px-4 text-right text-amber-300">{formatEuro(row.deductible)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${row.net >= 0 ? 'text-teal-200' : 'text-red-400'}`}>{formatEuro(row.net)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-700 bg-slate-950/50 font-bold text-slate-100">
                  <td className="py-3 px-4" colSpan={2}>TOTAL</td>
                  <td className="py-3 px-4 text-right text-emerald-300">{formatEuro(totals.income)}</td>
                  <td className="py-3 px-4 text-right text-amber-300">{formatEuro(totals.deductible)}</td>
                  <td className="py-3 px-4 text-right text-teal-200">{formatEuro(totals.net)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-[11px] leading-relaxed text-slate-500">
              Cálculo orientativo según la normativa de rendimiento de capital inmobiliario: solo cobros de meses con
              alquiler aplicable y gastos marcados como deducibles (puntuales y periódicos). La reducción del 50% se
              aplica al arrendamiento de vivienda; los locales tributan sin ella. Confirma siempre con tu asesor.
            </p>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="shrink-0 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {exporting ? 'Generando…' : `Descargar fiscal ${year} (CSV)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
