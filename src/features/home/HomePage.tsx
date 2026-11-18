import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AssetItem, Contract, Expense, Property, RecurringExpenseOccurrence, RecurringExpenseSchedule, RentPayment } from '@/types'
import { subscribeToProperties } from '@/features/properties/propertiesService'
import { subscribeToAllYearPayments } from '@/features/properties/paymentsService'
import { subscribeToYearExpenses } from '@/features/properties/expensesService'
import { subscribeToAllRecurringExpenseOccurrences, subscribeToAllRecurringExpenseSchedules } from '@/features/properties/recurringExpensesService'
import { subscribeToAllContracts } from '@/features/properties/contractsService'
import { buildPropertyReminders } from '@/features/properties/propertyReminders'
import { isRentApplicableForMonth, rentAmountForMonth } from '@/features/properties/rentRates'
import { isScheduleDueInMonth, occurrenceIdFor, recurringMonthlyAverage } from '@/features/properties/recurringExpensesLogic'
import { subscribeToAssets } from '@/features/collections/assetsService'
import { COLLECTIONS, categoryCollection, getCategoryInfo, matchesCollection } from '@/features/collections/assetCategories'
import { assetValue } from '@/features/collections/numismaticaUi'
import { buildAssetSlugIndex } from '@/utils/slugs'
import PrivateStorageImage from '@/components/ui/PrivateStorageImage'
import { useMoney } from '@/features/privacy/money'
import { usePrivacy } from '@/features/privacy/PrivacyProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { downloadAssetsCsv, downloadFiscalYearCsv, downloadFullBackup } from '@/features/backup/backupService'
import { BACKUP_REMINDER_DAYS, backupStatus, readLastBackupAt } from '@/features/backup/backupReminder'

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const RECENT_ASSET_COUNT = 8

