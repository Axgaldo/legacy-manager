import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subscribeToCollection } from '@/lib/firestoreSubscriptions'
import { Property, Tenant, TenantDocument, TenantDocumentKind } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { asNumberOr, asString } from '@/utils/coerce'
import {
  getPrivateStorageBlob,
  uploadPrivateStorageBlob,
} from '@/lib/storageFiles'

const TENANTS_COLLECTION = 'tenants'
const DOCUMENTS_COLLECTION = 'tenantDocuments'
const PROPERTIES_COLLECTION = 'properties'

export const MAX_TENANT_DOCUMENT_BYTES = 25 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  txt: 'text/plain',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
}

const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION)

export const TENANT_DOCUMENT_ACCEPT = ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')

export const TENANT_DOCUMENT_KINDS: Array<{ value: TenantDocumentKind; label: string; icon: string }> = [
  { value: 'dni', label: 'DNI', icon: '🪪' },
  { value: 'pasaporte', label: 'Pasaporte', icon: '🛂' },
  { value: 'contrato', label: 'Contrato', icon: '📄' },
  { value: 'nomina', label: 'Nómina', icon: '💼' },
  { value: 'recibo', label: 'Recibo', icon: '🧾' },
  { value: 'seguro', label: 'Seguro', icon: '🛡️' },
  { value: 'certificado', label: 'Certificado', icon: '📜' },
  { value: 'otro', label: 'Otro', icon: '📎' },
]

function normalizeTenantName(value: string): string {
  return value.trim().toLocaleLowerCase('es')
}

function fileExtension(fileName: string): string {
  return fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLocaleLowerCase('es') ?? ''
}

export function resolveTenantDocumentContentType(file: File): string | null {
  // Prefer the extension so Office/ZIP files get a type accepted by Storage rules
  // even when the browser reports application/octet-stream.
  return MIME_BY_EXTENSION[fileExtension(file.name)] ?? file.type ?? null
}

export function validateTenantDocumentFile(file: File): string | null {
  if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `Formato no admitido en «${file.name}». Se aceptan PDF, imágenes, Word, Excel, ODT, TXT y ZIP/RAR.`
  }
  if (file.size > MAX_TENANT_DOCUMENT_BYTES) {
    return `«${file.name}» supera el límite de 25 MiB (${(file.size / (1024 * 1024)).toFixed(1)} MiB).`
  }
  if (file.size === 0) return `«${file.name}» está vacío.`
  if (!resolveTenantDocumentContentType(file)) return `No se pudo reconocer el tipo de «${file.name}».`
  return null
}

