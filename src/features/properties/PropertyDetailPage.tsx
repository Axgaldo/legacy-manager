import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Property, RentPayment, Expense, Contract, ExpenseCategory } from '@/types'
import { subscribeToProperties } from './propertiesService'
import { subscribeToYearPayments, toggleRentPayment, toggleInvoiceIssued, updateRentNotes, recordRentReceipt } from './paymentsService'
import { subscribeToPropertyExpenses, addExpense, deleteExpense, updateExpenseStatus } from './expensesService'
import { subscribeToPropertyContracts } from './contractsService'
import { isRentApplicableForMonth, normalizeRentHistory, rentAmountForMonth } from './rentRates'
import { updateProperty } from './propertiesService'
import { EXPENSE_CATEGORIES } from './expenseCategories'
import { useAuth } from '@/features/auth/AuthProvider'
import ConfirmModal from '@/components/ui/ConfirmModal'
import PropertyModal from './PropertyModal'
import RecurringExpensesPanel from './RecurringExpensesPanel'
import ContractsPanel from './ContractsPanel'
import { propertySlug } from '@/utils/slugs'
import { useOwnerDirectory } from '@/hooks/useOwnerDirectory'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

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
  const activeTab = tabParam === 'gastos' ? 'expenses' : tabParam === 'recurrentes' ? 'recurring' : tabParam === 'contratos' ? 'contracts' : tabParam === 'fiscal' ? 'tax' : 'payments'
  const setActiveTab = (tab: 'payments' | 'expenses' | 'recurring' | 'contracts' | 'tax') => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'payments') next.delete('tab')
    else next.set('tab', tab === 'expenses' ? 'gastos' : tab === 'recurring' ? 'recurrentes' : tab === 'contracts' ? 'contratos' : 'fiscal')
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

  // Modal states for new expense / contract
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isPropertyEditOpen, setIsPropertyEditOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [rentEditMonth, setRentEditMonth] = useState<number | null>(null)
  const [rentEditAmount, setRentEditAmount] = useState('')
  const [receiptEditMonth, setReceiptEditMonth] = useState<number | null>(null)
  const [receiptEditAmount, setReceiptEditAmount] = useState('')

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

  // Map of payments by month (1..12)
  const paymentsByMonth = useMemo(() => {
    const map = new Map<number, RentPayment>()
    payments.forEach((p) => map.set(p.month, p))
    return map
  }, [payments])

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

  // Tax calculation
  const taxSummary = useMemo(() => {
    const totalIncome = paymentsSummary.annualCollected

    // Breakdown of expenses
    let comunidad = 0
    let ibi = 0
    let seguro = 0
    let reparacion = 0
    let suministros = 0
    let administracion = 0
    let otros = 0

    yearExpenses.forEach((e) => {
      if (!e.isDeductible) return
      const amt = e.amount || 0
      switch (e.category) {
        case 'comunidad': comunidad += amt; break
        case 'ibi': ibi += amt; break
        case 'seguro': seguro += amt; break
        case 'reparacion': reparacion += amt; break
        case 'suministros': suministros += amt; break
        case 'administracion': administracion += amt; break
        default: otros += amt; break
      }
    })

    // If fixed monthly expenses are configured and no specific comunidad expenses logged
    const totalDeductibleExpenses = comunidad + ibi + seguro + reparacion + suministros + administracion + otros
    const netReturn = totalIncome - totalDeductibleExpenses
    const reducedReturn50 = Math.max(0, netReturn * 0.5) // Reducción estándar del 50% por arrendamiento vivienda habitual en IRPF

    return {
      totalIncome,
      comunidad,
      ibi,
      seguro,
      reparacion,
      suministros,
      administracion,
      otros,
      totalDeductibleExpenses,
      netReturn,
      reducedReturn50,
    }
  }, [paymentsSummary, yearExpenses])

  const handleTogglePaid = async (month: number) => {
    if (!property) return
    const current = paymentsByMonth.get(month)
    const newPaid = !current?.isPaid
    const amount = current?.isPaid && current.amount ? current.amount : rentAmountForMonth(property, selectedYear, month)
    await toggleRentPayment(property.id, selectedYear, month, amount, newPaid, user?.displayName || user?.email || 'Usuario')
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
    setRentEditMonth(null)
  }

  const saveReceiptAmount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!property || receiptEditMonth === null || receiptEditAmount === '' || !Number.isFinite(Number(receiptEditAmount)) || Number(receiptEditAmount) < 0) return
    await recordRentReceipt(property.id, selectedYear, receiptEditMonth, rentAmountForMonth(property, selectedYear, receiptEditMonth), Number(receiptEditAmount), user?.displayName || user?.email || 'Usuario')
    setReceiptEditMonth(null)
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

  const formatEuro = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return '0,00 €'
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

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
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800">Inmueble no encontrado</h3>
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
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">{property.name}</h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-teal-200 border border-slate-700">
              👤 {property.owner || 'Gabriel'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                property.status === 'rented'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : property.status === 'vacant'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
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
            {(property.tenants?.length || property.tenantName) && (
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-700">
                👤 Inquilinos: <strong>{property.tenants?.map((tenant) => tenant.name).filter(Boolean).join(', ') || property.tenantName}</strong>
              </span>
            )}
            {property.depositAmount !== undefined && property.depositAmount > 0 && (
              <span className="px-2.5 py-1 bg-emerald-50 rounded-lg text-xs font-medium text-emerald-800 border border-emerald-200">
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
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 shrink-0">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Renta Mensual</p>
            <p className="text-xl font-bold text-emerald-600">{formatEuro(rentAmountForMonth(property, today.getFullYear(), today.getMonth() + 1))}/mes</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Gastos Fijos</p>
            <p className="text-xl font-bold text-slate-700">{formatEuro(property.fixedExpensesMonthly)}/mes</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'payments'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          💳 Control Mensual de Cobros
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'expenses'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🧾 Gastos puntuales ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`pb-3 px-3.5 border-b-2 transition ${activeTab === 'recurring' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          🔁 Gastos periódicos
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'contracts'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📑 Historial de Contratos ({contracts.length})
        </button>
        <button
          onClick={() => setActiveTab('tax')}
          className={`pb-3 px-3.5 border-b-2 transition ${
            activeTab === 'tax'
              ? 'border-teal-700 text-teal-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📊 Resumen Fiscal (Renta / IRPF)
        </button>
      </div>

      {/* ─── TAB 1: COBROS MENSUALES ─────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Year selector & Quick stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Año de ejercicio:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-sm bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
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
                <span className="ml-1.5 font-bold text-emerald-600">{formatEuro(paymentsSummary.totalCollected)}</span>
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
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 w-32">Mes</th>
                  <th className="py-3 px-4 w-36">Renta / cobro</th>
                  <th className="py-3 px-4 w-44">Estado del Pago</th>
                  {property.rentRequiresInvoice && <th className="py-3 px-4 w-36">Factura / Recibo</th>}
                  <th className="py-3 px-4">Anotaciones puntuales del mes</th>
                  <th className="py-3 px-4 w-56">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                  const isUnrecordedPast = rentApplicable && !payment && !isCurrentMonth && !isFutureMonth

                  return (
                    <tr
                      key={monthNum}
                      className={`transition ${
                        !rentApplicable ? 'bg-slate-950/50' : isPaid ? 'bg-emerald-50/10 hover:bg-emerald-50/20' : isOverdue ? 'bg-red-950/35 hover:bg-red-950/55' : isCurrentMonth ? 'bg-amber-950/25 hover:bg-amber-950/40' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Mes */}
                      <td className={`py-3 px-4 font-bold ${rentApplicable ? 'text-slate-800' : 'text-slate-500'}`}>
                        {monthName} {selectedYear}
                      </td>

                      {/* Importe */}
                      <td className="py-3 px-4 font-semibold">
                        {rentApplicable ? <><span className={rentChanged ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800' : 'text-slate-800'}>{formatEuro(amount)}</span>{payment && (payment.receivedAmount !== undefined || payment.isPaid) && <span className={`mt-1 block text-[10px] ${received < amount ? 'text-red-700' : received > amount ? 'text-amber-700' : 'text-emerald-700'}`}>Recibido: {formatEuro(received)}{received < amount ? ` · faltan ${formatEuro(amount - received)}` : received > amount ? ` · exceso ${formatEuro(received - amount)}` : ''}</span>}</> : <span>—</span>}
                      </td>

                      {/* Estado: 1-Click Interactive Button */}
                      <td className="py-3 px-4">
                        {!rentApplicable ? <span className="text-[10px] font-semibold text-slate-500">NO APLICA · ANTES DEL INICIO</span> : <button
                          type="button"
                          onClick={() => handleTogglePaid(monthNum)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                            isPaid
                              ? 'bg-emerald-950 text-emerald-200 hover:bg-emerald-900 border border-emerald-800'
                              : isOverdue
                              ? 'bg-red-950 text-red-200 hover:bg-red-900 border border-red-800'
                              : isCurrentMonth
                              ? 'bg-amber-950 text-amber-200 hover:bg-amber-900 border border-amber-800'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                          title="Haz clic para cambiar de Pagado a Pendiente en tiempo real"
                        >
                          <span>{isPaid ? '✓ COBRADO' : received > 0 ? '◒ PAGO PARCIAL' : isOverdue ? '⚠ ATRASADO' : isCurrentMonth ? '◷ EN CURSO' : isUnrecordedPast ? '• SIN REGISTRO' : '◷ PRÓXIMO'}</span>
                        </button>}
                        {payment?.updatedBy && isPaid && (
                          <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                            Por: {payment.updatedBy}
                          </span>
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
                              : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span>📄</span>
                          <span>{invoiceIssued ? 'Emitida [✓]' : 'No emitida'}</span>
                        </button>}
                      </td>}

                      {/* Notas puntuales */}
                      <td className="py-2 px-4">
                        {rentApplicable ? <input
                          type="text"
                          defaultValue={payment?.notes || ''}
                          onBlur={(e) => handleNoteBlur(monthNum, e.target.value.trim())}
                          placeholder="Anotaciones..."
                          className="w-full px-2.5 py-1.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-teal-500 rounded-lg text-xs transition focus:outline-hidden"
                        /> : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-3 py-2">{rentApplicable ? <div className="flex flex-col items-start gap-1.5"><button type="button" onClick={() => { setRentEditMonth(monthNum); setRentEditAmount(String(amount)) }} className="rounded-md border border-teal-800 bg-teal-950/50 px-2 py-1 text-[10px] font-bold text-teal-200 hover:bg-teal-900">CAMBIO DE RENTA</button><button type="button" onClick={() => { setReceiptEditMonth(monthNum); setReceiptEditAmount(String(received)) }} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-amber-700 hover:text-amber-200">AJUSTAR IMPORTE COBRADO</button></div> : <span className="text-slate-500">—</span>}</td>
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
      {activeTab === 'contracts' && property && <ContractsPanel property={property} contracts={contracts} />}

      {/* ─── TAB 4: RESUMEN FISCAL (RENTA / IRPF) ────────────────────────── */}
      {activeTab === 'tax' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">Resumen Fiscal de Rendimiento de Capital Inmobiliario</h3>
              <p className="text-xs text-slate-500">
                Cálculo automático de Ingresos íntegros y Gastos deducibles según normativa del IRPF.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-600">Ejercicio Fiscal:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-sm bg-white"
              >
                {[currentYear - 1, currentYear].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tax Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Box 1: Ingresos */}
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">(+) Ingresos Íntegros</p>
              <p className="text-3xl font-extrabold text-emerald-700 mt-2">{formatEuro(taxSummary.totalIncome)}</p>
              <p className="text-xs text-emerald-700/80 mt-1">Total de rentas cobradas en {selectedYear}</p>
            </div>

            {/* Box 2: Gastos Deducibles */}
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">(-) Gastos Deducibles</p>
              <p className="text-3xl font-extrabold text-amber-700 mt-2">{formatEuro(taxSummary.totalDeductibleExpenses)}</p>
              <p className="text-xs text-amber-700/80 mt-1">Comunidad, IBI, seguros y reparaciones</p>
            </div>

            {/* Box 3: Rendimiento Neto */}
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700">
              <p className="text-xs font-bold text-teal-200 uppercase tracking-wider">(=) Rendimiento Neto Previo</p>
              <p className={`text-3xl font-extrabold mt-2 ${taxSummary.netReturn >= 0 ? 'text-teal-200' : 'text-red-600'}`}>
                {formatEuro(taxSummary.netReturn)}
              </p>
              <p className="text-xs text-teal-200/80 mt-1">
                Con reducción 50% vivienda: ~{formatEuro(taxSummary.reducedReturn50)}
              </p>
            </div>
          </div>

          {/* Detailed Deductible Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Desglose de Gastos Deducibles para la Declaración de la Renta ({selectedYear})
            </h4>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Comunidad de propietarios</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.comunidad)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Tributos y tasas (IBI, basura)</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.ibi)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Primas de seguro (Hogar, impago)</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.seguro)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Reparación y conservación</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.reparacion)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Suministros</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.suministros)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Administración y honorarios</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.administracion)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Otros gastos justificados</span>
                <span className="font-semibold text-slate-900">{formatEuro(taxSummary.otros)}</span>
              </div>
              <div className="py-3 flex justify-between font-bold text-sm text-slate-900 bg-slate-50 px-2 rounded-lg mt-2">
                <span>TOTAL GASTOS DEDUCIBLES</span>
                <span>{formatEuro(taxSummary.totalDeductibleExpenses)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL NUEVO GASTO / FACTURA ───────────────────────────────── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-100">Registrar gasto / factura</h3>
            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">Este formulario registra un gasto puntual. Para configurar un gasto que se repita, usa la pestaña «Gastos periódicos».</p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoría deducible *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concepto / Descripción *</label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Ej. Reparación fuga agua termo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Importe (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nº Factura / Ref.</label>
                  <input
                    type="text"
                    value={expInvoiceNumber}
                    onChange={(e) => setExpInvoiceNumber(e.target.value)}
                    placeholder="FAC-2026/04"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                <div><label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={expInvoiceReceived} onChange={(e) => setExpInvoiceReceived(e.target.checked)} className="accent-teal-600" />Factura recibida</label>{expInvoiceReceived && <input aria-label="Fecha de recepción de factura" type="date" value={expInvoiceReceivedDate} onChange={(e) => setExpInvoiceReceivedDate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />}</div>
                <div><label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={expIsPaid} onChange={(e) => setExpIsPaid(e.target.checked)} className="accent-teal-600" />Ya está pagado</label>{expIsPaid && <input aria-label="Fecha de pago" type="date" value={expPaidAt} onChange={(e) => setExpPaidAt(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />}</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="deductible"
                  checked={expIsDeductible}
                  onChange={(e) => setExpIsDeductible(e.target.checked)}
                  className="rounded text-teal-300"
                />
                <label htmlFor="deductible" className="text-slate-600 select-none">
                  Gasto deducible en IRPF / Declaración de la Renta
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
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

      {rentEditMonth !== null && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"><form onSubmit={(event) => void saveRentChange(event)} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div><h3 className="text-lg font-bold text-slate-100">Cambio de renta</h3><p className="mt-1 text-sm text-slate-400">Desde {MONTH_NAMES[rentEditMonth - 1]} {selectedYear} y para los meses siguientes.</p></div><label className="block text-sm text-slate-300">Nueva renta mensual (€)<input autoFocus required type="number" min="0" step="0.01" value={rentEditAmount} onChange={(event) => setRentEditAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setRentEditMonth(null)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Guardar cambio</button></div></form></div>}
      {receiptEditMonth !== null && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"><form onSubmit={(event) => void saveReceiptAmount(event)} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div><h3 className="text-lg font-bold text-slate-100">Importe recibido</h3><p className="mt-1 text-sm text-slate-400">{MONTH_NAMES[receiptEditMonth - 1]} {selectedYear}: renta esperada {formatEuro(rentAmountForMonth(property, selectedYear, receiptEditMonth))}. Indica el total recibido.</p></div><label className="block text-sm text-slate-300">Importe recibido (€)<input autoFocus required type="number" min="0" step="0.01" value={receiptEditAmount} onChange={(event) => setReceiptEditAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label><p className="text-xs text-slate-500">Si es menor, se conservará la diferencia como pendiente. Si es mayor, el exceso quedará señalado.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setReceiptEditMonth(null)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Guardar importe</button></div></form></div>}

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