interface DayMark {
  /** Cobros de alquiler registrados ese día. */
  collected: number
  /** Gastos (puntuales o periódicos) pendientes de pagar ese día. */
  pendingExpenses: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export default function HomePage() {
  const navigate = useNavigate()
  const money = useMoney()
  const { incognito } = usePrivacy()
  const toast = useToast()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthLabel = MONTHS_LONG[month - 1]

  const [properties, setProperties] = useState<Property[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [payments, setPayments] = useState<RentPayment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [schedules, setSchedules] = useState<RecurringExpenseSchedule[]>([])
  const [occurrences, setOccurrences] = useState<RecurringExpenseOccurrence[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [propertiesReady, setPropertiesReady] = useState(false)
  const [assetsReady, setAssetsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupBusy, setBackupBusy] = useState<'json' | 'fiscal' | 'assets' | null>(null)
  const [fiscalYear, setFiscalYear] = useState(year)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => readLastBackupAt())

  const loading = !propertiesReady || !assetsReady
  const backup = backupStatus(lastBackupAt, now)

  // Aviso al entrar en Inicio, una vez por sesión del navegador.
  useEffect(() => {
    if (!backup.isDue) return
    try {
      if (window.sessionStorage.getItem('legacy-manager:aviso-copia') === '1') return
      window.sessionStorage.setItem('legacy-manager:aviso-copia', '1')
    } catch {
      // Sin sessionStorage se avisa en cada visita a Inicio; no es grave.
    }
    toast.showToast(
      backup.lastBackupAt
        ? `Han pasado ${backup.daysSince} días desde tu última copia de seguridad. Conviene renovarla (cada ${BACKUP_REMINDER_DAYS} días).`
        : `Aún no has descargado ninguna copia de seguridad. Hazlo desde el panel de Inicio; te avisaré cada ${BACKUP_REMINDER_DAYS} días.`,
      { kind: 'info', duration: 9000 },
    )
  }, [backup.isDue, backup.daysSince, backup.lastBackupAt, toast])

  useEffect(() => subscribeToProperties(
    (items) => { setProperties(items); setPropertiesReady(true) },
    (loadError) => { setError(loadError.message); setPropertiesReady(true) },
  ), [])
  useEffect(() => subscribeToAssets(
    (items) => { setAssets(items); setAssetsReady(true) },
    (loadError) => { setError(loadError.message); setAssetsReady(true) },
  ), [])
  useEffect(() => subscribeToAllYearPayments(year, setPayments, (loadError) => setError(loadError.message)), [year])
  useEffect(() => subscribeToYearExpenses(year, setExpenses, (loadError) => setError(loadError.message)), [year])
  useEffect(() => subscribeToAllRecurringExpenseSchedules(setSchedules, (loadError) => setError(loadError.message)), [])
  useEffect(() => subscribeToAllRecurringExpenseOccurrences(year, setOccurrences, (loadError) => setError(loadError.message)), [year])
  useEffect(() => subscribeToAllContracts(setContracts, (loadError) => setError(loadError.message)), [])

  const reminders = useMemo(
    () => buildPropertyReminders({ properties, contracts }),
    [properties, contracts],
  )

  const paymentByPropertyMonth = useMemo(
    () => new Map(payments.map((payment) => [`${payment.propertyId}_${payment.month}`, payment])),
    [payments],
  )
  const occurrenceById = useMemo(
    () => new Map(occurrences.map((item) => [item.id, item])),
    [occurrences],
  )

  /** Alquileres del mes en curso, con lo cobrado de cada inmueble. */
  const monthRentals = useMemo(() => properties.filter((property) => isRentApplicableForMonth(property, year, month)).map((property) => {
    const due = rentAmountForMonth(property, year, month)
    const payment = paymentByPropertyMonth.get(`${property.id}_${month}`)
    const received = payment?.receivedAmount ?? (payment?.isPaid ? payment.amount : 0)
    return { property, due, received, paidAt: payment?.paidAt }
  }), [properties, paymentByPropertyMonth, year, month])

  const pendingRentals = monthRentals.filter((rental) => rental.received < rental.due)
  const collectedCount = monthRentals.length - pendingRentals.length
  const totalExpected = monthRentals.reduce((total, rental) => total + rental.due, 0)
  const totalCollected = monthRentals.reduce((total, rental) => total + rental.received, 0)
  const allRentsPaid = monthRentals.length > 0 && pendingRentals.length === 0

  /** Atrasos acumulados de los meses anteriores del año. */
  const arrears = useMemo(() => {
    let count = 0
    let amount = 0
    for (let index = 1; index < month; index++) {
      properties.forEach((property) => {
        if (!isRentApplicableForMonth(property, year, index)) return
        const due = rentAmountForMonth(property, year, index)
        const payment = paymentByPropertyMonth.get(`${property.id}_${index}`)
        const received = payment?.receivedAmount ?? (payment?.isPaid ? payment.amount : 0)
        if (received < due) {
          count += 1
          amount += due - received
        }
      })
    }
    return { count, amount }
  }, [properties, paymentByPropertyMonth, year, month])

  /** Gastos del mes: puntuales + periódicos con su ocurrencia. */
  const monthOneOffExpenses = useMemo(() => expenses.filter((expense) => expense.month === month), [expenses, month])
  const monthRecurring = useMemo(() => schedules
    .filter((schedule) => isScheduleDueInMonth(schedule, year, month))
    .map((schedule) => {
      const occurrence = occurrenceById.get(occurrenceIdFor(schedule.id, year, month))
      return {
        schedule,
        amount: occurrence?.amount ?? schedule.amount,
        isPaid: occurrence?.isPaid === true,
        day: Number.parseInt(schedule.startDate.slice(8, 10), 10) || 1,
      }
    }), [schedules, occurrenceById, year, month])

  const unpaidOneOff = monthOneOffExpenses.filter((expense) => !expense.isPaid)
  const unpaidRecurring = monthRecurring.filter((item) => !item.isPaid)
  const unpaidExpenseCount = unpaidOneOff.length + unpaidRecurring.length
  const unpaidExpenseAmount = unpaidOneOff.reduce((total, expense) => total + expense.amount, 0)
    + unpaidRecurring.reduce((total, item) => total + item.amount, 0)
  const missingInvoices = monthOneOffExpenses.filter((expense) => expense.invoiceNumber && !expense.invoiceReceived).length

  /** Marcas del calendario: cobros con fecha y gastos pendientes por día. */
  const dayMarks = useMemo(() => {
    const marks = new Map<number, DayMark>()
    const bump = (day: number, patch: (mark: DayMark) => void) => {
      const mark = marks.get(day) ?? { collected: 0, pendingExpenses: 0 }
      patch(mark)
      marks.set(day, mark)
    }
    payments.forEach((payment) => {
      const received = payment.receivedAmount ?? (payment.isPaid ? payment.amount : 0)
      if (received <= 0 || !payment.paidAt) return
      if (payment.paidAt.slice(0, 7) !== `${year}-${pad2(month)}`) return
      const day = Number.parseInt(payment.paidAt.slice(8, 10), 10)
      if (Number.isFinite(day) && day >= 1 && day <= 31) bump(day, (mark) => { mark.collected += 1 })
    })
    monthOneOffExpenses.forEach((expense) => {
      const day = Number.parseInt(expense.date.slice(8, 10), 10)
      if (!Number.isFinite(day)) return
      if (expense.isPaid) return
      bump(day, (mark) => { mark.pendingExpenses += 1 })
    })
    monthRecurring.forEach((item) => {
      if (item.isPaid) return
      bump(item.day, (mark) => { mark.pendingExpenses += 1 })
    })
    return marks
  }, [payments, monthOneOffExpenses, monthRecurring, year, month])

  /** Cobros vs gastos de cada mes transcurrido del año. */
  const chartData = useMemo(() => Array.from({ length: month }, (_, index) => index + 1).map((chartMonth) => {
    const collected = payments
      .filter((payment) => payment.month === chartMonth)
      .reduce((total, payment) => total + (payment.receivedAmount ?? (payment.isPaid ? payment.amount : 0)), 0)
    const oneOff = expenses
      .filter((expense) => expense.month === chartMonth)
      .reduce((total, expense) => total + expense.amount, 0)
    const recurring = schedules
      .filter((schedule) => isScheduleDueInMonth(schedule, year, chartMonth))
      .reduce((total, schedule) => total + (occurrenceById.get(occurrenceIdFor(schedule.id, year, chartMonth))?.amount ?? schedule.amount), 0)
    return { month: chartMonth, collected, expenses: oneOff + recurring }
  }), [payments, expenses, schedules, occurrenceById, year, month])

  const chartMax = Math.max(1, ...chartData.map((point) => Math.max(point.collected, point.expenses)))
  const yearCollected = chartData.reduce((total, point) => total + point.collected, 0)
  const yearExpenses = chartData.reduce((total, point) => total + point.expenses, 0)

  /** Bienes: últimos añadidos y valoración por colección. */
  const recentAssets = useMemo(() => assets.slice(0, RECENT_ASSET_COUNT), [assets])
  const slugIndex = useMemo(() => buildAssetSlugIndex(assets), [assets])
  const totalAssetsValue = useMemo(() => assets.reduce((total, asset) => total + assetValue(asset), 0), [assets])
  const collectionStats = useMemo(() => COLLECTIONS
    .filter((collection) => collection.key !== 'todos')
    .map((collection) => {
      const items = assets.filter((asset) => matchesCollection(asset.category, collection.key))
      return { ...collection, count: items.length, value: items.reduce((total, asset) => total + assetValue(asset), 0) }
    }), [assets])

  const rentedCount = properties.filter((property) => property.status === 'rented').length
  const vacantCount = properties.filter((property) => property.status === 'vacant').length
  const ownerUseCount = properties.length - rentedCount - vacantCount
  // Gastos fijos reales: media mensual de los gastos periódicos activos.
  const fixedExpensesMonthly = recurringMonthlyAverage(schedules, now)
  const netMonthly = totalExpected - fixedExpensesMonthly

  const openAsset = (asset: AssetItem) => {
    const slug = slugIndex.slugById.get(asset.id)
    if (!slug) {
      navigate('/bienes')
      return
    }
    navigate(`/bienes/categoria/${categoryCollection(asset.category)}/${slug}`)
  }

  const handleBackup = async (kind: 'json' | 'fiscal' | 'assets') => {
    try {
      setBackupBusy(kind)
      if (kind === 'json') {
        const { documents } = await downloadFullBackup()
        setLastBackupAt(readLastBackupAt())
        toast.showToast(`Copia de seguridad descargada: ${documents} documento(s) en JSON.`, { kind: 'success' })
      } else if (kind === 'fiscal') {
        const result = await downloadFiscalYearCsv(fiscalYear)
        toast.showToast(`Resumen fiscal ${fiscalYear} descargado (${result.properties} inmueble(s)).`, { kind: 'success' })
      } else {
        downloadAssetsCsv(assets)
        toast.showToast(`Inventario descargado: ${assets.length} pieza(s) en CSV.`, { kind: 'success' })
      }
    } catch (backupError) {
      toast.showToast(`No se pudo generar el archivo: ${backupError instanceof Error ? backupError.message : 'Error desconocido'}`, { kind: 'error' })
    } finally {
      setBackupBusy(null)
    }
  }

  const todayLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const capitalizedToday = todayLabel.charAt(0).toLocaleUpperCase('es') + todayLabel.slice(1)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const todayDay = month === now.getMonth() + 1 ? now.getDate() : -1
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
        <p className="text-sm text-slate-500">Cargando el panel…</p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Panel del patrimonio</h2>
          <p className="mt-0.5 text-sm capitalize text-slate-500">{capitalizedToday}</p>
        </div>
        {incognito && (
          <span className="self-start rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
            🙈 Modo incógnito activo
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-200">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">No se pudieron cargar todos los datos:</p>
            <p className="mt-1 font-mono text-[11px] text-amber-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Resumen de los dos módulos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/inmuebles')}
          className="group rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left transition hover:border-teal-500 hover:bg-slate-900/80"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">🏠 Inmuebles</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">{properties.length} <span className="text-base font-medium text-slate-400">inmueble(s)</span></p>
          <p className="mt-1 text-xs text-slate-400">{rentedCount} alquilados · {vacantCount} vacíos{ownerUseCount > 0 ? ` · ${ownerUseCount} uso propio` : ''}</p>
          <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
            Renta esperada este mes: <span className="font-semibold text-emerald-400">{money.formatEuro(totalExpected)}</span>
            <span className="mx-1.5 text-slate-700">·</span>
            Flujo neto aprox.: <span className={`font-semibold ${netMonthly >= 0 ? 'text-teal-300' : 'text-red-400'}`}>{money.formatEuro(netMonthly)}</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/bienes')}
          className="group rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left transition hover:border-teal-500 hover:bg-slate-900/80"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">🪙 Bienes y Activos</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">{assets.length} <span className="text-base font-medium text-slate-400">pieza(s)</span></p>
          <p className="mt-1 text-xs text-slate-400">{collectionStats.filter((collection) => collection.count > 0).length} colección(es) con piezas</p>
          <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
            Valoración total: <span className="font-semibold text-emerald-400">{money.formatEuro(totalAssetsValue)}</span>
          </p>
        </button>
      </div>

      {/* Avisos: contratos que vencen y revisiones de renta */}
      {reminders.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-100">⏰ Avisos</h3>
            <span className="text-xs text-slate-500">Contratos y revisiones de los próximos 60 días</span>
          </div>
          <ul className="mt-4 space-y-2">
            {reminders.map((reminder) => (
              <li key={reminder.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/inmuebles/${reminder.propertyId}`)}
                  className={`flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                    reminder.overdue
                      ? 'border-red-900 bg-red-950/40 hover:bg-red-950/60'
                      : 'border-amber-800 bg-amber-950/30 hover:bg-amber-950/50'
                  }`}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="text-lg" aria-hidden="true">{reminder.overdue ? '⚠️' : '⏰'}</span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${reminder.overdue ? 'text-red-200' : 'text-amber-100'}`}>{reminder.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{reminder.detail}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 text-[11px] font-semibold ${reminder.overdue ? 'text-red-300' : 'text-amber-300'}`}>
                    {reminder.daysLeft === 0
                      ? 'Hoy'
                      : reminder.overdue
                        ? `Hace ${Math.abs(reminder.daysLeft)} día${Math.abs(reminder.daysLeft) === 1 ? '' : 's'}`
                        : `En ${reminder.daysLeft} día${reminder.daysLeft === 1 ? '' : 's'}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Inmuebles: calendario y anotaciones del mes */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-100">Alquileres y gastos · <span className="capitalize">{monthLabel} {year}</span></h3>
          <Link to="/inmuebles/alquileres" className="text-xs font-semibold text-teal-300 hover:text-teal-200">Control de alquileres →</Link>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_INITIALS.map((initial) => (
                <span key={initial} className="py-1 text-[10px] font-bold uppercase text-slate-600">{initial}</span>
              ))}
              {calendarCells.map((day, index) => {
                if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />
                const mark = dayMarks.get(day)
                const isToday = day === todayDay
                return (
                  <div
                    key={day}
                    title={mark
                      ? `Día ${day}: ${mark.collected} cobro(s) registrado(s) · ${mark.pendingExpenses} gasto(s) pendiente(s)`
                      : `Día ${day}`}
                    className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs ${
                      isToday ? 'border-teal-500 bg-teal-950/30 text-teal-200' : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                  >
                    <span className={isToday ? 'font-bold' : ''}>{day}</span>
                    {(mark?.collected || mark?.pendingExpenses) ? (
                      <span className="flex items-center gap-1">
                        {Boolean(mark?.collected) && (
                          <span className="rounded-full bg-emerald-500/20 px-1.5 text-[9px] font-bold text-emerald-300">+{mark?.collected}</span>
                        )}
                        {Boolean(mark?.pendingExpenses) && (
                          <span className="rounded-full bg-red-500/20 px-1.5 text-[9px] font-bold text-red-300">{mark?.pendingExpenses}</span>
                        )}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Cobro registrado</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Gasto sin pagar</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400 ring-2 ring-teal-500/40" /> Hoy</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className={`rounded-xl border p-3.5 ${allRentsPaid ? 'border-emerald-800 bg-emerald-950/40' : monthRentals.length === 0 ? 'border-slate-800 bg-slate-950/40' : 'border-amber-800 bg-amber-950/30'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Alquileres de {monthLabel}</p>
              {monthRentals.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">Sin rentas previstas este mes.</p>
              ) : allRentsPaid ? (
                <p className="mt-1 text-sm font-semibold text-emerald-300">✓ Todos los alquileres cobrados este mes ({collectedCount}/{monthRentals.length}) · {money.formatEuro(totalCollected)}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-200">
                    Cobrados <strong className="text-slate-100">{collectedCount}/{monthRentals.length}</strong>
                    <span className="mx-1.5 text-slate-600">·</span>
                    {money.formatEuro(totalCollected)} de {money.formatEuro(totalExpected)}
                  </p>
                  <p className="mt-1 text-xs text-amber-300">
                    Pendientes: {pendingRentals.slice(0, 3).map((rental) => rental.property.name).join(', ')}
                    {pendingRentals.length > 3 ? ` y ${pendingRentals.length - 3} más` : ''}
                  </p>
                </>
              )}
            </div>

            <div className={`rounded-xl border p-3.5 ${unpaidExpenseCount === 0 ? 'border-emerald-800 bg-emerald-950/40' : 'border-amber-800 bg-amber-950/30'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gastos de {monthLabel}</p>
              {unpaidExpenseCount === 0 ? (
                <p className="mt-1 text-sm font-semibold text-emerald-300">✓ Todos los gastos del mes están pagados</p>
              ) : (
                <p className="mt-1 text-sm text-slate-200">
                  ⚠ <strong className="text-amber-200">{unpaidExpenseCount}</strong> gasto(s) sin pagar
                  <span className="mx-1.5 text-slate-600">·</span>
                  {money.formatEuro(unpaidExpenseAmount)}
                  <span className="ml-1.5 text-xs text-slate-500">({unpaidOneOff.length} puntual(es), {unpaidRecurring.length} periódico(s))</span>
                </p>
              )}
              {missingInvoices > 0 && (
                <p className="mt-1 text-xs text-slate-400">Facturas sin recibir: {missingInvoices}</p>
              )}
            </div>

            <div className={`rounded-xl border p-3.5 ${arrears.count > 0 ? 'border-red-900 bg-red-950/40' : 'border-slate-800 bg-slate-950/40'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Atrasos de meses anteriores</p>
              <p className={`mt-1 text-sm ${arrears.count > 0 ? 'font-semibold text-red-300' : 'text-slate-400'}`}>
                {arrears.count > 0
                  ? `⚠ ${arrears.count} mensualidad(es) pendientes · ${money.formatEuro(arrears.amount)}`
                  : '✓ Sin atrasos registrados este año'}
              </p>
            </div>
          </div>
        </div>

        {/* Gráfica del año: cobros vs gastos */}
        <div className="mt-5 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-200">Cobros y gastos por mes · {year}</h4>
            <p className="text-xs text-slate-400">
              Cobrado: <span className="font-semibold text-emerald-400">{money.formatEuro(yearCollected)}</span>
              <span className="mx-1.5 text-slate-700">·</span>
              Gastos: <span className="font-semibold text-amber-300">{money.formatEuro(yearExpenses)}</span>
            </p>
          </div>
          {incognito ? (
            <p className="py-7 text-center text-xs text-slate-500">🙈 Gráfica oculta mientras el modo incógnito está activo.</p>
          ) : (
            <>
              <div className="mt-3 flex h-24 items-end gap-1.5">
                {chartData.map((point) => (
                  <div
                    key={point.month}
                    className="flex h-full flex-1 items-end justify-center gap-0.5"
                    title={`${MONTHS_LONG[point.month - 1]}: ${money.formatEuro(point.collected)} cobrado · ${money.formatEuro(point.expenses)} en gastos`}
                  >
                    <div style={{ height: `${Math.max(3, (point.collected / chartMax) * 100)}%` }} className="w-2.5 rounded-t bg-emerald-500/70" />
                    <div style={{ height: `${Math.max(3, (point.expenses / chartMax) * 100)}%` }} className="w-2.5 rounded-t bg-amber-500/60" />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1.5">
                {chartData.map((point) => (
                  <span key={point.month} className="flex-1 text-center text-[9px] text-slate-500">{MONTHS_SHORT[point.month - 1]}</span>
                ))}
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500/70" /> Cobros</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500/60" /> Gastos</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Bienes: últimos añadidos y valoración por colección */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-100">Últimos bienes añadidos</h3>
          <Link to="/bienes" className="text-xs font-semibold text-teal-300 hover:text-teal-200">Ver todas las colecciones →</Link>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            {recentAssets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center text-sm text-slate-500">
                Todavía no hay bienes registrados.
                <Link to="/bienes" className="ml-2 font-semibold text-teal-300 hover:text-teal-200">Añadir el primero →</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                {recentAssets.map((asset) => {
                  const category = getCategoryInfo(asset.category)
                  const photo = asset.photos?.[0]
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => openAsset(asset)}
                      title={`Ver ${asset.name}`}
                      className="group text-left"
                    >
                      <div className="aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition group-hover:border-teal-600">
                        {photo
                          ? <PrivateStorageImage source={photo} alt={asset.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                          : <div className="flex h-full w-full items-center justify-center text-3xl text-slate-700">{category.icon}</div>}
                      </div>
                      <p className="mt-1.5 truncate text-[11px] font-medium text-slate-300 group-hover:text-teal-200">
                        <span className="mr-1" aria-hidden="true">{category.icon}</span>{asset.name}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valoración por colección</h4>
            {collectionStats.map((collection) => {
              const share = totalAssetsValue > 0 ? (collection.value / totalAssetsValue) * 100 : 0
              return (
                <div key={collection.key} className="flex items-center gap-2 text-xs">
                  <span aria-hidden="true">{collection.icon}</span>
                  <span className="w-36 truncate text-slate-300" title={collection.label}>{collection.label}</span>
                  {!incognito && (
                    <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
                      <span className="block h-full rounded bg-teal-500/70" style={{ width: `${share}%` }} />
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-slate-500">{collection.count}</span>
                  <span className="shrink-0 font-semibold text-emerald-400">{money.formatEuro(collection.value)}</span>
                </div>
              )
            })}
            <p className="border-t border-slate-800 pt-2.5 text-[10px] text-slate-500">Piezas por colección y valoración ({incognito ? 'oculta' : 'proporción sobre el total'}).</p>
          </div>
        </div>
      </section>

      {/* Copia de seguridad y exportaciones */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-base font-bold text-slate-100">💾 Copia de seguridad y exportaciones</h3>
        <p className="mt-1 text-xs text-slate-400">
          Los archivos se generan en tu dispositivo con una lectura puntual de Firestore; no se suben a ningún servicio.
          Incluyen las cifras reales aunque el modo incógnito esté activo. El plan gratuito de Firebase no hace copias
          automáticas: guarda la copia JSON cada {BACKUP_REMINDER_DAYS} días.
        </p>

        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${backup.isDue ? 'border-amber-800 bg-amber-950/40 text-amber-200' : 'border-slate-800 bg-slate-950/60 text-slate-400'}`}>
          {backup.lastBackupAt === null
            ? 'Aún no has descargado ninguna copia completa en este navegador. Hazlo ahora y te recordaré renovarla cada 60 días.'
            : backup.isDue
              ? `Han pasado ${backup.daysSince} días desde tu última copia completa. Toca renovarla (recordatorio cada ${BACKUP_REMINDER_DAYS} días).`
              : `Última copia completa: hace ${backup.daysSince} ${backup.daysSince === 1 ? 'día' : 'días'}. Próximo recordatorio en ${backup.daysUntilReminder} ${backup.daysUntilReminder === 1 ? 'día' : 'días'}.`}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => void handleBackup('json')}
            disabled={backupBusy !== null}
            className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-teal-600 disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-slate-100">
              {backupBusy === 'json' ? 'Generando copia…' : 'Copia completa (JSON)'}
            </p>
            <p className="mt-1 text-xs text-slate-400">Inmuebles, alquileres, gastos, inquilinos, contratos y bienes, tal cual están en Firestore.</p>
          </button>

          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">Resumen fiscal (CSV)</p>
              <select
                value={fiscalYear}
                onChange={(event) => setFiscalYear(Number(event.target.value))}
                aria-label="Año fiscal"
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                {[year - 2, year - 1, year].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-400">Por inmueble: renta cobrada y gastos deducibles por categoría, como la pestaña fiscal.</p>
            <button
              type="button"
              onClick={() => void handleBackup('fiscal')}
              disabled={backupBusy !== null}
              className="mt-3 w-full rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {backupBusy === 'fiscal' ? 'Generando…' : `Descargar fiscal ${fiscalYear}`}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleBackup('assets')}
            disabled={backupBusy !== null || assets.length === 0}
            className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-teal-600 disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-slate-100">
              {backupBusy === 'assets' ? 'Generando inventario…' : 'Inventario de bienes (CSV)'}
            </p>
            <p className="mt-1 text-xs text-slate-400">Todas las piezas con colección, año, material, ubicación, inventario y valores.</p>
          </button>
        </div>
      </section>
    </div>
  )
}
