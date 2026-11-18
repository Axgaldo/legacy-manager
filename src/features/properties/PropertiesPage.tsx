import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Property, PropertyStatus, AssetItem, RentPayment, RecurringExpenseSchedule, Tenant } from '@/types'
import { subscribeToProperties, deleteProperty } from './propertiesService'
import { subscribeToTenants } from '@/features/tenants/tenantsService'
import { subscribeToAssets } from '@/features/collections/assetsService'
import { subscribeToPaymentsThroughYear } from './paymentsService'
import { subscribeToAllRecurringExpenseSchedules } from './recurringExpensesService'
import { recurringMonthlyAverage, recurringMonthlyAverageForProperty } from './recurringExpensesLogic'
import PropertyModal from './PropertyModal'
import PropertyExpensesOverview from './PropertyExpensesOverview'
import RentPaymentsOverview from './RentPaymentsOverview'
import { isRentApplicableForMonth, rentAmountForMonth } from './rentRates'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { propertySlug } from '@/utils/slugs'
import { getDefaultOwner, getOwnerOptions } from '@/utils/owners'
import { useMoney } from '@/features/privacy/money'
import { useToast } from '@/components/ui/ToastProvider'
import TenantsPage from '@/features/tenants/TenantsPage'

export type PropertiesTab = 'properties' | 'rentals' | 'expenses' | 'tenants'

const OVERVIEW_TABS: Array<{ value: PropertiesTab; label: string; to: string }> = [
  { value: 'properties', label: 'Inmuebles', to: '/inmuebles' },
  { value: 'rentals', label: 'Alquileres', to: '/inmuebles/alquileres' },
  { value: 'expenses', label: 'Gastos', to: '/inmuebles/gastos' },
  { value: 'tenants', label: 'Inquilinos', to: '/inmuebles/inquilinos' },
]

const TYPE_ICONS: Record<string, string> = {
  apartment: '🏢',
  commercial: '🏪',
  garage: '🚗',
  storage: '📦',
  house: '🏡',
  rural: '🌳',
}

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Piso',
  commercial: 'Local',
  garage: 'Garaje',
  storage: 'Trastero',
  house: 'Casa',
  rural: 'Finca',
}

