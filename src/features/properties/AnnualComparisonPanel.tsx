import { useEffect, useMemo, useState } from 'react'
import { useMoney, formatEuroValue } from '@/features/privacy/money'
import type { Expense, Property, RentPayment } from '@/types'
import { buildAnnualComparison } from './annualComparison'

interface Props {
  property: Property
  payments: RentPayment[]
  expenses: Expense[]
  tenantNames: string[]
}

/**
 * Comparativa de los últimos cinco ejercicios y hoja imprimible (PDF) para el
 * gestor. La hoja se genera con el diálogo de impresión del navegador: no hay
 * dependencias de PDF y los importes salen sin enmascarar aunque el modo
 * incógnito esté activo.
 */
export default function AnnualComparison({ property, payments, expenses, tenantNames }: Props) {
  const money = useMoney()
  const [printing, setPrinting] = useState(false)
  const { rows, totals } = useMemo(
    () => buildAnnualComparison({ propertyId: property.id, payments, expenses }),
    [property.id, payments, expenses],
  )

  useEffect(() => {
    if (!printing) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [printing])

  const maxAmount = Math.max(1, ...rows.flatMap((row) => [row.income, row.expenses]))
  const hasData = rows.some((row) => row.income > 0 || row.expenses > 0)
  const width = (value: number) => `${Math.max(value > 0 ? 2 : 0, (value / maxAmount) * 100)}%`

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100">Evolución anual</h3>
          <p className="mt-1 text-xs text-slate-400">
            Ingresos realmente cobrados frente a gastos de los últimos 5 ejercicios. El valor actual del inmueble no tiene histórico.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPrinting(true)}
          disabled={!hasData}
          className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          title="Imprimir o guardar como PDF el resumen para el gestor"
        >
          🖨 PDF resumen anual
        </button>
      </div>

      {hasData ? (
        <>
          <div className="mt-5 space-y-4">
            {rows.map((row) => (
              <div key={row.year} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
                <span className="text-xs font-bold text-slate-300">{row.year}</span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: width(row.income) }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-emerald-300">{money.formatEuro(row.income)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-red-500/80" style={{ width: width(row.expenses) }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-red-300">{money.formatEuro(row.expenses)}</span>
                  </div>
                  <p className={`text-[11px] ${row.net >= 0 ? 'text-teal-300' : 'text-red-300'}`}>
                    Neto: <strong>{money.formatEuro(row.net)}</strong>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-2 border-t border-slate-800 pt-4 text-xs sm:grid-cols-3">
            <p className="text-slate-400">Ingresos: <strong className="text-emerald-300">{money.formatEuro(totals.income)}</strong></p>
            <p className="text-slate-400">Gastos: <strong className="text-red-300">{money.formatEuro(totals.expenses)}</strong></p>
            <p className="text-slate-400">Neto: <strong className={totals.net >= 0 ? 'text-teal-300' : 'text-red-300'}>{money.formatEuro(totals.net)}</strong></p>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Valor actual del inmueble: <strong className="text-slate-300">{money.formatEuro(property.currentValue)}</strong>
            {' · '}Renta actual: <strong className="text-slate-300">{money.formatEuro(property.monthlyRent)}/mes</strong>
          </p>
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Todavía no hay cobros ni gastos registrados en los últimos 5 años.
        </p>
      )}

      {printing && (
        <div id="property-annual-print">
          <h1>Resumen anual de alquiler</h1>
          <p><strong>{property.name}</strong></p>
          <p>{[property.address, property.postalCode, property.city, property.province].filter(Boolean).join(', ')}</p>
          <p>
            Propietario: {property.owner || '—'}
            {tenantNames.length ? ` · Inquilino(s): ${tenantNames.join(', ')}` : ''}
          </p>
          <table>
            <thead>
              <tr><th>Ejercicio</th><th>Ingresos cobrados</th><th>Gastos</th><th>Neto</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td className="num">{formatEuroValue(row.income)}</td>
                  <td className="num">{formatEuroValue(row.expenses)}</td>
                  <td className="num">{formatEuroValue(row.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>TOTAL</th>
                <th className="num">{formatEuroValue(totals.income)}</th>
                <th className="num">{formatEuroValue(totals.expenses)}</th>
                <th className="num">{formatEuroValue(totals.net)}</th>
              </tr>
            </tfoot>
          </table>
          <p className="footer">
            Valor actual del inmueble: {formatEuroValue(property.currentValue)} · Renta actual: {formatEuroValue(property.monthlyRent)}/mes
          </p>
          <p className="footer">Documento generado el {new Date().toLocaleDateString('es-ES')} · Legacy Manager</p>
        </div>
      )}
    </section>
  )
}
