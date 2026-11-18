import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { deletePrivateStorageFile, isStoragePath } from '@/lib/storageFiles'
import { AssetItem, Contract, Tenant, TenantDocument } from '@/types'
import { getCategoryInfo } from '@/features/collections/assetCategories'
import { asIsoDate } from '@/utils/coerce'

/**
 * Papelera con borrado suave.
 *
 * Nada se borra al instante: los documentos reciben `deletedAt` (ISO) y las
 * consultas normales los ignoran. La purga definitiva se hace **desde la app**,
 * al abrir la papelera o al pulsar «Vaciar papelera», para no depender de Cloud
 * Functions (plan Blaze). Si nadie abre la papelera, nada se borra solo.
 *
 * Los hijos de un inmueble (gastos, cobros, gastos periódicos, ocurrencias y
 * contratos) se marcan con **el mismo `deletedAt`**; al restaurar solo vuelven
 * los que comparten esa marca exacta. Al purgar se borran también los PDFs de
 * contratos y adendas (Storage `contracts/`), para lo que las reglas de Storage
 * permiten `delete` a usuarios autorizados.
 */

export const TRASH_RETENTION_DAYS = 30

const COLLECTIONS = {
  properties: 'properties',
  assets: 'assets',
  tenants: 'tenants',
  tenantDocuments: 'tenantDocuments',
  expenses: 'expenses',
  rentPayments: 'rentPayments',
  schedules: 'recurringExpenseSchedules',
  occurrences: 'recurringExpenseOccurrences',
  contracts: 'contracts',
  addenda: 'contractAddenda',
  contractVersions: 'contractFileVersions',
} as const

/** Colecciones que cuelgan de un inmueble y se ocultan con él. */
const PROPERTY_CHILD_COLLECTIONS = [
  COLLECTIONS.expenses,
  COLLECTIONS.rentPayments,
  COLLECTIONS.schedules,
  COLLECTIONS.occurrences,
] as const

export type TrashKind = 'property' | 'asset' | 'contract' | 'tenant' | 'tenantDocument'

export interface TrashEntry {
  kind: TrashKind
  id: string
  title: string
  subtitle: string
  deletedAt: string
  expiresAt: string
  /** Datos necesarios para purgar los archivos de Storage. */
  photos?: string[]
  storagePath?: string
  tenantId?: string
}

export interface PurgeResult {
  /** Archivos de Storage que no se pudieron borrar (por ejemplo, reglas sin publicar). */
  skippedFiles: number
}

export const TRASH_KIND_META: Record<TrashKind, { label: string; icon: string }> = {
  property: { label: 'Inmuebles', icon: '🏠' },
  asset: { label: 'Bienes', icon: '📦' },
  contract: { label: 'Contratos', icon: '📝' },
  tenant: { label: 'Inquilinos', icon: '👤' },
  tenantDocument: { label: 'Documentos', icon: '📄' },
}

const DAY_MS = 24 * 60 * 60 * 1000
const BATCH_LIMIT = 400

export function trashExpiry(deletedAt: string): string {
  const start = Date.parse(deletedAt)
  return new Date((Number.isFinite(start) ? start : Date.now()) + TRASH_RETENTION_DAYS * DAY_MS).toISOString()
}

export function trashDaysLeft(entry: Pick<TrashEntry, 'expiresAt'>, now = new Date()): number {
  const remaining = Date.parse(entry.expiresAt) - now.getTime()
  return Math.max(0, Math.ceil(remaining / DAY_MS))
}

export function isTrashEntryExpired(entry: Pick<TrashEntry, 'expiresAt'>, now = new Date()): boolean {
  return Date.parse(entry.expiresAt) <= now.getTime()
}

function toIso(value: unknown): string {
  return asIsoDate(value) ?? ''
}

async function updateMany(
  collectionName: string,
  documents: Array<{ id: string }>,
  data: Record<string, any>,
) {
  for (let index = 0; index < documents.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db)
    documents.slice(index, index + BATCH_LIMIT).forEach((item) => {
      batch.update(doc(db, collectionName, item.id), data)
    })
    await batch.commit()
  }
}

async function deleteMany(collectionName: string, documents: Array<{ id: string }>) {
  for (let index = 0; index < documents.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db)
    documents.slice(index, index + BATCH_LIMIT).forEach((item) => {
      batch.delete(doc(db, collectionName, item.id))
    })
    await batch.commit()
  }
}

