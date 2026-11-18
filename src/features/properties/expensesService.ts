import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subscribeToCollection } from '@/lib/firestoreSubscriptions'
import { Expense } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { asBoolean, asNumberOr, asString } from '@/utils/coerce'

const COLLECTION_NAME = 'expenses'

function mapExpense(id: string, d: Record<string, any>): Expense {
  return {
    id,
    propertyId: asString(d.propertyId),
    date: asString(d.date),
    year: asNumberOr(d.year, new Date().getFullYear()),
    month: asNumberOr(d.month, 1),
    category: d.category || 'otro',
    kind: d.kind === 'recurring' ? 'recurring' : 'one-off',
    frequency: d.frequency,
    amount: asNumberOr(d.amount, 0),
    description: asString(d.description),
    invoiceNumber: asString(d.invoiceNumber),
    invoiceReceived: asBoolean(d.invoiceReceived ?? Boolean(d.invoiceNumber)),
    invoiceReceivedDate: asString(d.invoiceReceivedDate),
    isPaid: asBoolean(d.isPaid),
    paidAt: asString(d.paidAt),
    isDeductible: d.isDeductible !== false,
    notes: asString(d.notes),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export function subscribeToPropertyExpenses(
  propertyId: string,
  onSuccess: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<Expense>({
    name: COLLECTION_NAME,
    constraints: [where('propertyId', '==', propertyId)],
    filter: (data) => !data.deletedAt,
    map: mapExpense,
    sort: (a, b) => (b.date || '').localeCompare(a.date || ''),
    onSuccess,
    onError,
  })
}

export function subscribeToYearExpenses(
  year: number,
  onSuccess: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<Expense>({
    name: COLLECTION_NAME,
    constraints: [where('year', '==', year)],
    filter: (data) => !data.deletedAt,
    map: mapExpense,
    sort: (a, b) => b.date.localeCompare(a.date),
    onSuccess,
    onError,
  })
}

export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) {
  const colRef = collection(db, COLLECTION_NAME)
  const cleaned = cleanPayload(expense)
  return await addDoc(colRef, {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteExpense(id: string) {
  const docRef = doc(db, COLLECTION_NAME, id)
  return await deleteDoc(docRef)
}

export async function updateExpenseStatus(
  id: string,
  updates: Partial<Pick<Expense, 'invoiceReceived' | 'invoiceReceivedDate' | 'isPaid' | 'paidAt'>>,
) {
  const docRef = doc(db, COLLECTION_NAME, id)
  return await updateDoc(docRef, { ...cleanPayload(updates), updatedAt: serverTimestamp() })
}
