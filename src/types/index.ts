// ─── Shared base ────────────────────────────────────────────────────────────

export interface TimestampedDoc {
  id: string
  createdAt?: any
  updatedAt?: any
}

// ─── Auth & Ownership ───────────────────────────────────────────────────────

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export type AssetOwner = string

// ─── Properties module (Inmuebles) ──────────────────────────────────────────

export type PropertyType = 'apartment' | 'commercial' | 'storage' | 'garage' | 'house' | 'rural'
export type PropertyStatus = 'rented' | 'vacant' | 'owner-use'

export interface Property extends TimestampedDoc {
  name: string                  // e.g. "Piso Triana 2ºB"
  owner: AssetOwner             // Free-text family owner name
  type: PropertyType
  status: PropertyStatus
  address: string
  city: string
  province: string              // Andalucía provinces
  postalCode?: string
  cadastralReference?: string
  monthlyRent?: number          // Renta mensual pactada (EUR)
  rentRequiresInvoice?: boolean
  rentHistory?: RentRate[]      // Rate changes by effective month; independent of contract history.
  tenantName?: string           // Inquilino actual
  tenantPhone?: string          // Teléfono de contacto
  tenantEmail?: string
  tenantNif?: string
  depositAmount?: number        // Fianza depositada (EUR)
  avraReference?: string        // Ref. resguardo fianza AVRA (Junta de Andalucía)
  fixedExpensesMonthly?: number // Gastos fijos mensuales (comunidad, IBI/12)
  currentValue?: number         // Valor de mercado estimado (EUR)
  notes?: string
}

export interface RentRate {
  effectiveFrom: string         // YYYY-MM, inclusive
  amount: number                // EUR per month
}

export interface Contract extends TimestampedDoc {
  propertyId: string
  tenantName: string
  tenantPhone?: string
  tenantEmail?: string
  tenantNif?: string            // DNI/NIE
  startDate: string             // YYYY-MM-DD
  endDate?: string              // YYYY-MM-DD (vacío si indefinido)
  monthlyRent: number           // EUR
  depositAmount?: number        // EUR
  avraReference?: string        // Ref. fianza AVRA
  isActive: boolean
  isDeleted?: boolean
  notes?: string
}

export interface ContractAddendum extends TimestampedDoc {
  propertyId: string
  contractId: string
  title: string
  date: string                 // YYYY-MM-DD
  notes?: string
  rentChange?: number
  rentEffectiveFrom?: string   // YYYY-MM
}

export type ContractFileKind = 'contract' | 'addendum'

export interface ContractFileVersion extends TimestampedDoc {
  propertyId: string
  contractId: string
  documentKind: ContractFileKind
  addendumId?: string
  fileName: string
  sizeBytes: number
}

export interface RentPayment extends TimestampedDoc {
  propertyId: string
  year: number
  month: number                 // 1-12
  amount: number                // EUR
  isPaid: boolean
  paidAt?: string               // YYYY-MM-DD
  invoiceIssued: boolean        // Si se emitió recibo / factura
  notes?: string                // Anotación puntual del mes
  updatedBy?: string            // Nombre del usuario que modificó
}

export type ExpenseCategory =
  | 'comunidad'         // Cuotas ordinarias o extraordinarias de comunidad
  | 'ibi'               // IBI y tasas municipales
  | 'basura'            // Tasa de residuos / basura
  | 'seguro'            // Seguro de hogar / impago de alquiler
  | 'reparacion'        // Reparaciones, mantenimiento y conservación
  | 'agua'
  | 'luz'
  | 'gas'
  | 'suministros'       // Legacy category for existing records
  | 'tasa_municipal'
  | 'administracion'    // Honorarios agencia / administración
  | 'otro'              // Otros gastos

export type ExpenseKind = 'one-off' | 'recurring'
export type ExpenseFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'annual'

export interface Expense extends TimestampedDoc {
  propertyId: string
  date: string                  // YYYY-MM-DD
  year: number
  month: number
  category: ExpenseCategory
  kind?: ExpenseKind
  frequency?: ExpenseFrequency
  amount: number                // EUR
  description: string
  invoiceNumber?: string        // Nº de factura o recibo
  invoiceReceived?: boolean
  invoiceReceivedDate?: string  // YYYY-MM-DD
  isPaid?: boolean
  paidAt?: string               // YYYY-MM-DD
  isDeductible?: boolean        // Deducible en IRPF (default true)
  notes?: string
}

export interface RecurringExpenseSchedule extends TimestampedDoc {
  propertyId: string
  category: ExpenseCategory
  description: string
  amount: number
  startDate: string             // YYYY-MM-DD; first month in which this expense is due
  endDate?: string | null       // YYYY-MM-DD; last month due when the schedule is ended
  intervalMonths: number
  requiresInvoice: boolean
  chargeToTenant: boolean
  isDeductible: boolean
  isActive: boolean
  notes?: string
}

export interface RecurringExpenseOccurrence extends TimestampedDoc {
  scheduleId: string
  propertyId: string
  year: number
  month: number
  amount: number                // Snapshot of the schedule amount for this occurrence
  invoiceReceived: boolean
  invoiceReceivedDate?: string
  isPaid: boolean
  paidAt?: string
  tenantInvoiceIssued?: boolean
  tenantInvoiceIssuedDate?: string
  tenantPaid?: boolean
  tenantPaidAt?: string
}

// ─── General Assets module (Bienes y Activos) ──────────────────────────────

export type AssetCategory =
  | 'coins'         // Monedas y billetes de colección
  | 'banknotes'
  | 'watches'       // Relojes
  | 'art'           // Cuadros, esculturas, láminas
  | 'antiques'      // Antigüedades, muebles
  | 'furniture'
  | 'jewelry'       // Joyas
  | 'electronics'   // Televisión, sonido, informática
  | 'computers'
  | 'vehicles'      // Vehículos
  | 'books'
  | 'stamps'
  | 'musical-instruments'
  | 'sports'
  | 'tools'
  | 'documents'
  | 'collectibles'
  | 'other'         // Otros activos

export interface AssetItem extends TimestampedDoc {
  name: string
  owner: AssetOwner             // Free-text family owner name
  category: AssetCategory
  tags?: string[]
  location?: string             // Ubicación (ej. "Salón", "Caja fuerte")
  description?: string
  brandOrAuthor?: string        // Marca o Autor (ej. "Rolex", "LG", "Sorolla")
  year?: number                 // Año de fabricación
  historicalEra?: string
  country?: string
  placeOfOrigin?: string
  ruler?: string
  mint?: string
  denomination?: string
  conservationState?: string    // Como nuevo, Excelente, Buen estado...
  material?: string             // Madera, Acero, Oro, Cuero...
  acquisitionYear?: number
  acquisitionPrice?: number     // EUR
  currentValue?: number         // EUR
  notes?: string
  photos: string[]              // WebP base64 data URLs
}
