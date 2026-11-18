import {
  collection,
  doc,
  addDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subscribeToCollection } from '@/lib/firestoreSubscriptions'
import { Property } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { asBoolean, asNumber, asNumberOr, asString, asStringArray } from '@/utils/coerce'

const COLLECTION_NAME = 'properties'

export function subscribeToProperties(
  onSuccess: (properties: Property[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<Property>({
    name: COLLECTION_NAME,
    constraints: [orderBy('createdAt', 'desc')],
    // Los inmuebles en la papelera (soft delete) no llegan a las listas.
    filter: (data) => !data.deletedAt,
    map: (id, data) => ({
      id,
      name: asString(data.name),
      owner: asString(data.owner, 'Gabriel'),
      type: data.type ?? 'apartment',
      status: data.status ?? 'vacant',
      address: asString(data.address),
      city: asString(data.city),
      province: asString(data.province, 'Sevilla'),
      postalCode: asString(data.postalCode),
      cadastralReference: asString(data.cadastralReference),
      monthlyRent: asNumber(data.monthlyRent),
      rentStartMonth: asString(data.rentStartMonth) || undefined,
      rentRequiresInvoice: asBoolean(data.rentRequiresInvoice),
      rentHistory: Array.isArray(data.rentHistory)
        ? data.rentHistory.map((rate: any) => ({
          effectiveFrom: asString(rate?.effectiveFrom),
          amount: asNumberOr(rate?.amount, 0),
        }))
        : [],
      tenants: Array.isArray(data.tenants)
        ? data.tenants.map((tenant: any, index: number) => ({
          id: asString(tenant?.id, `tenant-${index}`),
          name: asString(tenant?.name),
          phone: asString(tenant?.phone),
          email: asString(tenant?.email),
          nif: asString(tenant?.nif),
        }))
        : [],
      tenantIds: asStringArray(data.tenantIds),
      tenantsMigrated: asBoolean(data.tenantsMigrated),
      tenantName: asString(data.tenantName),
      tenantPhone: asString(data.tenantPhone),
      tenantEmail: asString(data.tenantEmail),
      tenantNif: asString(data.tenantNif),
      depositAmount: asNumber(data.depositAmount),
      avraReference: asString(data.avraReference),
      currentValue: asNumber(data.currentValue),
      notes: asString(data.notes),
      deletedAt: asString(data.deletedAt) || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }),
    onSuccess,
    onError,
  })
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
