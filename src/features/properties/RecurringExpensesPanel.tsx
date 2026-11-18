import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ExpenseCategory, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { EXPENSE_CATEGORIES } from './expenseCategories'
import { useMoney } from '@/features/privacy/money'
import { addRecurringExpenseSchedule, createRecurringExpenseScheduleVersion, endRecurringExpensesFromMonth, subscribeToRecurringExpenseOccurrences, subscribeToRecurringExpenseSchedules, updateRecurringExpenseSchedule, updateRecurringOccurrence } from './recurringExpensesService'
import { isScheduleDueInMonth, occurrenceIdFor } from './recurringExpensesLogic'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const today = () => new Date().toLocaleDateString('sv-SE')

export default function RecurringExpensesPanel({ propertyId }: { propertyId: string }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [schedules, setSchedules] = useState<RecurringExpenseSchedule[]>([])
  const [occurrences, setOccurrences] = useState<RecurringExpenseOccurrence[]>([])
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory>('luz')
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endMonth, setEndMonth] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('1')
  const [requiresInvoice, setRequiresInvoice] = useState(true)
  const [autoPayOnInvoiceReceived, setAutoPayOnInvoiceReceived] = useState(true)
  const [chargeToTenant, setChargeToTenant] = useState(false)
  const [isDeductible, setIsDeductible] = useState(true)
  const [editingSchedule, setEditingSchedule] = useState<RecurringExpenseSchedule | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribeToRecurringExpenseSchedules(propertyId, setSchedules, (e) => setError(e.message)), [propertyId])
  useEffect(() => subscribeToRecurringExpenseOccurrences(propertyId, setOccurrences, (e) => setError(e.message)), [propertyId])

  const occurrenceById = useMemo(() => new Map(occurrences.map((item) => [item.id, item])), [occurrences])
  const money = useMoney()
  const formatEuro = (value: number) => money.formatEuro(value, 2)

  const openCreate = () => {
    setEditingSchedule(null)
    setCategory('luz')
    setAmount('')
    setStartDate(today())
    setEndMonth('')
    setIntervalMonths('1')
    setRequiresInvoice(true)
    setAutoPayOnInvoiceReceived(true)
    setChargeToTenant(false)
    setIsDeductible(true)
    setIsAdding(true)
  }

  const openEdit = (schedule: RecurringExpenseSchedule, month: number) => {
    setEditingSchedule(schedule)
    setCategory(schedule.category)
    setAmount(String(schedule.amount))
    setStartDate(schedule.startDate)
    setEndMonth(schedule.endDate?.slice(0, 7) ?? '')
    setIntervalMonths(String(schedule.intervalMonths))
    setRequiresInvoice(schedule.requiresInvoice)
    setAutoPayOnInvoiceReceived(Boolean(schedule.autoPayOnInvoiceReceived))
    setChargeToTenant(schedule.chargeToTenant ?? false)
    setIsDeductible(schedule.isDeductible)
    setEffectiveFrom(`${year}-${String(month).padStart(2, '0')}`)
    setIsAdding(true)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!amount || Number(intervalMonths) < 1) return
    const startMonth = editingSchedule ? effectiveFrom : startDate.slice(0, 7)
    if (!startMonth) {
      setError('Indica el mes desde el que se aplicará la obligación.')
      return
    }
    if (endMonth && endMonth < startMonth) {
      setError('El mes de finalización no puede ser anterior al inicio de esta versión.')
      return
    }
    if (editingSchedule && startMonth < editingSchedule.startDate.slice(0, 7)) {
      setError('El cambio no puede empezar antes del inicio de esta versión.')
      return
    }
    if (editingSchedule?.endDate && startMonth > editingSchedule.endDate.slice(0, 7)) {
      setError('Esta versión ya termina antes de ese mes. Crea una obligación nueva para iniciar un gasto posterior.')
      return
    }
    setSaving(true)
    setError('')
    try {
    const description = EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ?? category
    const version = {
        propertyId,
        category,
        description: description.trim(),
        amount: Number(amount),
        startDate: `${startMonth}-01`,
        endDate: endMonth ? `${endMonth}-01` : null,
        intervalMonths: Number(intervalMonths),
        requiresInvoice,
        autoPayOnInvoiceReceived: requiresInvoice && autoPayOnInvoiceReceived,
        chargeToTenant,
        isDeductible,
        isActive: true,
      }
      if (editingSchedule) {
        const hasHistory = occurrences.some((occurrence) => occurrence.scheduleId === editingSchedule.id)
        if (startMonth > editingSchedule.startDate.slice(0, 7) || hasHistory) {
          const previousMonth = new Date(`${startMonth}-01T00:00:00`)
          previousMonth.setMonth(previousMonth.getMonth() - 1)
          const previousEnd = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-01`
          await createRecurringExpenseScheduleVersion(editingSchedule.id, previousEnd, version, startMonth)
        } else {
          await updateRecurringExpenseSchedule(editingSchedule.id, version)
        }
      } else {
        await addRecurringExpenseSchedule(version)
      }
      setAmount('')
      setStartDate(today())
      setEndMonth('')
      setIntervalMonths('1')
      setRequiresInvoice(true)
      setAutoPayOnInvoiceReceived(true)
      setChargeToTenant(false)
      setIsDeductible(true)
      setIsAdding(false)
      setEditingSchedule(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la obligación periódica.')
    } finally {
      setSaving(false)
    }
  }

  const changeInvoice = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => {
    const received = !occurrence?.invoiceReceived
    const autoPay = received && Boolean(schedule.autoPayOnInvoiceReceived)
    return updateRecurringOccurrence(schedule, year, month, {
      invoiceReceived: received,
      invoiceReceivedDate: received ? (occurrence?.invoiceReceivedDate || today()) : '',
      ...(autoPay ? { isPaid: true, paidAt: occurrence?.paidAt || today() } : {}),
    })
  }
  const changePayment = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => {
    const paid = !occurrence?.isPaid
    // Si el propietario ya ha pagado, la factura del proveedor se da por
    // recibida (cuando el gasto la requiere y aún no estaba marcada).
    const autoInvoice = paid && schedule.requiresInvoice && !occurrence?.invoiceReceived
    return updateRecurringOccurrence(schedule, year, month, {
      isPaid: paid,
      paidAt: paid ? (occurrence?.paidAt || today()) : '',
      ...(autoInvoice
        ? { invoiceReceived: true, invoiceReceivedDate: occurrence?.invoiceReceivedDate || today() }
        : {}),
    })
  }
  const changeTenantInvoice = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => updateRecurringOccurrence(schedule, year, month, {
    tenantInvoiceIssued: !occurrence?.tenantInvoiceIssued,
    tenantInvoiceIssuedDate: !occurrence?.tenantInvoiceIssued ? (occurrence?.tenantInvoiceIssuedDate || today()) : '',
  })
  const changeTenantPayment = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => updateRecurringOccurrence(schedule, year, month, {
    tenantPaid: !occurrence?.tenantPaid,
    tenantPaidAt: !occurrence?.tenantPaid ? (occurrence?.tenantPaidAt || today()) : '',
  })
  const removeFromMonth = async (schedule: RecurringExpenseSchedule, month: number) => {
    const fromMonth = `${year}-${String(month).padStart(2, '0')}`
    const label = EXPENSE_CATEGORIES.find((item) => item.value === schedule.category)?.label ?? schedule.category
    if (!window.confirm(`¿Eliminar «${label}» desde ${MONTHS[month - 1]} ${year} y los meses siguientes? Los estados anteriores se conservarán.`)) return
    try {
      await endRecurringExpensesFromMonth(schedules, propertyId, schedule.category, fromMonth)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el gasto desde ese mes.')
    }
  }

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-400">Gastos recurrentes</p><h2 className="mt-1 text-2xl font-semibold text-slate-100">Gastos periódicos</h2><p className="mt-1 text-sm text-slate-400">Configura una vez cada tipo de gasto y gestiona sus repeticiones por mes.</p></div>
      <div className="flex gap-2"><select aria-label="Año" value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((value) => <option key={value} value={value}>{value}</option>)}</select><button onClick={openCreate} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">+ Añadir gasto periódico</button></div>
    </header>
    {error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
    <div className="space-y-4">{MONTHS.map((monthName, index) => {
      const month = index + 1
      const due = schedules.filter((schedule) => isScheduleDueInMonth(schedule, year, month))
      if (!due.length) return null
      return <section key={month} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h3><span className="rounded-lg border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-sm font-semibold capitalize text-emerald-200">{monthName} {year}</span></h3><span className="text-xs text-slate-400">{formatEuro(due.reduce((sum, item) => sum + item.amount, 0))} previsto</span></header><div className="divide-y divide-slate-800">{due.map((schedule) => {
        const occurrence = occurrenceById.get(occurrenceIdFor(schedule.id, year, month))
        const occurrenceKey = occurrenceIdFor(schedule.id, year, month)
        return <article key={schedule.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)] lg:items-start">
          <div className="min-w-0"><p className="font-semibold text-slate-100">{EXPENSE_CATEGORIES.find((item) => item.value === schedule.category)?.label ?? schedule.category}</p><p className="mt-1 text-xs text-slate-400">{schedule.intervalMonths === 1 ? 'Mensual' : `Cada ${schedule.intervalMonths} meses`} · {formatEuro(occurrence?.amount ?? schedule.amount)}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="space-y-2 rounded-xl border border-amber-900/60 bg-amber-950/15 p-3"><h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Salida · paga el propietario</h4>
              <label className="block text-[11px] text-slate-400">Importe real <input aria-label={`Importe de ${schedule.description} en ${monthName}`} type="number" min="0" step="0.01" value={amountDrafts[occurrenceKey] ?? String(occurrence?.amount ?? schedule.amount)} onChange={(e) => setAmountDrafts((drafts) => ({ ...drafts, [occurrenceKey]: e.target.value }))} onBlur={() => { const value = Number(amountDrafts[occurrenceKey]); if (Number.isFinite(value) && value >= 0 && value !== (occurrence?.amount ?? schedule.amount)) void updateRecurringOccurrence(schedule, year, month, { amount: value }); setAmountDrafts((drafts) => { const next = { ...drafts }; delete next[occurrenceKey]; return next }) }} className="ml-1 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100" /></label>
              {schedule.requiresInvoice ? <button onClick={() => void changeInvoice(schedule, month, occurrence)} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${occurrence?.invoiceReceived ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{occurrence?.invoiceReceived ? `✓ Factura del proveedor recibida${schedule.autoPayOnInvoiceReceived && occurrence.isPaid ? ' y pagada' : ''} ${occurrence.invoiceReceivedDate ?? ''}` : 'Factura del proveedor pendiente'}</button> : <span className="block text-[11px] text-slate-400">Sin factura del proveedor</span>}
              <button onClick={() => void changePayment(schedule, month, occurrence)} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${occurrence?.isPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{occurrence?.isPaid ? `✓ Gasto pagado ${occurrence.paidAt ?? ''}` : schedule.autoPayOnInvoiceReceived ? 'Pago pendiente (automático)' : 'Pago del propietario pendiente'}</button>
            </section>
            {schedule.chargeToTenant ? <section className="space-y-2 rounded-xl border border-teal-900/60 bg-teal-950/15 p-3"><h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-200">Entrada · se repercute al inquilino</h4><button onClick={() => void changeTenantInvoice(schedule, month, occurrence)} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${occurrence?.tenantInvoiceIssued ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-slate-700 text-slate-300'}`}>{occurrence?.tenantInvoiceIssued ? `✓ Factura enviada al inquilino ${occurrence.tenantInvoiceIssuedDate ?? ''}` : 'Factura no enviada al inquilino'}</button><button onClick={() => void changeTenantPayment(schedule, month, occurrence)} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${occurrence?.tenantPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{occurrence?.tenantPaid ? `✓ Cobro del inquilino recibido ${occurrence.tenantPaidAt ?? ''}` : 'Cobro al inquilino pendiente'}</button></section> : <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin repercusión al inquilino</h4><p className="mt-1 text-[11px] text-slate-500">Este gasto es asumido por el propietario.</p></section>}
          </div>
          <div className="flex flex-wrap justify-end gap-2 lg:col-start-2"><button type="button" onClick={() => openEdit(schedule, month)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-teal-700 hover:text-teal-200">Editar desde este mes</button><button type="button" onClick={() => void removeFromMonth(schedule, month)} className="rounded-lg border border-red-900/70 px-3 py-1.5 text-[11px] text-red-300 hover:bg-red-950/40">Eliminar desde este mes</button></div>
        </article>
      })}</div></section>
    })}</div>
    {!schedules.length && <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">Aún no hay gastos periódicos. Añade uno para que sus vencimientos aparezcan en los meses correspondientes.</div>}

    {isAdding && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4"><form onSubmit={handleCreate} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
      <div><h3 className="text-lg font-semibold text-slate-100">{editingSchedule ? 'Editar gasto periódico' : 'Añadir gasto periódico'}</h3><p className="mt-1 text-sm text-slate-400">{editingSchedule ? `Se aplicará desde ${effectiveFrom}; los meses anteriores conservarán sus datos.` : 'Se configura una vez y sus repeticiones aparecen en el control mensual.'}</p></div>
      {editingSchedule && <label className="block text-xs text-slate-300">Aplicar desde el mes de esta fila<input required type="month" min={editingSchedule.startDate.slice(0, 7)} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300 sm:col-span-2">Gasto<select value={category} onChange={(e) => { const value = e.target.value as ExpenseCategory; setCategory(value); setRequiresInvoice(value !== 'comunidad'); setAutoPayOnInvoiceReceived(['luz', 'agua', 'gas', 'suministros'].includes(value)) }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{EXPENSE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-xs text-slate-300">Importe estimado por vencimiento (€)<input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
        {!editingSchedule && <label className="text-xs text-slate-300">Primer mes de vencimiento<input required type="month" value={startDate.slice(0, 7)} onChange={(e) => setStartDate(`${e.target.value}-01`)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>}
        <label className="text-xs text-slate-300">Termina después de este mes (opcional)<input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
        <label className="text-xs text-slate-300 sm:col-span-2">Repetir cada<input required type="number" min="1" max="120" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /><span className="mt-1 block text-[11px] text-slate-500">meses: 1 mensual, 2 bimestral, 3 trimestral, 12 anual o cualquier intervalo.</span></label>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-800 p-3">
        <p className="text-xs font-semibold text-slate-200">Relación con el inquilino</p>
        <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={chargeToTenant} onChange={(e) => setChargeToTenant(e.target.checked)} className="mt-0.5 accent-teal-500" /><span><strong>Repercutir el importe al inquilino</strong><span className="block text-[11px] text-slate-500">Añade estado de factura emitida al inquilino y cobro. El pago al proveedor se controla por separado.</span></span></label>
        <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={requiresInvoice} onChange={(e) => setRequiresInvoice(e.target.checked)} className="mt-0.5 accent-teal-500" /><span>El proveedor emite una factura que debe recibirse</span></label>
        {requiresInvoice && <label className="ml-6 flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={autoPayOnInvoiceReceived} onChange={(e) => setAutoPayOnInvoiceReceived(e.target.checked)} className="mt-0.5 accent-teal-500" /><span>Al marcar la factura del proveedor como recibida, marcar también el gasto como pagado <span className="block text-[11px] text-slate-500">Útil para recibos domiciliados de luz, agua y gas; puedes desactivarlo para este gasto.</span></span></label>}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={isDeductible} onChange={(e) => setIsDeductible(e.target.checked)} className="accent-teal-500" />Marcar como deducible para el resumen fiscal</label>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-800 pt-3"><button type="button" onClick={() => { setIsAdding(false); setError('') }} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : editingSchedule ? 'Guardar desde ese mes' : 'Crear gasto'}</button></div>
    </form></div>}
  </div>
}
