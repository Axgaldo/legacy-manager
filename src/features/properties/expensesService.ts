import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Expense } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'

const COLLECTION_NAME = 'expenses'

function mapExpense(id: string, d: Record<string, any>): Expense {
  return {
    id,
    propertyId: d.propertyId,
    date: d.date || '',
    year: Number(d.year) || new Date().getFullYear(),
    month: Number(d.month) || 1,
    category: d.category || 'otro',
    kind: d.kind === 'recurring' ? 'recurring' : 'one-off',
    frequency: d.frequency,
    amount: Number(d.amount) || 0,
    description: d.description || '',
    invoiceNumber: d.invoiceNumber || '',
    invoiceReceived: Boolean(d.invoiceReceived ?? d.invoiceNumber),
    invoiceReceivedDate: d.invoiceReceivedDate || '',
    isPaid: Boolean(d.isPaid),
    paidAt: d.paidAt || '',
    isDeductible: d.isDeductible !== false,
    notes: d.notes || '',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export function subscribeToPropertyExpenses(
  propertyId: string,
  onSuccess: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('propertyId', '==', propertyId),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Expense[] = snapshot.docs
        .filter((docSnap) => !docSnap.data().deletedAt)
        .map((docSnap) => mapExpense(docSnap.id, docSnap.data()))
      // Sort by date descending in memory
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      onSuccess(items)
    },
    (err) => {
      console.error('Error in expenses subscription:', err)
      if (onError) onError(err)
    },
  )
}

export function subscribeToYearExpenses(
  year: number,
  onSuccess: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_NAME), where('year', '==', year))
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((docSnap) => mapExpense(docSnap.id, docSnap.data()))
    items.sort((a, b) => b.date.localeCompare(a.date))
    onSuccess(items)
  }, (error) => {
    console.error('Error fetching yearly expense overview:', error)
    onError?.(error)
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