/** Borra archivos de Storage y devuelve cuántos no se pudieron eliminar. */
async function deleteStorageFiles(paths: string[]): Promise<number> {
  let skipped = 0
  await Promise.all(Array.from(new Set(paths)).map(async (path) => {
    try {
      await deletePrivateStorageFile(path)
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      // Un archivo que ya no existe no es un fallo.
      if (code !== 'storage/object-not-found') skipped++
    }
  }))
  return skipped
}

async function propertyChildDocs(propertyId: string) {
  const result: Array<{ collectionName: string; docs: Array<{ id: string; deletedAt: string }> }> = []
  for (const collectionName of PROPERTY_CHILD_COLLECTIONS) {
    const snapshot = await getDocs(query(collection(db, collectionName), where('propertyId', '==', propertyId)))
    result.push({
      collectionName,
      docs: snapshot.docs.map((item) => ({ id: item.id, deletedAt: toIso(item.data().deletedAt) })),
    })
  }
  return result
}

async function contractDocsForProperty(propertyId: string) {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.contracts), where('propertyId', '==', propertyId)))
  return snapshot.docs.map((item) => ({
    id: item.id,
    deletedAt: toIso(item.data().deletedAt),
    isDeleted: Boolean(item.data().isDeleted),
  }))
}

/** Borra un contrato: sus versiones PDF, las adendas y el documento. */
async function purgeContract(contractId: string): Promise<number> {
  const versions = await getDocs(query(collection(db, COLLECTIONS.contractVersions), where('contractId', '==', contractId)))
  const paths = versions.docs
    .map((item) => item.data().storagePath)
    .filter((path: unknown): path is string => typeof path === 'string' && isStoragePath(path))
  const skippedFiles = await deleteStorageFiles(paths)
  await deleteMany(COLLECTIONS.contractVersions, versions.docs.map((item) => ({ id: item.id })))

  const addenda = await getDocs(query(collection(db, COLLECTIONS.addenda), where('contractId', '==', contractId)))
  await deleteMany(COLLECTIONS.addenda, addenda.docs.map((item) => ({ id: item.id })))

  await deleteDoc(doc(db, COLLECTIONS.contracts, contractId))
  return skippedFiles
}

/** Marca el inmueble, sus hijos y sus contratos con la misma fecha de borrado. */
export async function softDeleteProperty(propertyId: string): Promise<string> {
  const deletedAt = new Date().toISOString()
  await updateDoc(doc(db, COLLECTIONS.properties, propertyId), { deletedAt, updatedAt: serverTimestamp() })

  const children = await propertyChildDocs(propertyId)
  for (const { collectionName, docs } of children) {
    await updateMany(collectionName, docs, { deletedAt, updatedAt: serverTimestamp() })
  }

  const contracts = await contractDocsForProperty(propertyId)
  await updateMany(
    COLLECTIONS.contracts,
    contracts.filter((contract) => !contract.isDeleted).map((contract) => ({ id: contract.id })),
    { deletedAt, isDeleted: true, isActive: false, updatedAt: serverTimestamp() },
  )
  return deletedAt
}

export async function softDeleteAsset(assetId: string): Promise<string> {
  const deletedAt = new Date().toISOString()
  await updateDoc(doc(db, COLLECTIONS.assets, assetId), { deletedAt, updatedAt: serverTimestamp() })
  return deletedAt
}

/**
 * Mueve el inquilino y sus documentos a la papelera. Los vínculos con los
 * inmuebles se conservan para que restaurarlo sea exacto; al purgarlo de verdad
 * sí se eliminan esos vínculos.
 */
export async function softDeleteTenant(tenantId: string): Promise<string> {
  const deletedAt = new Date().toISOString()
  await updateDoc(doc(db, COLLECTIONS.tenants, tenantId), { deletedAt, updatedAt: serverTimestamp() })
  const documents = await getDocs(query(collection(db, COLLECTIONS.tenantDocuments), where('tenantId', '==', tenantId)))
  await updateMany(COLLECTIONS.tenantDocuments, documents.docs.map((item) => ({ id: item.id })), {
    deletedAt,
    updatedAt: serverTimestamp(),
  })
  return deletedAt
}

export async function softDeleteTenantDocument(documentId: string): Promise<string> {
  const deletedAt = new Date().toISOString()
  await updateDoc(doc(db, COLLECTIONS.tenantDocuments, documentId), { deletedAt, updatedAt: serverTimestamp() })
  return deletedAt
}

