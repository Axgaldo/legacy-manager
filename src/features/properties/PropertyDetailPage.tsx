import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Property, RentPayment, RentPaymentManualStatus, Expense, Contract, ExpenseCategory, Tenant, TenantDocument, RecurringExpenseSchedule } from '@/types'
import { subscribeToProperties } from './propertiesService'
import { subscribeToYearPayments, toggleInvoiceIssued, updateRentNotes, recordRentReceipt, updateRentPaymentMeta } from './paymentsService'
import { subscribeToPropertyExpenses, addExpense, deleteExpense, updateExpenseStatus } from './expensesService'
import { subscribeToRecurringExpenseSchedules } from './recurringExpensesService'
import { recurringMonthlyAverageForProperty } from './recurringExpensesLogic'
import { subscribeToPropertyContracts } from './contractsService'
import { isRentApplicableForMonth, normalizeRentHistory, rentAmountForMonth } from './rentRates'
import { updateProperty } from './propertiesService'
import { EXPENSE_CATEGORIES } from './expenseCategories'
import { useAuth } from '@/features/auth/AuthProvider'
import ConfirmModal from '@/components/ui/ConfirmModal'
import PropertyModal from './PropertyModal'
import RecurringExpensesPanel from './RecurringExpensesPanel'
import ContractsPanel from './ContractsPanel'
import PropertyTenantsPanel from '@/features/tenants/PropertyTenantsPanel'
import { countDocumentsByTenant, migratePropertyTenants, subscribeToAllTenantDocuments, subscribeToTenants } from '@/features/tenants/tenantsService'
import { propertySlug } from '@/utils/slugs'
import { useOwnerDirectory } from '@/hooks/useOwnerDirectory'
import { useMoney } from '@/features/privacy/money'
import { MANUAL_STATUS_OPTIONS, RENT_STATUS_META, resolveAutoRentStatus, resolveRentStatus } from './rentPaymentStatus'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function ReceivedAmountInput({ value, onCommit, className }: { value: number; onCommit: (value: number) => void; className?: string }) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : '')

  useEffect(() => {
    setDraft(value > 0 ? String(value) : '')
  }, [value])

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'))
    if (draft.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      setDraft(value > 0 ? String(value) : '')
      return
    }
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      placeholder="0"
      aria-label="Importe recibido"
      className={className}
    />
  )
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { owners, defaultOwner } = useOwnerDirectory()
  const navigate = useNavigate()
  const propertyIdRef = useRef<string | null>(null)
  const { user } = useAuth()
  const [today, setToday] = useState(() => new Date())

  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)

  // Selected sub-tab
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = tabParam === 'gastos' ? 'expenses' : tabParam === 'recurrentes' ? 'recurring' : tabParam === 'contratos' ? 'contracts' : tabParam === 'inquilinos' ? 'tenants' : 'payments'
  const setActiveTab = (tab: 'payments' | 'expenses' | 'recurring' | 'contracts' | 'tenants') => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'payments') next.delete('tab')
    else next.set('tab', tab === 'expenses' ? 'gastos' : tab === 'recurring' ? 'recurrentes' : tab === 'contracts' ? 'contratos' : 'inquilinos')
    setSearchParams(next)
  }

  // Selected year
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  // Payments, Expenses, Contracts
  const [payments, setPayments] = useState<RentPayment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantDocuments, setTenantDocuments] = useState<TenantDocument[]>([])
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringExpenseSchedule[]>([])

  // Modal states for new expense / contract
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isPropertyEditOpen, setIsPropertyEditOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [rentEditMonth, setRentEditMonth] = useState<number | null>(null)
  const [rentEditAmount, setRentEditAmount] = useState('')

  // New Expense form state
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0])
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('reparacion')
  const [expAmount, setExpAmount] = useState('')
  const [expDescription, setExpDescription] = useState('')
  const [expInvoiceNumber, setExpInvoiceNumber] = useState('')
  const [expNotes, setExpNotes] = useState('')
  const [expIsDeductible, setExpIsDeductible] = useState(true)
  const [expInvoiceReceived, setExpInvoiceReceived] = useState(false)
  const [expInvoiceReceivedDate, setExpInvoiceReceivedDate] = useState('')
  const [expIsPaid, setExpIsPaid] = useState(false)
  const [expPaidAt, setExpPaidAt] = useState('')


  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Subscribe to property
  useEffect(() => {
    if (!id) return
    propertyIdRef.current = null
    const unsub = subscribeToProperties((items) => {
      const found = items.find((p) => p.id === id || propertySlug(p, items) === id || p.id === propertyIdRef.current)
      if (found) {
        propertyIdRef.current = found.id
        const canonicalSlug = propertySlug(found, items)
        if (canonicalSlug !== id) navigate(`/inmuebles/${canonicalSlug}${window.location.search}`, { replace: true })
      }
      setProperty(found || null)
      setLoading(false)
    })
    return () => unsub()
  }, [id, navigate])

  // Subscribe to rent payments for selected year
  useEffect(() => {
    if (!property) return
    const unsub = subscribeToYearPayments(property.id, selectedYear, (items) => {
      setPayments(items)
    })
    return () => unsub()
  }, [property?.id, selectedYear])

  // Subscribe to expenses
  useEffect(() => {
    if (!property) return
    const unsub = subscribeToPropertyExpenses(property.id, (items) => {
      setExpenses(items)
    })
    return () => unsub()
  }, [property?.id])

  // Subscribe to contracts
  useEffect(() => {
    if (!property) return
    const unsub = subscribeToPropertyContracts(property.id, (items) => {
      setContracts(items)
    })
    return () => unsub()
  }, [property?.id])

  // Subscribe to recurring expenses (hero de la ficha: media mensual)
  useEffect(() => {
    if (!property) return
    const unsubSchedules = subscribeToRecurringExpenseSchedules(property.id, setRecurringSchedules, () => {})
    return () => {
      unsubSchedules()
    }
  }, [property?.id])

  // Tenant directory and document index (used by the tenants tab and hero badges)
  useEffect(() => subscribeToTenants(setTenants, (error) => console.error('No se pudieron cargar los inquilinos:', error)), [])
  useEffect(() => subscribeToAllTenantDocuments(setTenantDocuments, (error) => console.error('No se pudo cargar el índice de documentos:', error)), [])

  // Turn legacy embedded tenants into tenant entities the first time the property is opened.
  useEffect(() => {
    if (!property || !id) return
    void migratePropertyTenants(property)
  }, [property])

  // Map of payments by month (1..12)
  const paymentsByMonth = useMemo(() => {
    const map = new Map<number, RentPayment>()
    payments.forEach((p) => map.set(p.month, p))
    return map
  }, [payments])

  const tenantDocumentCounts = useMemo(() => countDocumentsByTenant(tenantDocuments), [tenantDocuments])
  const linkedTenants = useMemo(() => {
    const ids = new Set(property?.tenantIds ?? [])
    return tenants.filter((tenant) => ids.has(tenant.id))
  }, [property?.tenantIds, tenants])

  // Payments summary
  const paymentsSummary = useMemo(() => {
    let totalCollected = 0
    let totalPending = 0
    let paidMonthsCount = 0
    let invoicesCount = 0
    let annualCollected = 0
    const dueMonths = selectedYear < currentYear ? 12 : selectedYear === currentYear ? currentMonth : 0

    paymentsByMonth.forEach((payment) => { if (property && isRentApplicableForMonth(property, payment.year, payment.month)) annualCollected += payment.receivedAmount ?? (payment.isPaid ? payment.amount : 0) })
    for (let m = 1; m <= dueMonths; m++) {
      if (property && !isRentApplicableForMonth(property, selectedYear, m)) continue
      const p = paymentsByMonth.get(m)
      const amount = property ? rentAmountForMonth(property, selectedYear, m) : 0
      const received = p?.receivedAmount ?? (p?.isPaid ? (p.amount || amount) : 0)
      totalCollected += received
      if (received >= amount && amount > 0) {
        paidMonthsCount++
      } else if (p || (selectedYear === currentYear && m === currentMonth)) {
        totalPending += Math.max(0, amount - received)
      }
    }
    paymentsByMonth.forEach((payment) => { if (payment.invoiceIssued && property && isRentApplicableForMonth(property, payment.year, payment.month)) invoicesCount++ })

    return { totalCollected, totalPending, paidMonthsCount, invoicesCount, dueMonths, annualCollected }
  }, [paymentsByMonth, property, selectedYear, currentYear, currentMonth])

  // Filtered expenses for selected year
  const yearExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.date) {
        return e.date.startsWith(String(selectedYear))
      }
      return e.year === selectedYear
    })
  }, [expenses, selectedYear])

  const visibleExpenses = yearExpenses
  const expensesByMonth = useMemo(() => {
    const groups = new Map<number, Expense[]>()
    visibleExpenses.forEach((expense) => groups.set(expense.month, [...(groups.get(expense.month) ?? []), expense]))
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0])
  }, [visibleExpenses])

  // Tax calculation moved to the general «Fiscal» view (/inmuebles/fiscal).

  const handleReceivedSave = async (month: number, expected: number, received: number) => {
    if (!property) return
    await recordRentReceipt(property.id, selectedYear, month, expected, received, user?.displayName || user?.email || 'Usuario')
  }

  const handleMarkReceived = async (month: number, expected: number) => {
    if (expected <= 0) return
    await handleReceivedSave(month, expected, expected)
  }

  const handleManualStatus = async (month: number, amount: number, status: RentPaymentManualStatus) => {
    if (!property) return
    await updateRentPaymentMeta(property.id, selectedYear, month, amount, { manualStatus: status })
  }

  const handleWarningVisibility = async (month: number, amount: number, showWarning: boolean) => {
    if (!property) return
    await updateRentPaymentMeta(property.id, selectedYear, month, amount, { showWarning })
  }

  const saveRentChange = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!property || rentEditMonth === null || rentEditAmount === '' || !Number.isFinite(Number(rentEditAmount))) return
    const effectiveFrom = `${selectedYear}-${String(rentEditMonth).padStart(2, '0')}`
    const amount = Number(rentEditAmount)
    const existingHistory = property.rentHistory ?? []
    const legacyStart = '1900-01'
    const previous = existingHistory.length ? existingHistory : property.monthlyRent !== undefined ? [{ effectiveFrom: legacyStart, amount: property.monthlyRent }] : []
    await updateProperty(property.id, { rentHistory: normalizeRentHistory([...previous, { effectiveFrom, amount }]) })
    // The new rent is an estimate: let the automatic "Cambio de renta" colour take over.
    if (paymentsByMonth.has(rentEditMonth)) {
      await updateRentPaymentMeta(property.id, selectedYear, rentEditMonth, amount, { manualStatus: 'auto' })
    }
    setRentEditMonth(null)
  }

  const handleToggleInvoice = async (month: number) => {
    if (!property || !property.rentRequiresInvoice) return
    const current = paymentsByMonth.get(month)
    const newInvoice = !current?.invoiceIssued
    const amount = current?.isPaid && current.amount ? current.amount : rentAmountForMonth(property, selectedYear, month)
    await toggleInvoiceIssued(property.id, selectedYear, month, amount, newInvoice)
  }

  const handleNoteBlur = async (month: number, noteVal: string) => {
    if (!property) return
    const current = paymentsByMonth.get(month)
    if (current?.notes === noteVal) return
    const amount = current?.isPaid && current.amount ? current.amount : rentAmountForMonth(property, selectedYear, month)
    await updateRentNotes(property.id, selectedYear, month, amount, noteVal)
  }

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property || !expAmount) return
    const [y, m] = expDate.split('-').map(Number)
    await addExpense({
      propertyId: property.id,
      date: expDate,
      year: y || selectedYear,
      month: m || 1,
      category: expCategory,
      kind: 'one-off',
      amount: parseFloat(expAmount),
      description: expDescription.trim(),
      invoiceNumber: expInvoiceNumber.trim() || undefined,
      invoiceReceived: expInvoiceReceived,
      invoiceReceivedDate: expInvoiceReceived ? expInvoiceReceivedDate || expDate : undefined,
      isPaid: expIsPaid,
      paidAt: expIsPaid ? expPaidAt || expDate : undefined,
      notes: expNotes.trim() || undefined,
      isDeductible: expIsDeductible,
    })
    setIsExpenseModalOpen(false)
    setExpAmount('')
    setExpDescription('')
    setExpInvoiceNumber('')
    setExpNotes('')
    setExpInvoiceReceived(false)
    setExpInvoiceReceivedDate('')
    setExpIsPaid(false)
    setExpPaidAt('')
  }

  const money = useMoney()
  // Los importes de la ficha del inmueble se muestran con céntimos.
  const formatEuro = (amount?: number) => money.formatEuro(amount, 2)

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-3 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando datos del inmueble…</p>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800">
        <h3 className="text-lg font-bold text-slate-100">Inmueble no encontrado</h3>
        <Link to="/inmuebles" className="mt-4 inline-block text-sm font-semibold text-teal-300 hover:underline">
          ← Volver al listado de Inmuebles
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/inmuebles"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <span>←</span>
          <span>Volver a Inmuebles</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Ref: {property.cadastralReference || 'Sin ref. catastral'}</span>
          <button type="button" onClick={() => setIsPropertyEditOpen(true)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-teal-600 hover:text-teal-300">
            Editar inmueble e inquilinos
          </button>
        </div>
      </div>

      {/* Property Hero Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-100">{property.name}</h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-teal-200 border border-slate-700">
              👤 {property.owner || 'Gabriel'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                property.status === 'rented'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : property.status === 'vacant'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                  : 'bg-slate-800 text-teal-200 border-slate-700'
              }`}
            >
              {property.status === 'rented' ? 'Alquilado' : property.status === 'vacant' ? 'Vacío' : 'Uso propio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>📍</span>
            <span>{property.address}, {property.city} ({property.province}) {property.postalCode}</span>
          </p>

          {/* Quick Info Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {(linkedTenants.length > 0 || property.tenants?.length || property.tenantName) && (
              <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-medium text-slate-300">
                👤 Inquilinos: <strong>{linkedTenants.map((tenant) => tenant.name).filter(Boolean).join(', ') || property.tenants?.map((tenant) => tenant.name).filter(Boolean).join(', ') || property.tenantName}</strong>
              </span>
            )}
            {property.depositAmount !== undefined && property.depositAmount > 0 && (
              <span className="px-2.5 py-1 bg-emerald-950/60 rounded-lg text-xs font-medium text-emerald-300 border border-emerald-800">
                🔒 Fianza: <strong>{formatEuro(property.depositAmount)}</strong>
              </span>
            )}
            {property.avraReference && (
              <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-medium text-teal-200 border border-slate-700 font-mono">
              🏛️ Ref. fianza: {property.avraReference}
              </span>
            )}
          </div>
        </div>

        {/* Right Financial summary */}
        <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Renta Mensual</p>
            <p className="text-xl font-bold text-emerald-400">{formatEuro(rentAmountForMonth(property, today.getFullYear(), today.getMonth() + 1))}/mes</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Gastos Periódicos</p>
            <p className="text-xl font-bold text-slate-300">
              {recurringMonthlyAverageForProperty(recurringSchedules, property.id, today) > 0
                ? `${formatEuro(recurringMonthlyAverageForProperty(recurringSchedules, property.id, today))}/mes`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'payments'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          💳 Control Mensual de Cobros
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'recurring'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          🔁 Gastos periódicos
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'expenses'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          🧾 Gastos puntuales ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'contracts'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          📑 Historial de Contratos ({contracts.length})
        </button>
        <button
          onClick={() => setActiveTab('tenants')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'tenants'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-200'
          }`}
        >
          👥 Inquilinos ({linkedTenants.length})
        </button>
      </div>

      {/* ─── TAB 1: COBROS MENSUALES ─────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Year selector & Quick stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Año de ejercicio:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-700 font-bold text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400">Cobrado ({paymentsSummary.paidMonthsCount}/{paymentsSummary.dueMonths} meses vencidos):</span>
                <span className="ml-1.5 font-bold text-emerald-400">{formatEuro(paymentsSummary.totalCollected)}</span>
              </div>
              <div>
                <span className="text-slate-400">Pendiente (vencido + mes actual):</span>
                <span className="ml-1.5 font-bold text-amber-300">{formatEuro(paymentsSummary.totalPending)}</span>
              </div>
              {property.rentRequiresInvoice && <div>
                <span className="text-slate-400">Recibos/Facturas:</span>
                <span className="ml-1.5 font-bold text-teal-300">{paymentsSummary.invoicesCount} emitidos</span>
              </div>}
            </div>
          </div>

          {/* Real-time Monthly Grid */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto shadow-xs">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 w-32">Mes</th>
                  <th className="py-3 px-4 w-44">Renta / recibido</th>
                  <th className="py-3 px-4 w-48">Color / estado</th>
                  {property.rentRequiresInvoice && <th className="py-3 px-4 w-36">Factura / Recibo</th>}
                  <th className="py-3 px-4">Anotaciones y etiquetas</th>
                  <th className="py-3 px-4 w-40">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {MONTH_NAMES.map((monthName, idx) => {
                  const monthNum = idx + 1
                  const payment = paymentsByMonth.get(monthNum)
                  const rentApplicable = isRentApplicableForMonth(property, selectedYear, monthNum)
                  const isPaid = rentApplicable && Boolean(payment?.isPaid)
                  const invoiceIssued = rentApplicable && Boolean(payment?.invoiceIssued)
                  const amount = rentApplicable ? rentAmountForMonth(property, selectedYear, monthNum) : 0
                  const received = rentApplicable ? payment?.receivedAmount ?? (payment?.isPaid ? (payment.amount || amount) : 0) : 0
                  const rentChanged = rentApplicable && (property.rentHistory?.some((rate) => rate.effectiveFrom === `${selectedYear}-${String(monthNum).padStart(2, '0')}`) ?? false)
                  const isCurrentMonth = selectedYear === currentYear && monthNum === currentMonth
                  const isFutureMonth = selectedYear > currentYear || (selectedYear === currentYear && monthNum > currentMonth)
                  const isOverdue = rentApplicable && Boolean(payment) && !isPaid && !isCurrentMonth && !isFutureMonth
                  const autoStatus = resolveAutoRentStatus({ rentApplicable, received, due: amount, isFuture: isFutureMonth, isCurrent: isCurrentMonth, rentChanged })
                  const status = resolveRentStatus(payment?.manualStatus, autoStatus)
                  const statusMeta = RENT_STATUS_META[status]
                  const manualStatus: RentPaymentManualStatus = payment?.manualStatus ?? 'auto'
                  const showWarning = payment?.showWarning !== false
                  const warningActive = rentApplicable && amount > 0 && !isFutureMonth && !(rentChanged && received <= 0) && received !== amount
                  const warningIsExcess = received > amount

                  return (
                    <tr
                      key={monthNum}
                      className={`transition ${
                        !rentApplicable ? 'bg-slate-950/50' : isPaid ? 'bg-emerald-950/25 hover:bg-emerald-950/40' : isOverdue ? 'bg-red-950/35 hover:bg-red-950/55' : isCurrentMonth ? 'bg-amber-950/25 hover:bg-amber-950/40' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Mes */}
                      <td className={`py-3 px-4 font-bold ${rentApplicable ? 'text-slate-200' : 'text-slate-500'}`}>
                        {monthName} {selectedYear}
                      </td>

                      {/* Importe esperado + recibido editable */}
                      <td className="py-3 px-4">
                        {rentApplicable ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className={`text-sm font-bold ${statusMeta.text}`}>{formatEuro(amount)}</span>
                              {rentChanged && (
                                <span className="rounded-full border border-sky-800 bg-sky-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
                                  Estimada
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <ReceivedAmountInput
                                value={received}
                                onCommit={(next) => void handleReceivedSave(monthNum, amount, next)}
                                className={`w-24 rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums focus:outline-hidden focus:ring-1 focus:ring-teal-500 ${statusMeta.badge}`}
                              />
                              <span className="text-[10px] text-slate-400">€ recibido</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Color / etiqueta del estado */}
                      <td className="py-3 px-4">
                        {!rentApplicable ? (
                          <span className="text-[10px] font-semibold text-slate-500">NO APLICA · ANTES DEL INICIO</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta.dot}`} />
                              <select
                                value={manualStatus}
                                onChange={(event) => void handleManualStatus(monthNum, amount, event.target.value as RentPaymentManualStatus)}
                                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] font-semibold text-slate-300 focus:border-teal-500 focus:outline-hidden"
                                title="Cambiar manualmente el color y la etiqueta"
                              >
                                {MANUAL_STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <span className={`text-[10px] font-semibold ${statusMeta.text}`}>
                              {statusMeta.label} · {manualStatus === 'auto' ? 'automático' : 'manual'}
                            </span>
                            {payment?.updatedBy && isPaid && (
                              <span className="block truncate max-w-[150px] text-[10px] text-slate-400">
                                Por: {payment.updatedBy}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Factura / Recibo emitido */}
                      {property.rentRequiresInvoice && <td className="py-3 px-4">
                        {!rentApplicable ? <span className="text-slate-500">—</span> : <button
                          type="button"
                          onClick={() => handleToggleInvoice(monthNum)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                            invoiceIssued
                              ? 'bg-slate-800 text-teal-200 border-slate-700 hover:bg-slate-700'
                              : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span>📄</span>
                          <span>{invoiceIssued ? 'Emitida [✓]' : 'No emitida'}</span>
                        </button>}
                      </td>}

                      {/* Notas + etiquetas/avisos */}
                      <td className="py-2 px-4">
                        {rentApplicable ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              defaultValue={payment?.notes || ''}
                              onBlur={(e) => handleNoteBlur(monthNum, e.target.value.trim())}
                              placeholder="Anotaciones..."
                              className="w-full px-2.5 py-1.5 bg-transparent hover:bg-slate-950 focus:bg-slate-950 border border-transparent hover:border-slate-700 focus:border-teal-500 rounded-lg text-xs transition focus:outline-hidden"
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusMeta.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                                {statusMeta.label}
                              </span>
                              {warningActive && showWarning && (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${warningIsExcess ? 'border-amber-800 bg-amber-950/60 text-amber-300' : 'border-red-800 bg-red-950/60 text-red-300'}`}>
                                  {warningIsExcess ? `Exceso ${formatEuro(received - amount)}` : `Faltan ${formatEuro(amount - received)}`}
                                  <button
                                    type="button"
                                    onClick={() => void handleWarningVisibility(monthNum, amount, false)}
                                    className="rounded-full px-0.5 font-bold hover:bg-black/5"
                                    title="Ocultar este aviso"
                                  >
                                    ✕
                                  </button>
                                </span>
                              )}
                              {warningActive && !showWarning && (
                                <button
                                  type="button"
                                  onClick={() => void handleWarningVisibility(monthNum, amount, true)}
                                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200"
                                  title="Volver a mostrar el aviso"
                                >
                                  👁 Mostrar aviso
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {rentApplicable ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleMarkReceived(monthNum, amount)}
                              className="rounded-md border border-emerald-800 bg-emerald-950/50 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-900"
                              title="Marcar la renta completa como recibida"
                            >
                              ✓ COBRADO
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRentEditMonth(monthNum); setRentEditAmount(String(amount)) }}
                              className="rounded-md border border-teal-800 bg-teal-950/50 px-2 py-1 text-[10px] font-bold text-teal-200 hover:bg-teal-900"
                              title="Cambiar la renta desde este mes"
                            >
                              CAMBIO DE RENTA
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: GASTOS PUNTUALES ────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-base font-bold text-slate-100">Gastos puntuales</h3><p className="text-xs text-slate-400">Registra aquí reparaciones y otros pagos aislados. Las obligaciones que se repiten se configuran en «Gastos periódicos».</p></div>
            <div className="flex flex-wrap items-center gap-2"><select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => <option key={year}>{year}</option>)}</select><button onClick={() => setIsExpenseModalOpen(true)} className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600">+ Registrar gasto</button></div>
          </div>
          {visibleExpenses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center"><p className="font-semibold text-slate-200">Sin gastos puntuales para este periodo</p><p className="mt-1 text-xs text-slate-400">Registra aquí reparaciones y otros pagos aislados.</p><button onClick={() => setIsExpenseModalOpen(true)} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white">Añadir gasto puntual</button></div> : <div className="space-y-4">{expensesByMonth.map(([month, monthExpenses]) => <section key={month} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h4 className="font-semibold capitalize text-slate-200">{MONTH_NAMES[month - 1]} {selectedYear}</h4><span className="text-xs text-slate-400">Total: {formatEuro(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0))}</span></header><div className="divide-y divide-slate-800">{monthExpenses.map((expense) => <div key={expense.id} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-300">{EXPENSE_CATEGORIES.find((category) => category.value === expense.category)?.label ?? expense.category}</span><span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Puntual</span><span className="text-[11px] text-slate-500">{expense.date}</span></div><p className="mt-1 text-sm font-medium text-slate-100">{expense.description}</p><p className="mt-1 text-xs text-slate-400">{expense.invoiceNumber ? `Factura ${expense.invoiceNumber} · ` : ''}{expense.notes || ''}</p></div><div className="flex flex-wrap items-center gap-2 sm:justify-end"><button onClick={() => updateExpenseStatus(expense.id, { invoiceReceived: !expense.invoiceReceived, invoiceReceivedDate: !expense.invoiceReceived ? new Date().toLocaleDateString('sv-SE') : '' })} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${expense.invoiceReceived ? 'border-teal-800 bg-teal-950 text-teal-200' : 'border-slate-700 text-slate-400'}`}>{expense.invoiceReceived ? `✓ Factura ${expense.invoiceReceivedDate || 'recibida'}` : 'Factura pendiente'}</button><button onClick={() => updateExpenseStatus(expense.id, { isPaid: !expense.isPaid, paidAt: !expense.isPaid ? new Date().toLocaleDateString('sv-SE') : '' })} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${expense.isPaid ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-amber-800 bg-amber-950 text-amber-200'}`}>{expense.isPaid ? `✓ Pagado ${expense.paidAt || ''}` : 'Pendiente de pago'}</button><span className="min-w-20 text-right text-sm font-bold text-slate-100">{formatEuro(expense.amount)}</span><button onClick={() => setExpenseToDelete(expense)} aria-label="Eliminar gasto puntual" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-red-950 hover:text-red-300">×</button></div></div>)}</div></section>)}</div>}
        </div>
      )}

      {activeTab === 'recurring' && property && <RecurringExpensesPanel propertyId={property.id} />}

      {/* ─── TAB 3: HISTORIAL DE CONTRATOS ──────────────────────────────── */}
      {activeTab === 'contracts' && property && <ContractsPanel property={property} contracts={contracts} tenants={linkedTenants} />}

      {/* ─── TAB: INQUILINOS ────────────────────────────────────────────── */}
      {activeTab === 'tenants' && property && (
        <div className="animate-in fade-in duration-150">
          <PropertyTenantsPanel property={property} tenants={tenants} documentCounts={tenantDocumentCounts} />
        </div>
      )}

      {/* ─── MODAL NUEVO GASTO / FACTURA ───────────────────────────────── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100">Registrar gasto / factura</h3>
            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-xs"
                />
              </div>

              <p className="rounded-lg bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">Este formulario registra un gasto puntual. Para configurar un gasto que se repita, usa la pestaña «Gastos periódicos».</p>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Categoría deducible *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg text-xs bg-slate-950 text-slate-100"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Concepto / Descripción *</label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Ej. Reparación fuga agua termo"
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-xs placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Importe (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 rounded-lg text-xs font-bold text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nº Factura / Ref.</label>
                  <input
                    type="text"
                    value={expInvoiceNumber}
                    onChange={(e) => setExpInvoiceNumber(e.target.value)}
                    placeholder="FAC-2026/04"
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 p-3 sm:grid-cols-2">
                <div><label className="flex items-center gap-2 font-semibold text-slate-300"><input type="checkbox" checked={expInvoiceReceived} onChange={(e) => setExpInvoiceReceived(e.target.checked)} className="accent-teal-600" />Factura recibida</label>{expInvoiceReceived && <input aria-label="Fecha de recepción de factura" type="date" value={expInvoiceReceivedDate} onChange={(e) => setExpInvoiceReceivedDate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-2 py-1.5 text-xs" />}</div>
                <div><label className="flex items-center gap-2 font-semibold text-slate-300"><input type="checkbox" checked={expIsPaid} onChange={(e) => setExpIsPaid(e.target.checked)} className="accent-teal-600" />Ya está pagado</label>{expIsPaid && <input aria-label="Fecha de pago" type="date" value={expPaidAt} onChange={(e) => setExpPaidAt(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-2 py-1.5 text-xs" />}</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="deductible"
                  checked={expIsDeductible}
                  onChange={(e) => setExpIsDeductible(e.target.checked)}
                  className="rounded text-teal-300"
                />
                <label htmlFor="deductible" className="text-slate-400 select-none">
                  Gasto deducible en IRPF / Declaración de la Renta
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-lg font-bold"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rentEditMonth !== null && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"><form onSubmit={(event) => void saveRentChange(event)} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div><h3 className="text-lg font-bold text-slate-100">Cambio de renta</h3><p className="mt-1 text-sm text-slate-400">Desde {MONTH_NAMES[rentEditMonth - 1]} {selectedYear} y para los meses siguientes. El importe quedará marcado como renta estimada hasta que se cobre.</p></div><label className="block text-sm text-slate-300">Nueva renta mensual (€)<input autoFocus required type="number" min="0" step="0.01" value={rentEditAmount} onChange={(event) => setRentEditAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setRentEditMonth(null)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Guardar cambio</button></div></form></div>}

      {/* Delete Expense Modal */}
      <ConfirmModal
        isOpen={expenseToDelete !== null}
        title="¿Eliminar este gasto?"
        message={`Se eliminará "${expenseToDelete?.description}" por importe de ${formatEuro(expenseToDelete?.amount)}.`}
        confirmWord="BORRAR"
        confirmButtonText="Eliminar Gasto"
        isDestructive={true}
        onConfirm={async () => {
          if (expenseToDelete) {
            await deleteExpense(expenseToDelete.id)
            setExpenseToDelete(null)
          }
        }}
        onClose={() => setExpenseToDelete(null)}
      />
      <PropertyModal isOpen={isPropertyEditOpen} propertyToEdit={property} owners={owners} defaultOwner={defaultOwner} onClose={() => setIsPropertyEditOpen(false)} onSaved={() => setIsPropertyEditOpen(false)} />
    </div>
  )
}

