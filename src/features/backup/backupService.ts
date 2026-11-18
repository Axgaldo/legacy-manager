import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AssetItem, Expense, Property, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { isRentApplicableForMonth } from '@/features/properties/rentRates'
import { isScheduleDueInMonth, occurrenceIdFor } from '@/features/properties/recurringExpensesLogic'
import { assetValue, locationLabel, yearLabel } from '@/features/collections/numismaticaUi'
import { getCategoryInfo } from '@/features/collections/assetCategories'

/**
 * Copias de seguridad y exportaciones: se generan en el dispositivo del
 * usuario (ningún dato se sube a ningún servicio) con lecturas puntuales de
 * Firestore, para no dejar listeners activos.
 */

const BACKUP_COLLECTIONS = [
  'properties',
  'assets',
  'tenants',
  'tenantDocuments',
  'rentPayments',
  'expenses',
  'recurringExpenseSchedules',
  'recurringExpenseOccurrences',
  'contracts',
  'contractAddenda',
  'contractFileVersions',
] as const

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** CSV con separador «;» y BOM, el formato que abre Excel es-ES directamente. */
function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const number = (value: number) => String(value ?? 0).replace('.', ',')
  return '\uFEFF' + [header, ...rows]
    .map((row) => row.map((cell) => typeof cell === 'number' ? number(cell) : escape(cell)).join(';'))
    .join('\n')
}

/** Copia completa en JSON de todas las colecciones de la app. */
export async function downloadFullBackup(): Promise<{ documents: number }> {
  const data: Record<string, unknown[]> = {}
  let documents = 0
  for (const name of BACKUP_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, name))
    data[name] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    documents += snapshot.size
  }
  const payload = {
    app: 'legacy-manager',
    version: __APP_VERSION__,
    generatedAt: new Date().toISOString(),
    collections: data,
  }
  downloadFile(`legacy-manager-copia-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
  return { documents }
}

/**
 * Resumen fiscal anual en CSV, una fila por inmueble, igual que la pestaña
 * «Resumen Fiscal» de cada ficha: ingresos cobrados y gastos deducibles por
 * categoría (IRPF, rendimiento de capital inmobiliario).
 */
export async function downloadFiscalYearCsv(year: number): Promise<{ properties: number }> {
  const [propertiesSnap, paymentsSnap, expensesSnap, schedulesSnap, occurrencesSnap] = await Promise.all([
    getDocs(collection(db, 'properties')),
    getDocs(query(collection(db, 'rentPayments'), where('year', '==', year))),
    getDocs(query(collection(db, 'expenses'), where('year', '==', year))),
    getDocs(collection(db, 'recurringExpenseSchedules')),
    getDocs(query(collection(db, 'recurringExpenseOccurrences'), where('year', '==', year))),
  ])

  const properties = propertiesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Partial<Property>) }))
  const payments = paymentsSnap.docs.map((doc) => doc.data())
  const expenses = expensesSnap.docs.map((doc) => doc.data() as Partial<Expense>)
  const schedules = schedulesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Partial<RecurringExpenseSchedule>) }))
  const occurrenceById = new Map(occurrencesSnap.docs.map((doc) => [doc.id, doc.data() as Partial<RecurringExpenseOccurrence>]))

  const CATEGORIES = ['comunidad', 'ibi', 'seguro', 'reparacion', 'suministros', 'administracion'] as const

  const rows = properties.map((property) => {
    // Igual que la pestaña «Resumen Fiscal»: solo cuentan los cobros de meses
    // en los que el alquiler era aplicable según el histórico de rentas.
    const received = payments
      .filter((payment) => payment.propertyId === property.id && isRentApplicableForMonth(property as Property, year, Number(payment.month)))
      .reduce((total, payment) => total + (payment.receivedAmount ?? (payment.isPaid ? payment.amount : 0)), 0)
    const byCategory = new Map<string, number>()

    // Gastos puntuales deducibles
    expenses
      .filter((expense) => expense.propertyId === property.id && expense.isDeductible)
      .forEach((expense) => {
        const category = CATEGORIES.includes(expense.category as typeof CATEGORIES[number]) ? expense.category! : 'otros'
        byCategory.set(category, (byCategory.get(category) ?? 0) + (expense.amount || 0))
      })

    // Gastos periódicos deducibles: cada vencimiento del año con su
    // ocurrencia real (si existe) o el importe previsto del calendario.
    schedules
      .filter((schedule) => schedule.propertyId === property.id && schedule.isDeductible)
      .forEach((schedule) => {
        for (let month = 1; month <= 12; month++) {
          if (!isScheduleDueInMonth(schedule as RecurringExpenseSchedule, year, month)) continue
          const occurrence = occurrenceById.get(occurrenceIdFor(schedule.id!, year, month))
          const category = CATEGORIES.includes(schedule.category as typeof CATEGORIES[number]) ? schedule.category! : 'otros'
          byCategory.set(category, (byCategory.get(category) ?? 0) + (occurrence?.amount ?? schedule.amount ?? 0))
        }
      })

    const deductible = [...byCategory.values()].reduce((total, value) => total + value, 0)

    return [
      property.name ?? 'Inmueble',
      property.owner ?? 'Gabriel',
      Math.round(received * 100) / 100,
      ...CATEGORIES.map((category) => Math.round((byCategory.get(category) ?? 0) * 100) / 100),
      Math.round((byCategory.get('otros') ?? 0) * 100) / 100,
      Math.round(deductible * 100) / 100,
      Math.round((received - deductible) * 100) / 100,
    ] as Array<string | number>
  })

  const header = [
    'Inmueble', 'Propietario', `Renta cobrada ${year}`,
    'Comunidad', 'IBI/Basura', 'Seguro', 'Reparación', 'Suministros', 'Administración',
    'Otros deducibles', 'Total gastos deducibles', 'Rendimiento neto previo',
  ]

  const columnTotals = header.map((_, columnIndex) => {
    if (columnIndex < 2) return ''
    return rows.reduce((total, row) => total + (Number(row[columnIndex]) || 0), 0)
  })
  const csv = toCsv(header, [...rows, ['TOTAL', '', ...columnTotals.slice(2)] as Array<string | number>])

  downloadFile(`legacy-manager-fiscal-${year}.csv`, csv, 'text/csv;charset=utf-8')
  return { properties: properties.length }
}

/** Inventario completo de bienes en CSV. */
export function downloadAssetsCsv(assets: AssetItem[]): void {
  const rows = assets.map((asset) => ([
    getCategoryInfo(asset.category).label,
    asset.name,
    asset.owner || 'Gabriel',
    yearLabel(asset),
    asset.material || '',
    asset.conservationState || '',
    locationLabel(asset),
    assetValue(asset) || 0,
    asset.purchase_price ?? asset.acquisitionPrice ?? 0,
    asset.inventory_number || asset.case_number || '',
    asset.catalog_reference || '',
  ] as Array<string | number>))

  const csv = toCsv(
    ['Colección', 'Nombre', 'Propietario', 'Año', 'Material', 'Conservación', 'Ubicación / Origen', 'Valor estimado (EUR)', 'Precio de compra (EUR)', 'Nº inventario', 'Código de catálogo'],
    rows,
  )
  downloadFile(`legacy-manager-inventario-${stamp()}.csv`, csv, 'text/csv;charset=utf-8')
}