export default function PropertiesPage({ tab = 'properties' }: { tab?: PropertiesTab }) {
  const navigate = useNavigate()
  const overview = tab
  const [properties, setProperties] = useState<Property[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([])
  const [today, setToday] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringExpenseSchedule[]>([])

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)

  // Safe delete modal
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | PropertyStatus>('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeToProperties(
      (items) => {
        setProperties(items)
        setLoading(false)
        setFirestoreError(null)
      },
      (err) => {
        setFirestoreError(err.message)
        setLoading(false)
      },
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => subscribeToAssets(setAssets, (error) => console.error('No se pudieron cargar los propietarios de bienes:', error)), [])
  useEffect(() => subscribeToTenants(setTenants, (error) => console.error('No se pudieron cargar los inquilinos:', error)), [])
  useEffect(() => subscribeToAllRecurringExpenseSchedules(setRecurringSchedules, (error) => console.error('No se pudieron cargar los gastos periódicos:', error)), [])

  const ownerOptions = useMemo(() => getOwnerOptions(properties, assets), [properties, assets])
  const defaultOwner = useMemo(() => getDefaultOwner(properties, assets), [properties, assets])

  useEffect(() => {
    return subscribeToPaymentsThroughYear(new Date().getFullYear(), setRentPayments, (error) => {
      console.error('No se pudo cargar el resumen de cobros:', error)
    })
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const currentMonthLabel = today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const paymentStatusByProperty = useMemo(() => {
    const result = new Map<string, { collected: number; currentPaid: boolean; currentApplicable: boolean; arrearsCount: number; arrearsAmount: number }>()
    properties.forEach((property) => {
      const propertyPayments = rentPayments.filter((payment) => payment.propertyId === property.id)
      const current = propertyPayments.find((payment) => payment.year === currentYear && payment.month === currentMonth)
      const arrears = propertyPayments.map((payment) => ({ payment, due: rentAmountForMonth(property, payment.year, payment.month), received: payment.receivedAmount ?? (payment.isPaid ? payment.amount : 0) })).filter(({ payment, due, received }) => (payment.year < currentYear || (payment.year === currentYear && payment.month < currentMonth)) && due > received)
      const currentDue = rentAmountForMonth(property, currentYear, currentMonth)
      const currentApplicable = isRentApplicableForMonth(property, currentYear, currentMonth)
      const currentReceived = currentApplicable ? current?.receivedAmount ?? (current?.isPaid ? current.amount : 0) : 0
      result.set(property.id, {
        collected: currentReceived,
        currentPaid: currentReceived >= currentDue && currentDue > 0,
        currentApplicable,
        arrearsCount: arrears.length,
        arrearsAmount: arrears.reduce((sum, item) => sum + Math.max(0, item.due - item.received), 0),
      })
    })
    return result
  }, [properties, rentPayments, currentYear, currentMonth])

  const currentMonthSummary = useMemo(() => {
    const rented = properties.filter((property) => property.status === 'rented')
    const expected = rented.reduce((sum, property) => sum + rentAmountForMonth(property, currentYear, currentMonth), 0)
    const collected = rented.reduce((sum, property) => sum + (paymentStatusByProperty.get(property.id)?.collected ?? 0), 0)
    const arrears = Array.from(paymentStatusByProperty.values())
    return {
      expected,
      collected,
      arrearsCount: arrears.reduce((sum, status) => sum + status.arrearsCount, 0),
      arrearsAmount: arrears.reduce((sum, status) => sum + status.arrearsAmount, 0),
    }
  }, [properties, paymentStatusByProperty, currentYear, currentMonth])

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalMonthlyRent = 0
    let rentedCount = 0
    let vacantCount = 0
    let totalValue = 0

    properties.forEach((p) => {
      if (p.status === 'rented') {
        rentedCount += 1
        totalMonthlyRent += rentAmountForMonth(p, currentYear, currentMonth)
      } else if (p.status === 'vacant') {
        vacantCount += 1
      }
      totalValue += p.currentValue || 0
    })

    // Gastos fijos reales: media mensual de los gastos periódicos activos
    // (comunidad al mes, IBI anual / 12…). Los puntuales no son fijos.
    const totalMonthlyExpenses = recurringMonthlyAverage(recurringSchedules, today)
    const netMonthly = totalMonthlyRent - totalMonthlyExpenses

    return {
      totalCount: properties.length,
      rentedCount,
      vacantCount,
      totalMonthlyRent,
      totalMonthlyExpenses,
      netMonthly,
      totalValue,
    }
  }, [properties, recurringSchedules, today, currentYear, currentMonth])

  /** Media mensual de gastos periódicos por inmueble, para las tarjetas. */
  const recurringAverageByProperty = useMemo(() => {
    const result = new Map<string, number>()
    properties.forEach((property) => {
      result.set(property.id, recurringMonthlyAverageForProperty(recurringSchedules, property.id, today))
    })
    return result
  }, [properties, recurringSchedules, today])

  // Filtered properties
  const tenantNamesFor = (property: Property): string[] => {
    const linked = (property.tenantIds ?? [])
      .map((tenantId) => tenants.find((tenant) => tenant.id === tenantId)?.name)
      .filter((name): name is string => Boolean(name))
    if (linked.length) return linked
    const embedded = property.tenants?.map((tenant) => tenant.name).filter(Boolean) ?? []
    if (embedded.length) return embedded
    return property.tenantName ? [property.tenantName] : []
  }

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      const matchesOwner = ownerFilter === 'all' || (p.owner || 'Gabriel') === ownerFilter
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.address.toLowerCase().includes(query) ||
        p.city.toLowerCase().includes(query) ||
        tenantNamesFor(p).some((tenantName) => tenantName.toLowerCase().includes(query)) ||
        (p.owner && p.owner.toLowerCase().includes(query))

      return matchesStatus && matchesOwner && matchesSearch
    })
  }, [properties, statusFilter, ownerFilter, searchQuery, tenants])

  const handleOpenAddModal = () => {
    setEditingProperty(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (prop: Property) => {
    setEditingProperty(prop)
    setIsModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!propertyToDelete) return
    setIsDeleting(true)
    try {
      await deleteProperty(propertyToDelete.id)
      setPropertyToDelete(null)
      toast.showToast(`Inmueble «${propertyToDelete.name}» eliminado.`, { kind: 'success' })
    } catch (err: any) {
      toast.showToast('Error al eliminar: ' + err.message, { kind: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const money = useMoney()
  const toast = useToast()

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Inmuebles</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestión y seguimiento patrimonial de inmuebles en España
          </p>
        </div>
        {overview === 'properties' && <button onClick={handleOpenAddModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-600"><span className="text-lg">＋</span>Añadir Inmueble</button>}
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
        {OVERVIEW_TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => navigate(item.to)}
            aria-current={overview === item.value ? 'page' : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              overview === item.value
                ? item.value === 'properties'
                  ? 'bg-slate-700 text-white'
                  : 'bg-teal-950 text-teal-200'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Firestore Security Rules Banner if error */}
      {firestoreError && (
        <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-800 text-amber-200 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Aviso de permisos de Firestore:</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Si acabas de empezar, asegúrate de haber pegado las reglas en Firebase Console → Firestore Database → pestaña "Reglas" y haber hecho clic en "Publicar".
            </p>
            <p className="text-[11px] font-mono text-amber-400/70 mt-1">{firestoreError}</p>
          </div>
        </div>
      )}

      {overview === 'properties' ? <>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inmuebles */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Inmuebles Totales
          </p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-100">{metrics.totalCount}</span>
            <span className="text-xs text-slate-500">
              ({metrics.rentedCount} alquilados · {metrics.vacantCount} vacíos)
            </span>
          </div>
        </div>

        {/* Ingresos Mensuales */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Ingresos Brutos / Mes
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            {money.formatEuro(metrics.totalMonthlyRent)}
          </p>
        </div>

        {/* Gastos Mensuales */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Gastos Periódicos / Mes
          </p>
          <p className="text-2xl font-bold text-slate-300 mt-2">
            {money.formatEuro(metrics.totalMonthlyExpenses)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">Media mensual de las obligaciones periódicas activas</p>
        </div>

        {/* Rendimiento Neto Mensual */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs">
          <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
            Flujo Neto / Mes
          </p>
          <p
            className={`text-2xl font-bold mt-2 ${
              metrics.netMonthly >= 0 ? 'text-teal-200' : 'text-red-400'
            }`}
          >
            {money.formatEuro(metrics.netMonthly)}
          </p>
        </div>
      </div>

      <section aria-label="Resumen de alquileres del mes" className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-3 sm:p-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mes actual</p><p className="mt-1 text-base font-semibold capitalize text-slate-100">{currentMonthLabel}</p><p className="mt-1 text-xs text-slate-500">Cobros esperados: {money.formatEuro(currentMonthSummary.expected)}</p></div>
        <div className="border-t border-slate-800 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cobrado este mes</p><p className="mt-1 text-xl font-semibold text-teal-300">{money.formatEuro(currentMonthSummary.collected)}</p><p className="mt-1 text-xs text-slate-500">{currentMonthSummary.expected > 0 ? `${Math.round(currentMonthSummary.collected / currentMonthSummary.expected * 100)}% de lo esperado` : 'Sin rentas previstas'}</p></div>
        <div className={`border-t border-slate-800 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 ${currentMonthSummary.arrearsAmount > 0 ? 'text-red-300' : 'text-slate-300'}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Atrasos de meses anteriores</p><p className="mt-1 text-xl font-semibold">{money.formatEuro(currentMonthSummary.arrearsAmount)}</p><p className="mt-1 text-xs">{currentMonthSummary.arrearsCount ? `⚠ ${currentMonthSummary.arrearsCount} mensualidad(es) pendiente(s)` : '✓ Sin atrasos registrados'}</p></div>
      </section>

      {/* Filter and Search Bar */}
      <div className="space-y-3 pt-2">
        {/* Propietarios Filter */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <span className="font-bold text-slate-500 uppercase text-[11px] shrink-0">Propietario:</span>
          <button
            onClick={() => setOwnerFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              ownerFilter === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Todos ({properties.length})
          </button>
          {ownerOptions.map(({ name: o }) => {
            const count = properties.filter((p) => (p.owner || 'Gabriel') === o).length
            return (
              <button
                key={o}
                onClick={() => setOwnerFilter(o)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  ownerFilter === o
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>👤 {o}</span>
                <span className="opacity-75">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-800/60 rounded-xl max-w-fit">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Todos ({properties.length})
          </button>
          <button
            onClick={() => setStatusFilter('rented')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'rented'
                ? 'bg-slate-950 text-emerald-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Alquilados ({metrics.rentedCount})
          </button>
          <button
            onClick={() => setStatusFilter('vacant')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'vacant'
                ? 'bg-slate-950 text-amber-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Vacíos ({metrics.vacantCount})
          </button>
          <button
            onClick={() => setStatusFilter('owner-use')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'owner-use'
                ? 'bg-slate-950 text-teal-200 shadow-xs'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Uso propio
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, calle o inquilino…"
            className="w-full sm:w-72 px-3.5 py-2 pl-9 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
    </div>

      {/* Property Cards Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Cargando inmuebles de Firestore…</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl border border-dashed border-slate-700 p-12 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 text-teal-300 text-2xl flex items-center justify-center mx-auto mb-4">
            🏢
          </div>
          <h3 className="text-base font-bold text-slate-100">
            {properties.length === 0 ? 'No hay inmuebles registrados aún' : 'No hay resultados'}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
            {properties.length === 0
              ? 'Añade tu primer piso, local o garaje para llevar el control de alquileres, gastos y contratos.'
              : 'Prueba a cambiar el filtro o el término de búsqueda.'}
          </p>
          {properties.length === 0 && (
            <button
              onClick={handleOpenAddModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              + Añadir Primer Inmueble
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map((prop) => (
            <div
              key={prop.id}
              role="link"
              tabIndex={0}
              aria-label={`Abrir ${prop.name}`}
              onClick={() => navigate(`/inmuebles/${propertySlug(prop, properties)}`)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/inmuebles/${propertySlug(prop, properties)}`) } }}
              className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xs transition-all hover:border-slate-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {/* Card Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{TYPE_ICONS[prop.type] || '🏠'}</span>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-slate-100 truncate" title={prop.name}>
                        {prop.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">
                        {TYPE_LABELS[prop.type] || 'Inmueble'} · {prop.city} ({prop.province})
                      </p>
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-teal-200 text-[10px] font-bold border border-slate-700">
                          👤 {prop.owner || 'Gabriel'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      prop.status === 'rented'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : prop.status === 'vacant'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                        : 'bg-slate-800 text-teal-200 border-slate-700'
                    }`}
                  >
                    {prop.status === 'rented'
                      ? 'Alquilado'
                      : prop.status === 'vacant'
                      ? 'Vacío'
                      : 'Uso propio'}
                  </span>
                </div>

                {prop.address && (
                  <p className="text-xs text-slate-500 mt-2.5 flex items-center gap-1.5 truncate">
                    <span>📍</span>
                    <span className="truncate">{prop.address}</span>
                  </p>
                )}
              </div>

              {/* Financial & Tenant Details */}
              <div className="px-5 py-3.5 bg-slate-950/50 border-y border-slate-800 space-y-2">
                {prop.status === 'rented' ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500">Renta mensual:</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {money.formatEuro(rentAmountForMonth(prop, currentYear, currentMonth))}/mes
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Renta mensual:</span>
                    <span className="text-xs italic text-slate-400">Sin alquiler activo</span>
                  </div>
                )}

                {(() => {
                  const paymentStatus = paymentStatusByProperty.get(prop.id)
                  if (paymentStatus?.arrearsCount) return <div className="mt-2 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-200"><strong>⚠ ATRASOS · {paymentStatus.arrearsCount} mes(es)</strong><span className="ml-2">{money.formatEuro(paymentStatus.arrearsAmount)} pendiente</span></div>
                  if (prop.status !== 'rented') return null
                  if (paymentStatus && !paymentStatus.currentApplicable) return <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">Alquiler no iniciado hasta {prop.rentStartMonth}</div>
                  if (paymentStatus?.currentPaid) return <div className="mt-2 rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">✓ Cobro de este mes registrado: {money.formatEuro(paymentStatus.collected)}</div>
                  if ((paymentStatus?.collected ?? 0) > 0) return <div className="mt-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-200">◒ Cobro parcial este mes: {money.formatEuro(paymentStatus?.collected)} · faltan {money.formatEuro(Math.max(0, rentAmountForMonth(prop, currentYear, currentMonth) - (paymentStatus?.collected ?? 0)))}</div>
                  return <div className="mt-2 rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">◷ Cobro de {currentMonthLabel} pendiente · mes en curso</div>
                })()}

                {tenantNamesFor(prop).length > 0 && prop.status === 'rented' && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/70">
                    <span className="text-slate-500">Inquilino:</span>
                    <span className="font-medium text-slate-200 truncate ml-2">
                      {tenantNamesFor(prop).join(', ')}
                    </span>
                  </div>
                )}

                {(recurringAverageByProperty.get(prop.id) ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">Gastos periódicos:</span>
                    <span className="font-medium text-slate-400">
                      {money.formatEuro(recurringAverageByProperty.get(prop.id) ?? 0)}/mes
                    </span>
                  </div>
                )}

                {prop.currentValue !== undefined && prop.currentValue > 0 && (
                  <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-800/70">
                    <span className="text-slate-400">Valor tasación:</span>
                    <span className="font-medium text-slate-300">
                      {money.formatEuro(prop.currentValue)}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-3.5 px-5 flex items-center justify-between bg-slate-950/60 border-t border-slate-800">
                <span className="text-[11px] text-slate-500 font-mono">
                  {prop.cadastralReference ? `Ref: ${prop.cadastralReference.slice(0, 8)}…` : ''}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(event) => { event.stopPropagation(); handleOpenEditModal(prop) }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(event) => { event.stopPropagation(); setPropertyToDelete(prop) }}
                    title="Eliminar inmueble"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/50 transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      </> : overview === 'rentals' ? <RentPaymentsOverview properties={properties} /> : overview === 'expenses' ? <PropertyExpensesOverview properties={properties} /> : <TenantsPage embedded />}

      {/* Property Modal (Create / Edit) */}
      <PropertyModal
        isOpen={isModalOpen}
        propertyToEdit={editingProperty}
        owners={ownerOptions.map((owner) => owner.name)}
        defaultOwner={defaultOwner}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {}}
      />

      {/* Safe Delete Confirmation Modal (Protección "a prueba de fallos") */}
      <ConfirmModal
        isOpen={propertyToDelete !== null}
        title="¿Eliminar este inmueble?"
        message={`Esta acción borrará definitivamente "${propertyToDelete?.name}".`}
        confirmWord="BORRAR"
        confirmButtonText="Eliminar Inmueble"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setPropertyToDelete(null)}
      />
    </div>
  )
}