/** Devuelve el documento (y sus hijos marcados con la misma fecha) a la app. */
export async function restoreTrashEntry(entry: TrashEntry): Promise<void> {
  const restored = { deletedAt: null, updatedAt: serverTimestamp() }

  if (entry.kind === 'property') {
    const children = await propertyChildDocs(entry.id)
    for (const { collectionName, docs } of children) {
      await updateMany(collectionName, docs.filter((item) => item.deletedAt === entry.deletedAt), restored)
    }
    const contracts = await contractDocsForProperty(entry.id)
    await updateMany(
      COLLECTIONS.contracts,
      contracts
        .filter((contract) => contract.isDeleted && contract.deletedAt === entry.deletedAt)
        .map((contract) => ({ id: contract.id })),
      { ...restored, isDeleted: false },
    )
  }

  if (entry.kind === 'tenant') {
    const documents = await getDocs(query(collection(db, COLLECTIONS.tenantDocuments), where('tenantId', '==', entry.id)))
    await updateMany(
      COLLECTIONS.tenantDocuments,
      documents.docs
        .filter((item) => toIso(item.data().deletedAt) === entry.deletedAt)
        .map((item) => ({ id: item.id })),
      restored,
    )
  }

  if (entry.kind === 'contract') {
    await updateDoc(doc(db, COLLECTIONS.contracts, entry.id), { ...restored, isDeleted: false })
    return
  }

  const collectionName = entry.kind === 'property'
    ? COLLECTIONS.properties
    : entry.kind === 'asset'
      ? COLLECTIONS.assets
      : entry.kind === 'tenant'
        ? COLLECTIONS.tenants
        : COLLECTIONS.tenantDocuments

  await updateDoc(doc(db, collectionName, entry.id), restored)
}

/**
 * Borra definitivamente un elemento de la papelera: documentos de Firestore y,
 * cuando las reglas lo permiten, sus archivos de Storage.
 */
export async function purgeTrashEntry(entry: TrashEntry): Promise<PurgeResult> {
  if (entry.kind === 'property') {
    const children = await propertyChildDocs(entry.id)
    for (const { collectionName, docs } of children) {
      await deleteMany(collectionName, docs)
    }
    const contracts = await contractDocsForProperty(entry.id)
    let skippedFiles = 0
    for (const contract of contracts) {
      skippedFiles += await purgeContract(contract.id)
    }
    await deleteDoc(doc(db, COLLECTIONS.properties, entry.id))
    return { skippedFiles }
  }

  if (entry.kind === 'contract') {
    return { skippedFiles: await purgeContract(entry.id) }
  }

  if (entry.kind === 'asset') {
    const skippedFiles = await deleteStorageFiles((entry.photos ?? []).filter(isStoragePath))
    // Respaldos de fotos legacy guardados en Firestore (base64) antes de Storage.
    const backups = await getDocs(collection(db, 'assetPhotoBackups', entry.id, 'photos'))
    for (let index = 0; index < backups.docs.length; index += BATCH_LIMIT) {
      const batch = writeBatch(db)
      backups.docs.slice(index, index + BATCH_LIMIT).forEach((item) => batch.delete(item.ref))
      await batch.commit()
    }
    await deleteDoc(doc(db, COLLECTIONS.assets, entry.id))
    return { skippedFiles }
  }

  if (entry.kind === 'tenant') {
    const documents = await getDocs(query(collection(db, COLLECTIONS.tenantDocuments), where('tenantId', '==', entry.id)))
    const skippedFiles = await deleteStorageFiles(
      documents.docs
        .map((item) => item.data().storagePath)
        .filter((path: unknown): path is string => typeof path === 'string' && isStoragePath(path)),
    )
    await deleteMany(COLLECTIONS.tenantDocuments, documents.docs.map((item) => ({ id: item.id })))
    await unlinkTenantFromEveryProperty(entry.id)
    await deleteDoc(doc(db, COLLECTIONS.tenants, entry.id))
    return { skippedFiles }
  }

  const skippedFiles = entry.storagePath && isStoragePath(entry.storagePath)
    ? await deleteStorageFiles([entry.storagePath])
    : 0
  await deleteDoc(doc(db, COLLECTIONS.tenantDocuments, entry.id))
  return { skippedFiles }
}

async function unlinkTenantFromEveryProperty(tenantId: string) {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.properties), where('tenantIds', 'array-contains', tenantId)))
  for (const item of snapshot.docs) {
    await updateDoc(item.ref, { tenantIds: arrayRemove(tenantId), updatedAt: serverTimestamp() })
  }
}

