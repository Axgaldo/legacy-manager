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
import { AssetItem, Tenant, TenantDocument } from '@/types'
import { getCategoryInfo } from '@/features/collections/assetCategories'

/**
 * Papelera con borrado suave.
 *
 * Nada se borra al instante: los documentos reciben `deletedAt` (ISO) y las
 * consultas normales los ignoran. La purga definitiva se hace **desde la app**,
 * al abrir la papelera o al pulsar «Vaciar papelera», para no depender de Cloud
 * Functions (plan Blaze). Si nadie abre la papelera, nada se borra solo.
 *
 * Los hijos de un inmueble (gastos, cobros, gastos periódicos y ocurrencias) se
 * marcan con **el mismo `deletedAt`**; al restaurar solo vuelven los que
 * comparten esa marca exacta, así no se resucita algo borrado antes.
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
} as const

/** Colecciones que cuelgan de un inmueble y se ocultan con él. */
const PROPERTY_CHILD_COLLECTIONS = [
  COLLECTIONS.expenses,
  COLLECTIONS.rentPayments,
  COLLECTIONS.schedules,
  COLLECTIONS.occurrences,
] as const

export type TrashKind = 'property' | 'asset' | 'tenant' | 'tenantDocument'

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

export const TRASH_KIND_META: Record<TrashKind, { label: string; icon: string }> = {
  property: { label: 'Inmuebles', icon: '🏠' },
  asset: { label: 'Bienes', icon: '📦' },
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
  if (typeof value === 'string' && value) return value
  if (value instanceof Date) return value.toISOString()
  const maybe = value as { toDate?: () => Date } | null
  if (maybe && typeof maybe.toDate === 'function') return maybe.toDate().toISOString()
  return ''
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

/** Marca el inmueble y sus hijos con la misma fecha de borrado. */
export async function softDeleteProperty(propertyId: string): Promise<string> {
  const deletedAt = new Date().toISOString()
  await updateDoc(doc(db, COLLECTIONS.properties, propertyId), { deletedAt, updatedAt: serverTimestamp() })
  const children = await propertyChildDocs(propertyId)
  for (const { collectionName, docs } of children) {
    await updateMany(collectionName, docs, { deletedAt, updatedAt: serverTimestamp() })
  }
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
export async function purgeTrashEntry(entry: TrashEntry): Promise<void> {
  if (entry.kind === 'property') {
    const children = await propertyChildDocs(entry.id)
    for (const { collectionName, docs } of children) {
      await deleteMany(collectionName, docs)
    }
    await deleteDoc(doc(db, COLLECTIONS.properties, entry.id))
    // Los contratos y sus PDFs son archivo histórico inmutable: no se tocan.
    return
  }

  if (entry.kind === 'asset') {
    await Promise.allSettled(
      (entry.photos ?? []).filter(isStoragePath).map((path) => deletePrivateStorageFile(path)),
    )
    await deleteDoc(doc(db, COLLECTIONS.assets, entry.id))
    return
  }

  if (entry.kind === 'tenant') {
    const documents = await getDocs(query(collection(db, COLLECTIONS.tenantDocuments), where('tenantId', '==', entry.id)))
    await Promise.allSettled(
      documents.docs
        .map((item) => item.data().storagePath)
        .filter((path: unknown): path is string => typeof path === 'string' && isStoragePath(path))
        .map((path) => deletePrivateStorageFile(path)),
    )
    await deleteMany(COLLECTIONS.tenantDocuments, documents.docs.map((item) => ({ id: item.id })))
    await unlinkTenantFromEveryProperty(entry.id)
    await deleteDoc(doc(db, COLLECTIONS.tenants, entry.id))
    return
  }

  if (entry.storagePath && isStoragePath(entry.storagePath)) {
    await Promise.allSettled([deletePrivateStorageFile(entry.storagePath)])
  }
  await deleteDoc(doc(db, COLLECTIONS.tenantDocuments, entry.id))
}

async function unlinkTenantFromEveryProperty(tenantId: string) {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.properties), where('tenantIds', 'array-contains', tenantId)))
  for (const item of snapshot.docs) {
    await updateDoc(item.ref, { tenantIds: arrayRemove(tenantId), updatedAt: serverTimestamp() })
  }
}

/** Carga la papelera completa. No deja listeners abiertos: es una lectura puntual. */
export async function loadTrash(): Promise<TrashEntry[]> {
  const [properties, assets, tenants, documents] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.properties), where('deletedAt', '>', ''))),
    getDocs(query(collection(db, COLLECTIONS.assets), where('deletedAt', '>', ''))),
    getDocs(query(collection(db, COLLECTIONS.tenants), where('deletedAt', '>', ''))),
    getDocs(query(collection(db, COLLECTIONS.tenantDocuments), where('deletedAt', '>', ''))),
  ])

  const tenantNames = new Map<string, string>()
  const allTenants = await getDocs(collection(db, COLLECTIONS.tenants))
  allTenants.docs.forEach((item) => tenantNames.set(item.id, String(item.data().name ?? 'Inquilino')))
  const deletedTenantIds = new Set(tenants.docs.map((item) => item.id))

  const entries: TrashEntry[] = []

  const push = (entry: Omit<TrashEntry, 'expiresAt'>) => {
    if (!entry.deletedAt) return
    entries.push({ ...entry, expiresAt: trashExpiry(entry.deletedAt) })
  }

  properties.docs.forEach((item) => {
    const data = item.data()
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

  tenants.docs.forEach((item) => {
    const data = item.data() as Partial<Tenant>
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

/** Purga los elementos que ya han superado los 30 días. Devuelve cuántos borró. */
export async function purgeExpiredTrash(entries: TrashEntry[], now = new Date()): Promise<number> {
  const expired = entries.filter((entry) => isTrashEntryExpired(entry, now))
  for (const entry of expired) {
    await purgeTrashEntry(entry)
  }
  return expired.length
}

/** Fecha legible para la ficha de la papelera. */
export function formatTrashDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

