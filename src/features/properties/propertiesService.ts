import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Property } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const COLLECTION_NAME = 'properties'

export function subscribeToProperties(
  onSuccess: (properties: Property[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Property[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          name: data.name ?? '',
          owner: data.owner ?? 'Gabriel',
          type: data.type ?? 'apartment',
          status: data.status ?? 'vacant',
          address: data.address ?? '',
          city: data.city ?? '',
          province: data.province ?? 'Sevilla',
          postalCode: data.postalCode ?? '',
          cadastralReference: data.cadastralReference ?? '',
          monthlyRent: data.monthlyRent ? Number(data.monthlyRent) : undefined,
          rentRequiresInvoice: Boolean(data.rentRequiresInvoice),
          rentHistory: Array.isArray(data.rentHistory) ? data.rentHistory.map((rate: any) => ({ effectiveFrom: String(rate.effectiveFrom ?? ''), amount: Number(rate.amount) || 0 })) : [],
          tenants: Array.isArray(data.tenants) ? data.tenants.map((tenant: any, index: number) => ({ id: String(tenant.id ?? `tenant-${index}`), name: String(tenant.name ?? ''), phone: tenant.phone ?? '', email: tenant.email ?? '', nif: tenant.nif ?? '' })) : [],
          tenantName: data.tenantName ?? '',
          tenantPhone: data.tenantPhone ?? '',
          tenantEmail: data.tenantEmail ?? '',
          tenantNif: data.tenantNif ?? '',
          depositAmount: data.depositAmount ? Number(data.depositAmount) : undefined,
          avraReference: data.avraReference ?? '',
          fixedExpensesMonthly: data.fixedExpensesMonthly ? Number(data.fixedExpensesMonthly) : undefined,
          currentValue: data.currentValue ? Number(data.currentValue) : undefined,
          notes: data.notes ?? '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        }
      })
      onSuccess(items)
    },
    (err) => {
      console.error('Error fetching properties from Firestore:', err)
      if (onError) onError(err)
    },
  )
}

export async function createProperty(property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) {
  const colRef = collection(db, COLLECTION_NAME)
  const cleaned = cleanPayload(property)
  return await addDoc(colRef, {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateProperty(
  id: string,
  property: Partial<Omit<Property, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const docRef = doc(db, COLLECTION_NAME, id)
  const cleaned = cleanPayload(property)
  return await updateDoc(docRef, {
    ...cleaned,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProperty(id: string) {
  const docRef = doc(db, COLLECTION_NAME, id)
  return await deleteDoc(docRef)
}