function mapTenant(id: string, data: Record<string, any>): Tenant {
  return {
    id,
    name: asString(data.name),
    nif: asString(data.nif),
    phone: asString(data.phone),
    email: asString(data.email),
    birthDate: asString(data.birthDate),
    address: asString(data.address),
    city: asString(data.city),
    province: asString(data.province),
    postalCode: asString(data.postalCode),
    iban: asString(data.iban),
    notes: asString(data.notes),
    isActive: data.isActive !== false,
    deletedAt: asString(data.deletedAt) || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function mapTenantDocument(id: string, data: Record<string, any>): TenantDocument {
  return {
    id,
    tenantId: asString(data.tenantId),
    fileName: asString(data.fileName, 'documento'),
    contentType: asString(data.contentType, 'application/octet-stream'),
    sizeBytes: asNumberOr(data.sizeBytes, 0),
    storedSizeBytes: asNumberOr(data.storedSizeBytes ?? data.sizeBytes, 0),
    storagePath: asString(data.storagePath),
    kind: (TENANT_DOCUMENT_KINDS.some((item) => item.value === data.kind) ? data.kind : 'otro') as TenantDocumentKind,
    label: asString(data.label),
    uploadedBy: asString(data.uploadedBy),
    deletedAt: asString(data.deletedAt) || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export function subscribeToTenants(
  onSuccess: (tenants: Tenant[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<Tenant>({
    name: TENANTS_COLLECTION,
    filter: (data) => !data.deletedAt,
    map: mapTenant,
    sort: (a, b) => a.name.localeCompare(b.name, 'es'),
    onSuccess,
    onError,
  })
}

export async function createTenant(input: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, TENANTS_COLLECTION), cleanPayload({
    ...input,
    name: input.name.trim(),
    nameLower: normalizeTenantName(input.name),
    isActive: input.isActive !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
  return ref.id
}

export async function updateTenant(id: string, updates: Partial<Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const payload: Record<string, any> = { ...updates }
  if (updates.name !== undefined) {
    payload.name = updates.name.trim()
    payload.nameLower = normalizeTenantName(updates.name)
  }
  await updateDoc(doc(db, TENANTS_COLLECTION, id), cleanPayload({
    ...payload,
    updatedAt: serverTimestamp(),
  }))
}

export function subscribeToTenantDocuments(
  tenantId: string,
  onSuccess: (documents: TenantDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<TenantDocument>({
    name: DOCUMENTS_COLLECTION,
    constraints: [where('tenantId', '==', tenantId)],
    filter: (data) => !data.deletedAt,
    map: mapTenantDocument,
    sort: (a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt),
    onSuccess,
    onError,
  })
}

export function subscribeToAllTenantDocuments(
  onSuccess: (documents: TenantDocument[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<TenantDocument>({
    name: DOCUMENTS_COLLECTION,
    filter: (data) => !data.deletedAt,
    map: mapTenantDocument,
    onSuccess,
    onError,
  })
}

export function countDocumentsByTenant(documents: TenantDocument[]): Map<string, number> {
  const counts = new Map<string, number>()
  documents.forEach((document) => counts.set(document.tenantId, (counts.get(document.tenantId) ?? 0) + 1))
  return counts
}

export async function uploadTenantDocument(args: {
  tenantId: string
  file: File
  kind: TenantDocumentKind
  label?: string
  uploadedBy?: string
  onProgress?: (percent: number) => void
}): Promise<TenantDocument> {
  const validation = validateTenantDocumentFile(args.file)
  if (validation) throw new Error(validation)

  const contentType = resolveTenantDocumentContentType(args.file)
  if (!contentType) throw new Error(`No se pudo reconocer el tipo de «${args.file.name}».`)

  const documentRef = doc(collection(db, DOCUMENTS_COLLECTION))
  const extension = fileExtension(args.file.name)
  const storagePath = `tenants/${args.tenantId}/${documentRef.id}${extension ? `.${extension}` : ''}`
  const storedBytes = await uploadPrivateStorageBlob(storagePath, args.file, contentType, args.onProgress)

  const payload: Omit<TenantDocument, 'id'> = {
    tenantId: args.tenantId,
    fileName: args.file.name,
    contentType,
    sizeBytes: args.file.size,
    storedSizeBytes: storedBytes,
    storagePath,
    kind: args.kind,
    label: args.label?.trim() || undefined,
    uploadedBy: args.uploadedBy,
    createdAt: serverTimestamp(),
  }
  await setDoc(documentRef, cleanPayload(payload))
  return { id: documentRef.id, ...payload }
}

export async function getTenantDocumentBlob(document: TenantDocument): Promise<Blob> {
  if (!document.storagePath) throw new Error('Este documento no tiene un archivo asociado.')
  return getPrivateStorageBlob(document.storagePath)
}

export async function linkTenantToProperty(property: Property, tenantId: string): Promise<void> {
  if ((property.tenantIds ?? []).includes(tenantId)) return
  await updateDoc(doc(db, PROPERTIES_COLLECTION, property.id), {
    tenantIds: arrayUnion(tenantId),
    updatedAt: serverTimestamp(),
  })
}

export async function unlinkTenantFromProperty(property: Property, tenantId: string): Promise<void> {
  if (!(property.tenantIds ?? []).includes(tenantId)) return
  await updateDoc(doc(db, PROPERTIES_COLLECTION, property.id), {
    tenantIds: arrayRemove(tenantId),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Turns tenants embedded in legacy property documents into real tenant entities
 * and links them to the property. It runs once per property thanks to `tenantsMigrated`.
 */
const migratingPropertyIds = new Set<string>()

export async function migratePropertyTenants(property: Property): Promise<number> {
  if (property.tenantsMigrated || migratingPropertyIds.has(property.id)) return 0

  const legacyTenants = property.tenants?.length
    ? property.tenants
    : property.tenantName?.trim()
      ? [{ id: 'legacy-tenant', name: property.tenantName, phone: property.tenantPhone, email: property.tenantEmail, nif: property.tenantNif }]
      : []
  const namedTenants = legacyTenants.filter((tenant) => tenant.name?.trim())
  if (!legacyTenants.length) return 0

  migratingPropertyIds.add(property.id)
  try {
    const createdIds: string[] = []
    for (let index = 0; index < namedTenants.length; index++) {
      const tenant = namedTenants[index]
      const tenantRef = doc(db, TENANTS_COLLECTION, `legacy_${property.id}_${index}`)
      const alreadyMigrated = await getDoc(tenantRef)
      if (alreadyMigrated.exists()) {
        createdIds.push(tenantRef.id)
        continue
      }

      // Reuse an existing tenant with the same name (for example one created from a contract)
      // instead of creating a duplicate during the import.
      const sameName = await getDocs(query(collection(db, TENANTS_COLLECTION), where('nameLower', '==', normalizeTenantName(tenant.name))))
      // Never reuse a tenant that is in the trash: it would stay invisible.
      const reusable = sameName.docs.find((item) => !item.data().deletedAt)
      if (reusable) {
        createdIds.push(reusable.id)
        continue
      }

      await setDoc(tenantRef, cleanPayload({
        name: tenant.name.trim(),
        nameLower: normalizeTenantName(tenant.name),
        nif: tenant.nif?.trim() || undefined,
        phone: tenant.phone?.trim() || undefined,
        email: tenant.email?.trim() || undefined,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }))
      createdIds.push(tenantRef.id)
    }

    await updateDoc(doc(db, PROPERTIES_COLLECTION, property.id), {
      ...(createdIds.length ? { tenantIds: arrayUnion(...createdIds) } : {}),
      tenantsMigrated: true,
      tenants: [],
      tenantName: '',
      tenantPhone: '',
      tenantEmail: '',
      tenantNif: '',
      updatedAt: serverTimestamp(),
    })
    return createdIds.length
  } catch (error) {
    console.error('No se pudieron migrar los inquilinos del inmueble:', property.id, error)
    return 0
  } finally {
    migratingPropertyIds.delete(property.id)
  }
}

/**
 * Finds or creates a tenant entity from the name/contact data used by contracts
 * and links it to the property without duplicating tenants.
 */
export async function ensureTenantFromLegacyData(
  property: Property,
  data: { tenantName: string; tenantPhone?: string; tenantEmail?: string; tenantNif?: string },
): Promise<string | null> {
  const name = data.tenantName.trim()
  if (!name) return null

  const existing = await getDocs(query(collection(db, TENANTS_COLLECTION), where('nameLower', '==', normalizeTenantName(name))))
  // A tenant in the trash must not be reused: it would stay hidden.
  let tenantId = existing.docs.find((item) => !item.data().deletedAt)?.id
  if (!tenantId) {
    tenantId = await createTenant({
      name,
      phone: data.tenantPhone?.trim() || undefined,
      email: data.tenantEmail?.trim() || undefined,
      nif: data.tenantNif?.trim() || undefined,
      isActive: true,
    })
  }

  if (!(property.tenantIds ?? []).includes(tenantId)) {
    await updateDoc(doc(db, PROPERTIES_COLLECTION, property.id), {
      tenantIds: arrayUnion(tenantId),
      updatedAt: serverTimestamp(),
    })
  }
  return tenantId
}

function timestampValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value || '')) || 0
}
