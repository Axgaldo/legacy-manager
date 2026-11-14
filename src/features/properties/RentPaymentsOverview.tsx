import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Property, RentPayment } from '@/types'
import { subscribeToAllYearPayments } from './paymentsService'
import { rentAmountForMonth } from './rentRates'
import { propertySlug } from '@/utils/slugs'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const euro = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

export default function RentPaymentsOverview({ properties }: { properties: Property[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [payments, setPayments] = useState<RentPayment[]>([])
  useEffect(() => subscribeToAllYearPayments(year, setPayments), [year])

  const paymentByPropertyMonth = useMemo(() => new Map(payments.map((payment) => [`${payment.propertyId}_${payment.month}`, payment])), [payments])

  return <section className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-semibold text-slate-100">Alquileres por inmueble y mes</h3><p className="mt-1 text-sm text-slate-400">Cada celda muestra únicamente el importe recibido.</p></div><label className="text-xs text-slate-400">Año <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></header>
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="min-w-[1050px] w-full border-collapse text-xs">
        <thead><tr className="border-b border-slate-700 bg-slate-950/70 text-slate-400"><th className="sticky left-0 z-10 min-w-48 bg-slate-950 px-4 py-3 text-left">Inmueble</th>{MONTHS.map((month) => <th key={month} className="min-w-20 px-2 py-3 text-center">{month}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800">{properties.map((property) => <tr key={property.id} className="hover:bg-slate-800/50"><th className="sticky left-0 bg-slate-900 px-4 py-3 text-left font-medium text-slate-200"><Link to={`/inmuebles/${propertySlug(property, properties)}`} className="hover:text-teal-300">{property.name}</Link></th>{MONTHS.map((_, index) => {
          const month = index + 1
          const payment = paymentByPropertyMonth.get(`${property.id}_${month}`)
          const received = payment?.receivedAmount ?? (payment?.isPaid ? payment.amount : 0)
          const due = rentAmountForMonth(property, year, month)
          const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)
          const color = due <= 0 && received <= 0 ? 'text-slate-600' : received <= 0 ? (isFuture ? 'text-slate-600' : 'text-red-300') : received < due ? 'text-red-300' : received > due ? 'text-amber-300' : 'text-emerald-300'
          return <td key={month} className={`px-2 py-3 text-center font-semibold tabular-nums ${color}`}>{received > 0 ? euro(received) : '—'}</td>
        })}</tr>)}</tbody>
        {properties.length > 0 && <tfoot><tr className="border-t border-slate-700 bg-slate-950/50 font-semibold text-slate-300"><th className="sticky left-0 bg-slate-950 px-4 py-3 text-left">Total recibido</th>{MONTHS.map((_, index) => { const total = properties.reduce((sum, property) => { const payment = paymentByPropertyMonth.get(`${property.id}_${index + 1}`); return sum + (payment?.receivedAmount ?? (payment?.isPaid ? payment.amount : 0)) }, 0); return <td key={index} className="px-2 py-3 text-center tabular-nums">{total ? euro(total) : '—'}</td> })}</tr></tfoot>}
      </table>
      {properties.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No hay inmuebles registrados.</p>}
    </div>
    <p className="text-[11px] text-slate-500">Verde: renta completa · rojo: importe parcial o sin pago vencido · ámbar: exceso recibido.</p>
  </section>
}