/** Carga la papelera completa. No deja listeners abiertos: es una lectura puntual. */
export async function loadTrash(): Promise<TrashEntry[]> {
  const [properties, assets, tenants, documents, contracts] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.properties)),
    getDocs(query(collection(db, COLLECTIONS.assets), where('deletedAt', '>', ''))),
    getDocs(collection(db, COLLECTIONS.tenants)),
    getDocs(query(collection(db, COLLECTIONS.tenantDocuments), where('deletedAt', '>', ''))),
    getDocs(collection(db, COLLECTIONS.contracts)),
  ])

  const propertyNames = new Map<string, string>()
  const deletedPropertyIds = new Set<string>()
  properties.docs.forEach((item) => {
    propertyNames.set(item.id, String(item.data().name ?? 'Inmueble'))
    if (item.data().deletedAt) deletedPropertyIds.add(item.id)
  })

  const tenantNames = new Map<string, string>()
  const deletedTenantIds = new Set<string>()
  tenants.docs.forEach((item) => {
    tenantNames.set(item.id, String(item.data().name ?? 'Inquilino'))
    if (item.data().deletedAt) deletedTenantIds.add(item.id)
  })

  const entries: TrashEntry[] = []

  const push = (entry: Omit<TrashEntry, 'expiresAt'>) => {
    if (!entry.deletedAt) return
    entries.push({ ...entry, expiresAt: trashExpiry(entry.deletedAt) })
  }

  properties.docs.forEach((item) => {
    const data = item.data()
    if (!data.deletedAt) return
    push({
      kind: 'property',
      id: item.id,
      title: data.name || 'Inmueble sin nombre',
      subtitle: String(data.city || data.province || 'Inmueble'),
      deletedAt: toIso(data.deletedAt),
    })
  })

  assets.docs.forEach((item) => {
    const data = item.data() as Partial<AssetItem>
    push({
      kind: 'asset',
      id: item.id,
      title: data.name || 'Bien sin nombre',
      subtitle: `${getCategoryInfo(data.category).label} · ${data.owner || 'Sin propietario'}`,
      deletedAt: toIso(data.deletedAt),
      photos: Array.isArray(data.photos) ? data.photos : [],
    })
  })

  contracts.docs.forEach((item) => {
    const data = item.data() as Partial<Contract>
    if (!data.isDeleted || !data.deletedAt) return
    // Los contratos de un inmueble en la papelera se purgan con él.
    if (data.propertyId && deletedPropertyIds.has(data.propertyId)) return
    push({
      kind: 'contract',
      id: item.id,
      title: data.tenantName || 'Contrato de alquiler',
      subtitle: `Contrato de ${data.propertyId ? propertyNames.get(data.propertyId) ?? 'inmueble' : 'inmueble'}${data.startDate ? ` · desde ${data.startDate}` : ''}`,
      deletedAt: toIso(data.deletedAt),
    })
  })

  tenants.docs.forEach((item) => {
    const data = item.data() as Partial<Tenant>
    if (!data.deletedAt) return
    push({
      kind: 'tenant',
      id: item.id,
      title: data.name || 'Inquilino sin nombre',
      subtitle: data.nif ? `DNI/NIF ${data.nif}` : 'Sin DNI/NIF',
      deletedAt: toIso(data.deletedAt),
    })
  })

  documents.docs.forEach((item) => {
    const data = item.data() as Partial<TenantDocument>
    // Los documentos de un inquilino en la papelera se purgan con él.
    if (data.tenantId && deletedTenantIds.has(data.tenantId)) return
    push({
      kind: 'tenantDocument',
      id: item.id,
      title: data.label || data.fileName || 'Documento',
      subtitle: `Documento de ${data.tenantId ? tenantNames.get(data.tenantId) ?? 'inquilino' : 'inquilino'}`,
      deletedAt: toIso(data.deletedAt),
      storagePath: data.storagePath,
      tenantId: data.tenantId,
    })
  })

  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

/** Purga los elementos que ya han superado los 30 días. */
export async function purgeExpiredTrash(entries: TrashEntry[], now = new Date()): Promise<{ purged: number; skippedFiles: number }> {
  const expired = entries.filter((entry) => isTrashEntryExpired(entry, now))
  let skippedFiles = 0
  for (const entry of expired) {
    const result = await purgeTrashEntry(entry)
    skippedFiles += result.skippedFiles
  }
  return { purged: expired.length, skippedFiles }
}

/** Fecha legible para la ficha de la papelera. */
export function formatTrashDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
