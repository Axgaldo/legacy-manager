import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subscribeToCollection } from '@/lib/firestoreSubscriptions'
import { Contract } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { asBoolean, asNumber, asNumberOr, asString } from '@/utils/coerce'

const COLLECTION_NAME = 'contracts'

function mapContract(id: string, d: Record<string, any>): Contract {
  return {
    id,
    propertyId: asString(d.propertyId),
    tenantName: asString(d.tenantName),
    tenantPhone: asString(d.tenantPhone),
    tenantEmail: asString(d.tenantEmail),
    tenantNif: asString(d.tenantNif),
    startDate: asString(d.startDate),
    endDate: asString(d.endDate),
    monthlyRent: asNumberOr(d.monthlyRent, 0),
    depositAmount: asNumber(d.depositAmount),
    avraReference: asString(d.avraReference),
    isActive: asBoolean(d.isActive),
    isDeleted: asBoolean(d.isDeleted),
    deletedAt: asString(d.deletedAt) || undefined,
    notes: asString(d.notes),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

/** Marca solo el contrato vigente más reciente (datos antiguos podían tener varios). */
function withSingleActiveContract(items: Contract[]): Contract[] {
  const selectedActiveId = items.find((contract) => contract.isActive)?.id
  return items.map((contract) => ({ ...contract, isActive: contract.id === selectedActiveId }))
}

export function subscribeToPropertyContracts(
  propertyId: string,
  onSuccess: (contracts: Contract[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<Contract>({
    name: COLLECTION_NAME,
    constraints: [where('propertyId', '==', propertyId)],
    filter: (data) => !data.isDeleted,
    map: mapContract,
    sort: (a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt) || b.startDate.localeCompare(a.startDate),
    onSuccess: (items) => onSuccess(withSingleActiveContract(items)),
    onError,
  })
}

/** Contratos de todos los inmuebles, para los avisos de Inicio. */
export function subscribeToAllContracts(
  onSuccess: (contracts: Contract[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<Contract>({
    name: COLLECTION_NAME,
    filter: (data) => !data.isDeleted,
    map: mapContract,
    sort: (a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt),
    onSuccess,
    onError,
  })
}

function timestampValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value || '')) || 0
}

export async function addContract(contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>) {
  const colRef = collection(db, COLLECTION_NAME)
  const cleaned = cleanPayload(contract)
  return await addDoc(colRef, {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function archiveContract(contractId: string, endDate?: string) {
  const docRef = doc(db, COLLECTION_NAME, contractId)
  return await updateDoc(docRef, {
    isActive: false,
    endDate: endDate || new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  })
}

export async function updateContract(contractId: string, values: Partial<Omit<Contract, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>>) {
  const docRef = doc(db, COLLECTION_NAME, contractId)
  return updateDoc(docRef, { ...cleanPayload(values), updatedAt: serverTimestamp() })
}

export async function setActiveContract(propertyId: string, activeContractId: string | null) {
  const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where('propertyId', '==', propertyId)))
  const batch = writeBatch(db)
  snapshot.docs.forEach((contractDoc) => {
    if (contractDoc.data().isDeleted) return
    batch.update(contractDoc.ref, {
      isActive: activeContractId !== null && contractDoc.id === activeContractId,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

/**
 * Mueve el contrato a la papelera (30 días). Se guarda la fecha como ISO para
 * que la purga pueda borrar después sus PDFs, adendas y versiones.
 */
export async function softDeleteContract(contractId: string) {
  const docRef = doc(db, COLLECTION_NAME, contractId)
  return updateDoc(docRef, {
    isDeleted: true,
    isActive: false,
    deletedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })
}
