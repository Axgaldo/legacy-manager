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
export type AssetCategory =
  | 'numismatica'
  | 'arte'
  | 'objetos'
  | 'relojes'
  | 'joyas'
  | 'electronica'
  | 'vehiculos'
  | 'libros'
  | 'sellos'
  | 'instrumentos-musicales'
  | 'deportes'
  | 'herramientas'
  | 'documentos'
  | 'coleccionables'
  | 'otros'

export interface AssetItem extends TimestampedDoc {
  name: string
  owner: AssetOwner
  category: AssetCategory
  tags?: string[]
  location?: string
  description?: string
  brandOrAuthor?: string
  year?: number
  historicalEra?: string
  country?: string
  placeOfOrigin?: string
  ruler?: string
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

  // Numismática fields
  value?: number
  market_value?: number
  purchase_price?: number
  purchase_year?: number
  obverse_info?: string
  reverse_info?: string
  era?: string
  creation_year_range?: string
  reference_book?: string
  reference_book_value?: number
  coin_type?: string
  empire_reign?: string
  manufacturing_place?: string
  case_location: string        // Requerido
  case_number: string           // Requerido
  added_date?: string          // Fecha de registro
}
