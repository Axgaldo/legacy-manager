// Shared base
export interface TimestampedDoc {
  id: string
  createdAt?: any
  updatedAt?: any
}

// Auth & Ownership
export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export type AssetOwner = string

// Properties module (Inmuebles)
export type PropertyType = 'apartment' | 'commercial' | 'storage' | 'garage' | 'house' | 'rural'
export type PropertyStatus = 'rented' | 'vacant' | 'owner-use'

export interface Property extends TimestampedDoc {
  name: string
  owner: AssetOwner
  type: PropertyType
  status: PropertyStatus
  address: string
  city: string
  province: string
  postalCode?: string
  cadastralReference?: string
  monthlyRent?: number
  rentStartMonth?: string
  rentRequiresInvoice?: boolean
  rentHistory?: RentRate[]
  tenants?: PropertyTenant[]
  /** Linked tenant entity ids. Tenants live in the `tenants` collection. */
  tenantIds?: string[]
  /** Set once legacy embedded tenants have been turned into tenant entities. */
  tenantsMigrated?: boolean
  tenantName?: string
  tenantPhone?: string
  tenantEmail?: string
  tenantNif?: string
  depositAmount?: number
  avraReference?: string
  fixedExpensesMonthly?: number
  currentValue?: number
  notes?: string
}

export interface PropertyTenant {
  id: string
  name: string
  phone?: string
  email?: string
  nif?: string
}

// Tenant directory (Inquilinos)
export type TenantDocumentKind =
  | 'dni'
  | 'pasaporte'
  | 'contrato'
  | 'nomina'
  | 'recibo'
  | 'seguro'
  | 'certificado'
  | 'otro'

export interface Tenant extends TimestampedDoc {
  name: string
  nif?: string
  phone?: string
  email?: string
  birthDate?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  iban?: string
  notes?: string
  isActive?: boolean
}

export interface TenantDocument extends TimestampedDoc {
  tenantId: string
  fileName: string
  contentType: string
  sizeBytes: number
  storedSizeBytes?: number
  storagePath: string
  kind: TenantDocumentKind
  label?: string
  uploadedBy?: string
}

export interface RentRate {
  effectiveFrom: string
  amount: number
}

export interface Contract extends TimestampedDoc {
  propertyId: string
  tenantName: string
  tenantPhone?: string
  tenantEmail?: string
  tenantNif?: string
  startDate: string
  endDate?: string
  monthlyRent: number
  depositAmount?: number
  avraReference?: string
  isActive: boolean
  isDeleted?: boolean
  notes?: string
}

export interface ContractAddendum extends TimestampedDoc {
  propertyId: string
  contractId: string
  title: string
  date: string
  notes?: string
  rentChange?: number
  rentEffectiveFrom?: string
}

export type ContractFileKind = 'contract' | 'addendum'

export interface ContractFileVersion extends TimestampedDoc {
  propertyId: string
  contractId: string
  documentKind: ContractFileKind
  addendumId?: string
  fileName: string
  sizeBytes: number
  storedSizeBytes?: number
  storagePath?: string
}

export type RentPaymentManualStatus = 'auto' | 'paid' | 'partial' | 'overdue' | 'overpaid' | 'rent-change'

export interface RentPayment extends TimestampedDoc {
  propertyId: string
  year: number
  month: number
  amount: number
  receivedAmount?: number
  isPaid: boolean
  paidAt?: string
  invoiceIssued: boolean
  invoiceReceivedDate?: string
  notes?: string
  updatedBy?: string
  /** Visual status selected by the user. `auto` keeps the calculated colour. */
  manualStatus?: RentPaymentManualStatus
  /** Whether the "faltan / exceso" warning is displayed for this month. */
  showWarning?: boolean
}

export type ExpenseCategory =
  | 'comunidad'
  | 'ibi'
  | 'basura'
  | 'seguro'
  | 'reparacion'
  | 'agua'
  | 'luz'
  | 'gas'
  | 'suministros'
  | 'tasa_municipal'
  | 'administracion'
  | 'otro'

export type ExpenseKind = 'one-off' | 'recurring'
export type ExpenseFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'annual'

export interface Expense extends TimestampedDoc {
  propertyId: string
  date: string
  year: number
  month: number
  category: ExpenseCategory
  kind?: ExpenseKind
  frequency?: ExpenseFrequency
  amount: number
  description: string
  invoiceNumber?: string
  invoiceReceived?: boolean
  invoiceReceivedDate?: string
  isPaid?: boolean
  paidAt?: string
  isDeductible?: boolean
  notes?: string
}

export interface RecurringExpenseSchedule extends TimestampedDoc {
  propertyId: string
  category: ExpenseCategory
  description: string
  amount: number
  startDate: string
  endDate?: string | null
  intervalMonths: number
  requiresInvoice: boolean
  autoPayOnInvoiceReceived?: boolean
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
  amount: number
  invoiceReceived: boolean
  invoiceReceivedDate?: string
  isPaid: boolean
  paidAt?: string
  tenantInvoiceIssued?: boolean
  tenantInvoiceIssuedDate?: string
  tenantPaid?: boolean
  tenantPaidAt?: string
}

// General Assets module (Bienes y Activos)
export type AssetCategory = 'numismatica' | 'arte' | 'relojes' | 'electronica' | 'objetos'

export interface AssetItem extends TimestampedDoc {
  name: string
  owner: AssetOwner
  category: AssetCategory
  tags?: string[]
  description?: string
  brandOrAuthor?: string
  year?: number
  historicalEra?: string
  country?: string
  placeOfOrigin?: string
  ruler?: string
  /** City or workshop where the coin was struck (Roma, Sevilla, México…). */
  mint?: string
  denomination?: string
  conservationState?: string
  material?: string
  acquisitionYear?: number
  acquisitionPrice?: number
  currentValue?: number
  notes?: string
  photos: string[]
  photoSizesBytes?: number[]

  /** Import traceability (optional, hidden from the form). */
  import_key?: string
  import_batch?: string
  import_source?: string
  import_row?: number

  // Numismática fields (optional so other categories keep working)
  numismatica_type?: 'moneda' | 'medalla'
  medal_motive?: string
  /** Free text so values such as "50x30", "60 mm" or "varios tamaños" fit. */
  medal_size_mm?: string
  acquisition_operation?: string
  medal_location?: string
  value?: number
  /** Market valuation in euros. The source is stored in `value_source`. */
  market_value?: number
  value_source?: string
  /** Purchase price in euros, already converted from `purchase_currency`. */
  purchase_price?: number
  purchase_price_original?: number
  purchase_currency?: string
  acquisition_source?: string
  purchase_year?: number
  obverse_info?: string
  reverse_info?: string
  era?: string
  creation_year_range?: string
  reference_book?: string
  /** Book valuation in euros, already converted from `reference_book_currency`. */
  reference_book_value?: number
  reference_book_value_original?: number
  reference_book_currency?: string
  empire_reign?: string
  manufacturing_place?: string
  /** Mint mark or assayer initials (M-FM, IJ, PP…), kept apart from the city. */
  mint_mark?: string
  weight_grams?: string
  diameter_mm?: string
  inventory_number?: string
  catalog_reference?: string
  case_location?: string
  case_number?: string
  added_date?: string
}

/**
 * One row of a bulk import file. `photos` is optional because imported rows
 * usually start without photos; the import screen fills an empty array.
 */
export type AssetImportRecord = Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt' | 'photos'> & {
  photos?: string[]
  import_key: string
  import_batch: string
}

export interface AssetImportFile {
  batch: string
  description?: string
  records: AssetImportRecord[]
}
