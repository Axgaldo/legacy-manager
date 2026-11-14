import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ExpenseCategory, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { EXPENSE_CATEGORIES } from './expenseCategories'
import { addRecurringExpenseSchedule, createRecurringExpenseScheduleVersion, endRecurringExpenseSchedule, subscribeToRecurringExpenseOccurrences, subscribeToRecurringExpenseSchedules, updateRecurringExpenseSchedule, updateRecurringOccurrence } from './recurringExpensesService'

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
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endMonth, setEndMonth] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('1')
  const [requiresInvoice, setRequiresInvoice] = useState(true)
  const [chargeToTenant, setChargeToTenant] = useState(false)
  const [isDeductible, setIsDeductible] = useState(true)
  const [editingSchedule, setEditingSchedule] = useState<RecurringExpenseSchedule | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribeToRecurringExpenseSchedules(propertyId, setSchedules, (e) => setError(e.message)), [propertyId])
  useEffect(() => subscribeToRecurringExpenseOccurrences(propertyId, setOccurrences, (e) => setError(e.message)), [propertyId])

  const occurrenceById = useMemo(() => new Map(occurrences.map((item) => [item.id, item])), [occurrences])
  const scheduledFor = (schedule: RecurringExpenseSchedule, month: number) => {
    const [startYear, startMonth] = schedule.startDate.slice(0, 7).split('-').map(Number)
    const monthDelta = (year - startYear) * 12 + month - startMonth
    const [endYear, endMonth] = (schedule.endDate ?? '9999-12').slice(0, 7).split('-').map(Number)
    const endDelta = (endYear - year) * 12 + endMonth - month
    return monthDelta >= 0 && endDelta >= 0 && monthDelta % Math.max(1, schedule.intervalMonths) === 0
  }
  const formatEuro = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)

  const openCreate = () => {
    setEditingSchedule(null)
    setCategory('luz')
    setDescription('')
    setAmount('')
    setStartDate(today())
    setEndMonth('')
    setIntervalMonths('1')
    setRequiresInvoice(true)
    setChargeToTenant(false)
    setIsDeductible(true)
    setIsAdding(true)
  }

  const openEdit = (schedule: RecurringExpenseSchedule) => {
    setEditingSchedule(schedule)
    setCategory(schedule.category)
    setDescription(schedule.description)
    setAmount(String(schedule.amount))
    setStartDate(schedule.startDate)
    setEndMonth(schedule.endDate?.slice(0, 7) ?? '')
    setIntervalMonths(String(schedule.intervalMonths))
    setRequiresInvoice(schedule.requiresInvoice)
    setChargeToTenant(schedule.chargeToTenant ?? false)
    setIsDeductible(schedule.isDeductible)
    setEffectiveFrom('')
    setIsAdding(true)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!description.trim() || !amount || Number(intervalMonths) < 1) return
    const startMonth = editingSchedule ? effectiveFrom : startDate.slice(0, 7)
    if (!startMonth) {
      setError('Indica el mes desde el que se aplicará la obligación.')
      return
    }
    if (endMonth && endMonth < startMonth) {
      setError('El mes de finalización no puede ser anterior al inicio de esta versión.')
      return
    }
    const hasHistory = editingSchedule && occurrences.some((occurrence) => occurrence.scheduleId === editingSchedule.id)
    if (editingSchedule && startMonth <= editingSchedule.startDate.slice(0, 7) && hasHistory) {
      setError('Esta obligación ya tiene estados mensuales guardados. Para conservarlos, los cambios deben empezar después del inicio de la versión actual.')
      return
    }
    if (editingSchedule?.endDate && startMonth > editingSchedule.endDate.slice(0, 7)) {
      setError('Esta versión ya termina antes de ese mes. Crea una obligación nueva para iniciar un gasto posterior.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const version = {
        propertyId,
        category,
        description: description.trim(),
        amount: Number(amount),
        startDate: `${startMonth}-01`,
        endDate: endMonth ? `${endMonth}-01` : null,
        intervalMonths: Number(intervalMonths),
        requiresInvoice,
        chargeToTenant,
        isDeductible,
        isActive: true,
      }
      if (editingSchedule) {
        if (startMonth > editingSchedule.startDate.slice(0, 7)) {
          const previousMonth = new Date(`${startMonth}-01T00:00:00`)
          previousMonth.setMonth(previousMonth.getMonth() - 1)
          const previousEnd = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-01`
          await createRecurringExpenseScheduleVersion(editingSchedule.id, previousEnd, version)
        } else {
          await updateRecurringExpenseSchedule(editingSchedule.id, version)
        }
      } else {
        await addRecurringExpenseSchedule(version)
      }
      setDescription('')
      setAmount('')
      setStartDate(today())
      setEndMonth('')
      setIntervalMonths('1')
      setRequiresInvoice(true)
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

  const changeInvoice = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => updateRecurringOccurrence(schedule, year, month, {
    invoiceReceived: !occurrence?.invoiceReceived,
    invoiceReceivedDate: !occurrence?.invoiceReceived ? (occurrence?.invoiceReceivedDate || today()) : '',
  })
  const changePayment = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => updateRecurringOccurrence(schedule, year, month, {
    isPaid: !occurrence?.isPaid,
    paidAt: !occurrence?.isPaid ? (occurrence?.paidAt || today()) : '',
  })
  const changeTenantInvoice = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => updateRecurringOccurrence(schedule, year, month, {
    tenantInvoiceIssued: !occurrence?.tenantInvoiceIssued,
    tenantInvoiceIssuedDate: !occurrence?.tenantInvoiceIssued ? (occurrence?.tenantInvoiceIssuedDate || today()) : '',
  })
  const changeTenantPayment = (schedule: RecurringExpenseSchedule, month: number, occurrence?: RecurringExpenseOccurrence) => updateRecurringOccurrence(schedule, year, month, {
    tenantPaid: !occurrence?.tenantPaid,
    tenantPaidAt: !occurrence?.tenantPaid ? (occurrence?.tenantPaidAt || today()) : '',
  })

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-400">Obligaciones recurrentes</p><h2 className="mt-1 text-2xl font-semibold text-slate-100">Gastos periódicos</h2><p className="mt-1 text-sm text-slate-400">Configura cada gasto una vez y define cuándo cambia, cuándo termina y cómo se liquida.</p></div>
      <div className="flex gap-2"><select aria-label="Año" value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((value) => <option key={value} value={value}>{value}</option>)}</select><button onClick={openCreate} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">+ Añadir obligación</button></div>
    </header>
    {error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
    {schedules.length > 0 && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="mb-3 text-sm font-semibold text-slate-200">Obligaciones y versiones</h3><div className="flex flex-wrap gap-2">{schedules.map((schedule) => <span key={schedule.id} className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">{EXPENSE_CATEGORIES.find((item) => item.value === schedule.category)?.label}: {schedule.description} · {formatEuro(schedule.amount)} cada {schedule.intervalMonths} {schedule.intervalMonths === 1 ? 'mes' : 'meses'} · desde {schedule.startDate.slice(0, 7)}{schedule.endDate ? ` hasta ${schedule.endDate.slice(0, 7)}` : ''}<button onClick={() => openEdit(schedule)} className="ml-1 text-teal-300 hover:text-teal-200">Editar desde…</button>{schedule.isActive && <button aria-label={`Finalizar ${schedule.description}`} title="Finaliza al terminar el mes actual; conserva las versiones anteriores" onClick={() => { const current = today(); const finalEnd = schedule.endDate && schedule.endDate.slice(0, 7) < current.slice(0, 7) ? schedule.endDate : current; if (window.confirm(`¿Finalizar «${schedule.description}» al terminar ${finalEnd.slice(0, 7)}? Los vencimientos históricos se conservarán.`)) void endRecurringExpenseSchedule(schedule.id, finalEnd) }} className="ml-1 text-amber-300 hover:text-amber-200">Finalizar</button>}</span>)}</div></section>}

    <div className="space-y-4">{MONTHS.map((monthName, index) => {
      const month = index + 1
      const due = schedules.filter((schedule) => scheduledFor(schedule, month))
      if (!due.length) return null
      return <section key={month} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h3 className="font-semibold text-slate-200">{monthName} {year}</h3><span className="text-xs text-slate-400">{formatEuro(due.reduce((sum, item) => sum + item.amount, 0))} previsto</span></header><div className="divide-y divide-slate-800">{due.map((schedule) => {
        const occurrence = occurrenceById.get(`${schedule.id}_${year}-${String(month).padStart(2, '0')}`)
        const occurrenceKey = `${schedule.id}_${year}-${String(month).padStart(2, '0')}`
        return <article key={schedule.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><p className="font-semibold text-slate-100">{EXPENSE_CATEGORIES.find((item) => item.value === schedule.category)?.label ?? schedule.category} · {schedule.description}</p><p className="mt-1 text-xs text-slate-400">{schedule.intervalMonths === 1 ? 'Mensual' : `Cada ${schedule.intervalMonths} meses`}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-slate-400">Importe real <input aria-label={`Importe de ${schedule.description} en ${monthName}`} type="number" min="0" step="0.01" value={amountDrafts[occurrenceKey] ?? String(occurrence?.amount ?? schedule.amount)} onChange={(e) => setAmountDrafts((drafts) => ({ ...drafts, [occurrenceKey]: e.target.value }))} onBlur={() => { const value = Number(amountDrafts[occurrenceKey]); if (Number.isFinite(value) && value >= 0 && value !== (occurrence?.amount ?? schedule.amount)) void updateRecurringOccurrence(schedule, year, month, { amount: value }); setAmountDrafts((drafts) => { const next = { ...drafts }; delete next[occurrenceKey]; return next }) }} className="ml-1 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100" /></label>
            {schedule.requiresInvoice ? <button onClick={() => void changeInvoice(schedule, month, occurrence)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${occurrence?.invoiceReceived ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{occurrence?.invoiceReceived ? `✓ Factura proveedor recibida ${occurrence.invoiceReceivedDate ?? ''}` : 'Factura proveedor pendiente'}</button> : <span className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-400">Sin factura de proveedor</span>}
            <button onClick={() => void changePayment(schedule, month, occurrence)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${occurrence?.isPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{occurrence?.isPaid ? `✓ Pagado por propietario ${occurrence.paidAt ?? ''}` : 'Pendiente propietario'}</button>
            {schedule.chargeToTenant && <><button onClick={() => void changeTenantInvoice(schedule, month, occurrence)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${occurrence?.tenantInvoiceIssued ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-slate-700 text-slate-300'}`}>{occurrence?.tenantInvoiceIssued ? `✓ Factura al inquilino ${occurrence.tenantInvoiceIssuedDate ?? ''}` : 'Factura al inquilino pendiente'}</button><button onClick={() => void changeTenantPayment(schedule, month, occurrence)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${occurrence?.tenantPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{occurrence?.tenantPaid ? `✓ Inquilino pagó ${occurrence.tenantPaidAt ?? ''}` : 'Cobro al inquilino pendiente'}</button></>}
          </div>
        </article>
      })}</div></section>
    })}</div>
    {!schedules.length && <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">Aún no hay obligaciones periódicas. Añade una para que sus vencimientos aparezcan en los meses correspondientes.</div>}

    {isAdding && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4"><form onSubmit={handleCreate} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
      <div><h3 className="text-lg font-semibold text-slate-100">{editingSchedule ? 'Nueva versión de la obligación' : 'Nueva obligación periódica'}</h3><p className="mt-1 text-sm text-slate-400">{editingSchedule ? 'Los datos anteriores y sus estados mensuales se conservarán.' : 'Se crea una vez y genera filas mensuales de control automáticamente.'}</p></div>
      {editingSchedule && <label className="block text-xs text-slate-300">Aplicar los cambios desde<input required type="month" min={editingSchedule.startDate.slice(0, 7)} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /><span className="mt-1 block text-[11px] text-slate-500">Si ya hay estados mensuales guardados, el cambio debe empezar después para conservarlos.</span></label>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300">Categoría<select value={category} onChange={(e) => { const value = e.target.value as ExpenseCategory; setCategory(value); if (value === 'comunidad') setRequiresInvoice(false) }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">{EXPENSE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-xs text-slate-300">Concepto / nombre<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Electricidad vivienda" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
        <label className="text-xs text-slate-300">Importe estimado por vencimiento (€)<input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
        {!editingSchedule && <label className="text-xs text-slate-300">Primer mes de vencimiento<input required type="month" value={startDate.slice(0, 7)} onChange={(e) => setStartDate(`${e.target.value}-01`)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>}
        <label className="text-xs text-slate-300">Termina después de este mes (opcional)<input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
        <label className="text-xs text-slate-300 sm:col-span-2">Repetir cada<input required type="number" min="1" max="120" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /><span className="mt-1 block text-[11px] text-slate-500">meses: 1 mensual, 2 bimestral, 3 trimestral, 12 anual o cualquier intervalo.</span></label>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-800 p-3">
        <p className="text-xs font-semibold text-slate-200">Relación con el inquilino</p>
        <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={chargeToTenant} onChange={(e) => setChargeToTenant(e.target.checked)} className="mt-0.5 accent-teal-500" /><span><strong>Repercutir el importe al inquilino</strong><span className="block text-[11px] text-slate-500">Añade estado de factura emitida al inquilino y cobro. El pago al proveedor se controla por separado.</span></span></label>
        <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={requiresInvoice} onChange={(e) => setRequiresInvoice(e.target.checked)} className="mt-0.5 accent-teal-500" /><span>El proveedor emite una factura que debe recibirse</span></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={isDeductible} onChange={(e) => setIsDeductible(e.target.checked)} className="accent-teal-500" />Marcar como deducible para el resumen fiscal</label>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-800 pt-3"><button type="button" onClick={() => { setIsAdding(false); setError('') }} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : editingSchedule ? 'Guardar desde ese mes' : 'Crear obligación'}</button></div>
    </form></div>}
  </div>
}
