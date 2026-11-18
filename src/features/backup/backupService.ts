import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AssetItem, Expense, Property, RecurringExpenseOccurrence, RecurringExpenseSchedule } from '@/types'
import { isRentApplicableForMonth } from '@/features/properties/rentRates'
import { isScheduleDueInMonth, occurrenceIdFor } from '@/features/properties/recurringExpensesLogic'
import { assetValue, locationLabel, yearLabel } from '@/features/collections/numismaticaUi'
import { getCategoryInfo } from '@/features/collections/assetCategories'
import { slugify } from '@/utils/slugs'
import { toCsv } from '@/utils/csv'
import { markBackupDone } from './backupReminder'

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

// El formato CSV (separador «;», coma decimal y BOM) vive en `utils/csv.ts`
// para poder probarlo sin cargar Firebase.

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
  // La copia completa cuenta para el recordatorio de 60 días (solo en este navegador).
  markBackupDone()
  return { documents }
}

/**
 * Resumen fiscal anual en CSV, igual que la vista «Fiscal» de Inmuebles:
 * una fila por inmueble (opcionalmente filtrado por propietario y/o
 * provincia) con ingresos cobrados y gastos deducibles por categoría,
 * puntuales y periódicos (IRPF, rendimiento de capital inmobiliario).
 */
export async function downloadFiscalYearCsv(
  year: number,
  filters: { owner?: string; province?: string } = {},
): Promise<{ properties: number }> {
  const [propertiesSnap, paymentsSnap, expensesSnap, schedulesSnap, occurrencesSnap] = await Promise.all([
    getDocs(collection(db, 'properties')),
    getDocs(query(collection(db, 'rentPayments'), where('year', '==', year))),
    getDocs(query(collection(db, 'expenses'), where('year', '==', year))),
    getDocs(collection(db, 'recurringExpenseSchedules')),
    getDocs(query(collection(db, 'recurringExpenseOccurrences'), where('year', '==', year))),
  ])

  const properties = propertiesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Partial<Property>) }))
    .filter((property) => (
      (!filters.owner || (property.owner ?? 'Gabriel') === filters.owner)
      && (!filters.province || property.province === filters.province)
    ))
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

  downloadFile(`legacy-manager-fiscal-${year}${filters.owner ? `-${slugify(filters.owner)}` : ''}${filters.province ? `-${slugify(filters.province)}` : ''}.csv`, csv, 'text/csv;charset=utf-8')
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
