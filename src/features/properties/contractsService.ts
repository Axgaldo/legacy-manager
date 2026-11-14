import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  getDocs,
  where,
  serverTimestamp,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Contract } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const COLLECTION_NAME = 'contracts'

export function subscribeToPropertyContracts(
  propertyId: string,
  onSuccess: (contracts: Contract[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('propertyId', '==', propertyId),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Contract[] = snapshot.docs.filter((docSnap) => !docSnap.data().isDeleted).map((docSnap) => {
        const d = docSnap.data()
        return {
          id: docSnap.id,
          propertyId: d.propertyId,
          tenantName: d.tenantName || '',
          tenantPhone: d.tenantPhone || '',
          tenantEmail: d.tenantEmail || '',
          tenantNif: d.tenantNif || '',
          startDate: d.startDate || '',
          endDate: d.endDate || '',
          monthlyRent: Number(d.monthlyRent) || 0,
          depositAmount: d.depositAmount ? Number(d.depositAmount) : undefined,
          avraReference: d.avraReference || '',
          isActive: Boolean(d.isActive),
          isDeleted: Boolean(d.isDeleted),
          notes: d.notes || '',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }
      })
      // Keep newest-created contracts first, falling back to start date for older records.
      items.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt) || (b.startDate || '').localeCompare(a.startDate || ''))
      // Legacy records could contain several active flags; show only the newest as current.
      const selectedActiveId = items.find((contract) => contract.isActive)?.id
      onSuccess(items.map((contract) => ({ ...contract, isActive: contract.id === selectedActiveId })))
    },
    (err) => {
      console.error('Error in contracts subscription:', err)
      if (onError) onError(err)
    },
  )
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

// Hides the contract from the application while retaining all immutable PDF files and versions.
export async function softDeleteContract(contractId: string) {
  const docRef = doc(db, COLLECTION_NAME, contractId)
  return updateDoc(docRef, { isDeleted: true, isActive: false, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
}
